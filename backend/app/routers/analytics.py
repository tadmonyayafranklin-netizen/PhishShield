from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, org_is_premium, require_premium
from ..models import (
    AuditLog, Campaign, CampaignEvent, CampaignParticipant, CampaignStatus,
    Department, Participant, RoleEnum, User,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _scope_orgs(db: Session, user: User):
    if user.role == RoleEnum.super_admin:
        return None
    return user.organization_id


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    org_id = _scope_orgs(db, user)

    def org_filter(model):
        q = db.query(model)
        return q if org_id is None else q.filter(model.organization_id == org_id)

    participants = org_filter(Participant).count()
    campaigns = org_filter(Campaign)
    total_campaigns = campaigns.count()
    active = campaigns.filter(Campaign.status == CampaignStatus.active).count()
    completed = campaigns.filter(Campaign.status == CampaignStatus.completed).count()

    events_q = db.query(CampaignEvent).join(CampaignParticipant,
        CampaignEvent.campaign_participant_id == CampaignParticipant.id).join(
        Campaign, CampaignParticipant.campaign_id == Campaign.id)
    if org_id:
        events_q = events_q.filter(Campaign.organization_id == org_id)
    sent = events_q.filter(CampaignEvent.event_type == "delivered").count()
    interactions = events_q.filter(CampaignEvent.event_type.in_(["opened", "clicked"])).count()

    avg_score = org_filter(Participant).with_entities(func.avg(Participant.awareness_score)).scalar() or 0

    # completion rate across campaigns
    links = db.query(CampaignParticipant).join(Campaign, CampaignParticipant.campaign_id == Campaign.id)
    if org_id:
        links = links.filter(Campaign.organization_id == org_id)
    total_links = links.count()
    done_events = events_q.filter(CampaignEvent.event_type == "completed").count()
    completion_rate = round(done_events / total_links * 100, 1) if total_links else 0

    # recent activity (audit + notifications)
    recent = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(8).all()

    return {
        "total_participants": participants,
        "active_campaigns": active,
        "completed_campaigns": completed,
        "total_campaigns": total_campaigns,
        "emails_sent": sent,
        "training_interactions": interactions,
        "avg_awareness_score": round(float(avg_score), 1),
        "completion_rate": completion_rate,
        "is_premium": user.role == RoleEnum.super_admin or org_is_premium(db, user.organization_id),
        "recent_activity": [
            {"id": a.id, "action": a.action, "user": a.user_email,
             "detail": a.detail[:120], "at": a.created_at.isoformat()}
            for a in recent
        ],
    }


@router.get("/campaigns-over-time")
def campaigns_over_time(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    org_id = _scope_orgs(db, user)
    q = db.query(Campaign)
    if org_id:
        q = q.filter(Campaign.organization_id == org_id)
    camps = q.order_by(Campaign.created_at).all()
    out = []
    for c in camps:
        sent = sum(1 for l in c.participant_links if l.email_sent)
        clicked = db.query(func.count(CampaignEvent.id)).filter(
            CampaignEvent.campaign_id == c.id, CampaignEvent.event_type == "clicked").scalar() or 0
        out.append({
            "date": (c.start_at or c.created_at).strftime("%Y-%m-%d"),
            "name": c.name, "status": c.status.value,
            "sent": sent, "clicked": clicked,
        })
    return out


@router.get("/department-scores")
def department_scores(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_premium(db, user)
    org_id = _scope_orgs(db, user)
    q = db.query(Participant).join(Department, Participant.department_id == Department.id) \
        .filter(Participant.department_id.isnot(None))
    if org_id:
        q = q.filter(Participant.organization_id == org_id)
    rows = q.with_entities(Department.name, func.avg(Participant.awareness_score),
                           func.count(Participant.id)).group_by(Department.name).all()
    return [{"department": r[0], "avg_score": round(float(r[1] or 0), 1), "count": r[2]}
            for r in rows]


@router.get("/monthly-trends")
def monthly_trends(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_premium(db, user)
    org_id = _scope_orgs(db, user)
    q = db.query(CampaignEvent, Campaign).join(
        CampaignParticipant, CampaignEvent.campaign_participant_id == CampaignParticipant.id
    ).join(Campaign, CampaignParticipant.campaign_id == Campaign.id)
    if org_id:
        q = q.filter(Campaign.organization_id == org_id)
    events = q.all()
    monthly: dict[str, dict] = {}
    for ev, camp in events:
        key = ev.created_at.strftime("%Y-%m")
        m = monthly.setdefault(key, {"month": key, "delivered": 0, "opened": 0,
                                     "clicked": 0, "reported": 0, "completed": 0})
        if ev.event_type in m:
            m[ev.event_type] += 1
    return sorted(monthly.values(), key=lambda x: x["month"])


@router.get("/campaign-compare")
def campaign_compare(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_premium(db, user)
    org_id = _scope_orgs(db, user)
    q = db.query(Campaign)
    if org_id:
        q = q.filter(Campaign.organization_id == org_id)
    rows = []
    for c in q.order_by(Campaign.created_at.desc()).limit(10).all():
        total = len(c.participant_links)
        counts = {"opened": 0, "clicked": 0, "reported": 0, "completed": 0}
        for link in c.participant_links:
            for e in link.events:
                if e.event_type in counts:
                    counts[e.event_type] += 1
        rows.append({
            "id": c.id, "name": c.name, "status": c.status.value,
            "total": total,
            "open_rate": round(counts["opened"] / total * 100, 1) if total else 0,
            "click_rate": round(counts["clicked"] / total * 100, 1) if total else 0,
            "report_rate": round(counts["reported"] / total * 100, 1) if total else 0,
            "completion_rate": round(counts["completed"] / total * 100, 1) if total else 0,
        })
    return rows


@router.get("/top-reports")
def top_reports(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    org_id = _scope_orgs(db, user)
    q = db.query(Participant).filter(Participant.department_id.isnot(None))
    if org_id:
        q = q.filter(Participant.organization_id == org_id)
    rows = q.order_by(Participant.awareness_score.desc()).limit(10).all()
    return [{"id": p.id, "name": p.full_name, "email": p.email,
             "score": p.awareness_score, "trainings": p.trainings_completed} for p in rows]
