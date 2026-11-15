from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import PlanEnum, RoleEnum, Subscription, SubscriptionStatus, User
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User inactive or not found")
    return user


def require_roles(*roles: RoleEnum):
    def checker(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user
    return checker


def require_org_scope(user: User, org_id: str | None):
    """Super admins may access any org; others only their own."""
    if user.role == RoleEnum.super_admin:
        return
    if org_id and user.organization_id != org_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access to this organization is denied")


# ---------- Plans / premium gating ----------

# Free-plan limits
FREE_MAX_ACTIVE_CAMPAIGNS = 1
FREE_MAX_PARTICIPANTS_PER_CAMPAIGN = 100


def get_subscription(db: Session, org_id: str | None) -> Subscription | None:
    if not org_id:
        return None
    return db.query(Subscription).filter(Subscription.organization_id == org_id).first()


def org_is_premium(db: Session, org_id: str | None) -> bool:
    sub = get_subscription(db, org_id)
    if not sub or sub.plan != PlanEnum.premium:
        return False
    if sub.status == SubscriptionStatus.cancelled:
        return False
    from datetime import datetime, timezone
    if sub.current_period_end and sub.current_period_end < datetime.now(timezone.utc).replace(tzinfo=None):
        return False
    return True


def require_premium(db: Session, user: User):
    """Super admins bypass plan checks; org users need an active premium subscription."""
    if user.role == RoleEnum.super_admin:
        return
    if not org_is_premium(db, user.organization_id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This feature requires the Premium plan. Upgrade under Billing.",
        )


def audit(db: Session, user: User | None, action: str, detail: dict | None = None, request: Request | None = None):
    from .models import AuditLog
    ip = request.client.host if request and request.client else None
    db.add(AuditLog(
        user_id=user.id if user else None,
        user_email=user.email if user else None,
        organization_id=user.organization_id if user else None,
        action=action,
        detail=__import__("json").dumps(detail or {}),
        ip_address=ip,
    ))
