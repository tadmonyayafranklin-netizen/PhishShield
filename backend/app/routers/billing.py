"""Billing & subscriptions — payments processed via PayUnit."""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import audit, get_current_user, get_subscription, org_is_premium, require_roles
from ..models import (
    Notification, Org, Payment, PaymentStatus, PlanEnum, RoleEnum,
    Subscription, SubscriptionStatus, User,
)
from ..schemas import PaymentOut, SubscribeRequest, SubscriptionOut
from ..services import payunit

router = APIRouter(prefix="/billing", tags=["billing"])

PLAN_CATALOG = {
    "free": {
        "id": "free",
        "name": "Free",
        "price": 0,
        "currency": settings.payunit_currency,
        "interval_days": None,
        "features": [
            "Up to 1 active campaign",
            "Up to 100 participants per campaign",
            "Core dashboard & campaign analytics",
            "CSV exports",
        ],
    },
    "premium": {
        "id": "premium",
        "name": "Premium",
        "price": settings.payunit_premium_price,
        "currency": settings.payunit_currency,
        "interval_days": settings.payunit_premium_days,
        "features": [
            "Unlimited campaigns & participants",
            "PDF awareness reports",
            "Advanced analytics (trends, comparisons, department scores)",
            "Priority email simulations",
        ],
    },
}


def _sub_out(db: Session, user: User) -> SubscriptionOut:
    sub = get_subscription(db, user.organization_id)
    premium = org_is_premium(db, user.organization_id)
    return SubscriptionOut(
        plan=sub.plan.value if sub else "free",
        status=sub.status.value if sub else "active",
        is_premium=premium or user.role == RoleEnum.super_admin,
        current_period_end=sub.current_period_end if sub else None,
        currency=settings.payunit_currency,
        premium_price=settings.payunit_premium_price,
        premium_days=settings.payunit_premium_days,
        payunit_enabled=settings.payunit_enabled,
        plans=list(PLAN_CATALOG.values()),
    )


@router.get("/plans")
def list_plans(user: User = Depends(get_current_user)):
    return list(PLAN_CATALOG.values())


@router.get("/status", response_model=SubscriptionOut)
def billing_status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _sub_out(db, user)


@router.get("/payments", response_model=list[PaymentOut])
def list_payments(db: Session = Depends(get_db),
                  user: User = Depends(require_roles(RoleEnum.super_admin, RoleEnum.org_admin))):
    q = db.query(Payment)
    if user.role != RoleEnum.super_admin:
        q = q.filter(Payment.organization_id == user.organization_id)
    return q.order_by(Payment.created_at.desc()).limit(50).all()


def _frontend_base() -> str:
    if settings.payunit_return_url:
        return settings.payunit_return_url.rsplit("/billing/return", 1)[0]
    return settings.cors_origins.split(",")[0].strip().rstrip("/")


@router.post("/subscribe")
def subscribe(payload: SubscribeRequest, request: Request, db: Session = Depends(get_db),
              user: User = Depends(require_roles(RoleEnum.super_admin, RoleEnum.org_admin))):
    if payload.plan != "premium":
        raise HTTPException(400, "Only the premium plan can be purchased")
    if not user.organization_id:
        raise HTTPException(400, "No organization associated with this account")
    if not settings.payunit_enabled:
        raise HTTPException(503, "Payments are not configured yet (PayUnit is disabled)")

    amount = settings.payunit_premium_price
    txn_id = f"ps{uuid.uuid4().hex[:20]}"  # alphanumeric only — safe for all providers
    return_url = f"{_frontend_base()}/billing/return?ref={txn_id}"
    notify_url = settings.payunit_notify_url or \
        f"{settings.simulation_base_url.rstrip('/')}/api/billing/payunit/notify"

    payment = Payment(organization_id=user.organization_id, plan=PlanEnum.premium,
                      amount=amount, currency=settings.payunit_currency,
                      transaction_id=txn_id, status=PaymentStatus.pending)
    db.add(payment)
    db.flush()
    audit(db, user, "billing.subscribe", {"plan": "premium", "amount": amount,
                                          "currency": settings.payunit_currency,
                                          "transaction_id": txn_id}, request)

    try:
        data = payunit.initialize_payment(
            transaction_id=txn_id, amount=amount, currency=settings.payunit_currency,
            return_url=return_url, notify_url=notify_url)
    except Exception as e:
        payment.status = PaymentStatus.failed
        payment.failure_reason = str(e)[:500]
        db.commit()
        raise HTTPException(502, f"Payment provider error: {e}")

    payment.provider_reference = data.get("transaction_id")
    db.commit()
    return {
        "transaction_id": txn_id,
        "transaction_url": data.get("transaction_url"),
        "amount": amount,
        "currency": settings.payunit_currency,
    }


