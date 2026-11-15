import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import (
    FREE_MAX_ACTIVE_CAMPAIGNS, FREE_MAX_PARTICIPANTS_PER_CAMPAIGN,
    audit, get_current_user, org_is_premium, require_org_scope,
)
from ..models import (
    Campaign, CampaignEvent, CampaignParticipant, CampaignStatus, Notification,
    Participant, RoleEnum, SimulationTemplate, User, new_id,
)
from ..schemas import CampaignCreate, CampaignOut, CampaignStatusUpdate
from ..security import new_token
from ..services.email import send_simulation_email

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

VALID_TRANSITIONS = {
    CampaignStatus.draft: {CampaignStatus.scheduled, CampaignStatus.cancelled},
    CampaignStatus.scheduled: {CampaignStatus.active, CampaignStatus.cancelled, CampaignStatus.draft},
    CampaignStatus.active: {CampaignStatus.paused, CampaignStatus.completed, CampaignStatus.cancelled},
    CampaignStatus.paused: {CampaignStatus.active, CampaignStatus.cancelled},
    CampaignStatus.completed: set(),
    CampaignStatus.cancelled: set(),
}


def _out(c: Campaign) -> CampaignOut:
    return CampaignOut(
        id=c.id, name=c.name, description=c.description, organization_id=c.organization_id,
        template_id=c.template_id, template_name=c.template.name if c.template else None,
        status=c.status.value, start_at=c.start_at, end_at=c.end_at, scheduled_at=c.scheduled_at,
        participant_count=len(c.participant_links), created_at=c.created_at)


def _get_scoped_campaign(db: Session, campaign_id: str, user: User) -> Campaign:
    c = db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(404, "Campaign not found")
    require_org_scope(user, c.organization_id)
    return c


@router.get("", response_model=list[CampaignOut])
def list_campaigns(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Campaign)
    if user.role != RoleEnum.super_admin:
        q = q.filter(Campaign.organization_id == user.organization_id)
    return [_out(c) for c in q.order_by(Campaign.created_at.desc()).all()]