def _activate_subscription(db: Session, payment: Payment):
    """Extend the org's premium period (stacked on any remaining time)."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub = get_subscription(db, payment.organization_id)
    if not sub:
        sub = Subscription(organization_id=payment.organization_id)
        db.add(sub)
        db.flush()
    base = sub.current_period_end if sub.current_period_end and sub.current_period_end > now else now
    sub.plan = PlanEnum.premium
    sub.status = SubscriptionStatus.active
    sub.current_period_end = base + timedelta(days=settings.payunit_premium_days)

    org = db.get(Org, payment.organization_id)
    org_name = org.name if org else payment.organization_id
    admins = db.query(User).filter(User.organization_id == payment.organization_id,
                                   User.role == RoleEnum.org_admin,
                                   User.is_active.is_(True)).all()
    for a in admins:
        db.add(Notification(user_id=a.id, organization_id=payment.organization_id,
                            title="Premium activated",
                            message=f"Payment received — {org_name} is now on the Premium plan "
                                    f"until {sub.current_period_end.date().isoformat()}.",
                            kind="billing"))


@router.post("/payunit/notify")
async def payunit_notify(request: Request, db: Session = Depends(get_db)):
    """PayUnit server-to-server payment notification (webhook)."""
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid payload")
    data = payload.get("data") or {}
    txn_id = data.get("transaction_id") or payload.get("transaction_id")
    status_raw = (data.get("transaction_status") or payload.get("transaction_status") or "").upper()
    if not txn_id:
        raise HTTPException(400, "Missing transaction id")

    payment = db.query(Payment).filter(
        (Payment.transaction_id == txn_id) | (Payment.provider_reference == txn_id)
    ).first()
    if not payment:
        raise HTTPException(404, "Unknown transaction")
    if payment.status == PaymentStatus.success:
        return {"ok": True, "already_processed": True}

    if status_raw == "SUCCESS":
        payment.status = PaymentStatus.success
        payment.paid_at = datetime.now(timezone.utc).replace(tzinfo=None)
        payment.provider_reference = data.get("transaction_id") or payment.provider_reference
        _activate_subscription(db, payment)
        audit(db, None, "billing.payment_success",
              {"transaction_id": payment.transaction_id, "amount": payment.amount}, request)
    elif status_raw in {"FAILED", "CANCELLED"}:
        payment.status = PaymentStatus.failed
        payment.failure_reason = data.get("message") or status_raw
        audit(db, None, "billing.payment_failed",
              {"transaction_id": payment.transaction_id, "status": status_raw}, request)
    else:
        return {"ok": True, "ignored": status_raw or "unknown"}

    db.commit()
    return {"ok": True}


@router.post("/refresh")
def refresh_pending(db: Session = Depends(get_db),
                    user: User = Depends(require_roles(RoleEnum.super_admin, RoleEnum.org_admin))):
    """Re-check pending payments with PayUnit (fallback if the webhook is delayed)."""
    q = db.query(Payment).filter(Payment.status == PaymentStatus.pending)
    if user.role != RoleEnum.super_admin:
        q = q.filter(Payment.organization_id == user.organization_id)
    updated = 0
    for p in q.limit(10).all():
        try:
            data = payunit.get_payment_status(p.transaction_id)
        except Exception:
            continue
        st = (data.get("transaction_status") or "").upper()
        if st == "SUCCESS" and p.status == PaymentStatus.pending:
            p.status = PaymentStatus.success
            p.paid_at = datetime.now(timezone.utc).replace(tzinfo=None)
            _activate_subscription(db, p)
            updated += 1
        elif st in {"FAILED", "CANCELLED"}:
            p.status = PaymentStatus.failed
            p.failure_reason = data.get("message") or st
    if updated:
        audit(db, user, "billing.refresh", {"activated": updated})
        db.commit()
    return {"checked": True, "activated": updated}