@router.post("", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
def create_campaign(payload: CampaignCreate, request: Request, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    if user.role == RoleEnum.participant:
        raise HTTPException(403, "Not permitted")
    require_org_scope(user, payload.organization_id)
    premium = user.role == RoleEnum.super_admin or org_is_premium(db, payload.organization_id)
    if not premium:
        concurrent = db.query(func.count(Campaign.id)).filter(
            Campaign.organization_id == payload.organization_id,
            Campaign.status.in_([CampaignStatus.active, CampaignStatus.scheduled]),
        ).scalar() or 0
        if concurrent >= FREE_MAX_ACTIVE_CAMPAIGNS:
            raise HTTPException(403, "Free plan allows only 1 active or scheduled campaign. Upgrade to Premium for unlimited campaigns.")
        if len(payload.participant_ids) > FREE_MAX_PARTICIPANTS_PER_CAMPAIGN:
            raise HTTPException(403, f"Free plan allows up to {FREE_MAX_PARTICIPANTS_PER_CAMPAIGN} participants per campaign. Upgrade to Premium for unlimited participants.")
    tpl = db.get(SimulationTemplate, payload.template_id)
    if not tpl or not tpl.is_active:
        raise HTTPException(400, "Invalid or inactive template")
    c = Campaign(name=payload.name, description=payload.description,
                 organization_id=payload.organization_id, template_id=payload.template_id,
                 start_at=payload.start_at, end_at=payload.end_at, created_by=user.id)
    db.add(c)
    db.flush()
    added = 0
    for pid in payload.participant_ids:
        p = db.get(Participant, pid)
        if p and p.organization_id == payload.organization_id:
            db.add(CampaignParticipant(campaign_id=c.id, participant_id=p.id, token=new_token()))
            added += 1
    audit(db, user, "campaign.create", {"campaign_id": c.id, "name": c.name,
                                        "participants": added}, request)
    db.commit()
    db.refresh(c)
    return _out(c)


@router.get("/{campaign_id}", response_model=CampaignOut)
def get_campaign(campaign_id: str, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    return _out(_get_scoped_campaign(db, campaign_id, user))


@router.patch("/{campaign_id}/status", response_model=CampaignOut)
def set_status(campaign_id: str, payload: CampaignStatusUpdate, request: Request,
               db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = _get_scoped_campaign(db, campaign_id, user)
    try:
        target = CampaignStatus(payload.status)
    except ValueError:
        raise HTTPException(400, "Invalid status")
    if target not in VALID_TRANSITIONS[c.status]:
        raise HTTPException(400, f"Cannot transition from {c.status.value} to {target.value}")
    c.status = target
    if target == CampaignStatus.active:
        _dispatch_campaign(db, c)
        notify_org_admins(db, c, f"Campaign '{c.name}' is now active",
                          "Participants have been notified. Track engagement in analytics.")
    elif target == CampaignStatus.completed:
        notify_org_admins(db, c, f"Campaign '{c.name}' completed",
                          "Review analytics and export the awareness report.")
    audit(db, user, "campaign.status", {"campaign_id": c.id, "status": target.value}, request)
    db.commit()
    return _out(c)


def _dispatch_campaign(db: Session, c: Campaign):
    """Send simulation emails to enrolled participants (authorized recipients only)."""
    tpl = c.template
    now = datetime.now(timezone.utc)
    for link in c.participant_links:
        p = link.participant
        if not p or link.email_sent:
            continue
        landing = f"{settings.simulation_base_url}/sim/{link.token}"
        body = tpl.body.replace("{{name}}", p.full_name.split()[0]).replace("{{token}}", link.token)
        result = send_simulation_email(p.email, p.full_name, tpl.subject, body)
        if result.get("mode") == "blocked":
            continue
        link.email_sent = True
        link.email_sent_at = now
        db.add(CampaignEvent(campaign_id=c.id, campaign_participant_id=link.id,
                             event_type="delivered"))


def notify_org_admins(db: Session, c: Campaign, title: str, message: str):
    admins = db.query(User).filter(User.organization_id == c.organization_id,
                                   User.role == RoleEnum.org_admin, User.is_active.is_(True)).all()
    for a in admins:
        db.add(Notification(user_id=a.id, organization_id=c.organization_id,
                            title=title, message=message, kind="campaign"))


@router.get("/{campaign_id}/stats")
def campaign_stats(campaign_id: str, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    c = _get_scoped_campaign(db, campaign_id, user)
    links = db.query(CampaignParticipant).filter(CampaignParticipant.campaign_id == c.id).all()
    total = len(links)
    counts = {"delivered": 0, "opened": 0, "clicked": 0, "reported": 0, "completed": 0}
    for link in links:
        types = {e.event_type for e in link.events}
        for t in counts:
            if t in types:
                counts[t] += 1
    return {
        "campaign_id": c.id, "name": c.name, "status": c.status.value,
        "total_participants": total, **counts,
        "open_rate": round(counts["opened"] / total * 100, 1) if total else 0,
        "click_rate": round(counts["clicked"] / total * 100, 1) if total else 0,
        "report_rate": round(counts["reported"] / total * 100, 1) if total else 0,
        "completion_rate": round(counts["completed"] / total * 100, 1) if total else 0,
    }


# ---------- Public simulation landing (token-based, no auth) ----------

@router.get("/public/landing/{token}")
def landing_info(token: str, db: Session = Depends(get_db)):
    link = db.query(CampaignParticipant).filter(CampaignParticipant.token == token).first()
    if not link:
        raise HTTPException(404, "Simulation link invalid or expired")
    c = link.campaign
    tpl = c.template
    p = link.participant
    body = tpl.body.replace("{{name}}", p.full_name.split()[0] if p else "there") \
                     .replace("{{token}}", token)
    # record click
    db.add(CampaignEvent(campaign_id=c.id, campaign_participant_id=link.id, event_type="clicked"))
    db.commit()
    return {
        "simulation": True,
        "authorized": True,
        "campaign": c.name,
        "template_name": tpl.name,
        "educational_objective": tpl.educational_objective,
        "warning_signs": [s.strip() for s in tpl.warning_signs.split(";") if s.strip()],
        "email_subject": tpl.subject,
        "email_body": body,
        "lesson": tpl.lesson_module_id,
        "participant_first_name": p.full_name.split()[0] if p else "",
    }


@router.post("/public/landing/{token}/event")
def landing_event(token: str, event_type: str, db: Session = Depends(get_db)):
    if event_type not in {"opened", "reported", "completed"}:
        raise HTTPException(400, "Invalid event type")
    link = db.query(CampaignParticipant).filter(CampaignParticipant.token == token).first()
    if not link:
        raise HTTPException(404, "Invalid token")
    db.add(CampaignEvent(campaign_id=link.campaign_id, campaign_participant_id=link.id,
                         event_type=event_type))
    if event_type == "completed":
        # bump participant trainings + small score nudge
        p = link.participant
        if p:
            p.trainings_completed = (p.trainings_completed or 0) + 1
            p.awareness_score = min(100.0, (p.awareness_score or 0) + 2.5)
    db.commit()
    return {"ok": True}
