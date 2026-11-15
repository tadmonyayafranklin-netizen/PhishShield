"""Report generation: CSV exports and simple PDF summaries."""
import csv
import io
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import audit, get_current_user, org_is_premium
from ..models import Campaign, Participant, Report, RoleEnum, User

router = APIRouter(prefix="/reports", tags=["reports"])


def _scope(db: Session, user: User):
    q = db.query(Participant)
    if user.role != RoleEnum.super_admin:
        q = q.filter(Participant.organization_id == user.organization_id)
    return q


@router.get("/participants.csv")
def participants_csv(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = _scope(db, user).order_by(Participant.full_name).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["name", "email", "department_id", "awareness_score", "trainings_completed"])
    for p in rows:
        w.writerow([p.full_name, p.email, p.department_id or "", p.awareness_score,
                    p.trainings_completed])
    buf.seek(0)
    audit(db, user, "report.generate", {"type": "participants.csv"})
    db.commit()
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=participants.csv"})


@router.get("/campaign/{campaign_id}.csv")
def campaign_csv(campaign_id: str, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    c = db.get(Campaign, campaign_id)
    if not c or (user.role != RoleEnum.super_admin and c.organization_id != user.organization_id):
        raise HTTPException(404, "Campaign not found")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["participant", "email", "delivered", "opened", "clicked", "reported", "completed"])
    for link in c.participant_links:
        p = link.participant
        types = {e.event_type for e in link.events}
        w.writerow([p.full_name if p else "", p.email if p else "",
                    int("delivered" in types), int("opened" in types), int("clicked" in types),
                    int("reported" in types), int("completed" in types)])
    buf.seek(0)
    audit(db, user, "report.generate", {"type": "campaign.csv", "campaign": campaign_id})
    db.commit()
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename=campaign_{campaign_id}.csv"})


@router.get("/campaign/{campaign_id}.pdf")
def campaign_pdf(campaign_id: str, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    c = db.get(Campaign, campaign_id)
    if not c or (user.role != RoleEnum.super_admin and c.organization_id != user.organization_id):
        raise HTTPException(404, "Campaign not found")
    if not org_is_premium(db, c.organization_id) and user.role != RoleEnum.super_admin:
        raise HTTPException(403, "PDF reports require the Premium plan")

    total = len(c.participant_links)
    counts = {"delivered": 0, "opened": 0, "clicked": 0, "reported": 0, "completed": 0}
    for link in c.participant_links:
        types = {e.event_type for e in link.events}
        for t in counts:
            if t in types:
                counts[t] += 1

    buf = io.BytesIO()
    cv = canvas.Canvas(buf, pagesize=letter)
    w, h = letter
    y = h - 60
    cv.setFont("Helvetica-Bold", 18)
    cv.drawString(50, y, "PhishShield Awareness Report")
    y -= 30
    cv.setFont("Helvetica", 12)
    cv.drawString(50, y, f"Campaign: {c.name}")
    y -= 18
    cv.drawString(50, y, f"Status: {c.status.value}   Template: {c.template.name if c.template else '-'}")
    y -= 18
    cv.drawString(50, y, f"Generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}")
    y -= 30
    cv.setFont("Helvetica-Bold", 13)
    cv.drawString(50, y, "Engagement Summary")
    y -= 22
    cv.setFont("Helvetica", 12)
    for k, v in counts.items():
        rate = round(v / total * 100, 1) if total else 0
        cv.drawString(70, y, f"{k.capitalize()}: {v} / {total} ({rate}%)")
        y -= 18
    y -= 14
    cv.setFont("Helvetica-Oblique", 10)
    cv.drawString(50, y, "This report contains privacy-conscious engagement indicators only. "
                         "No credentials or sensitive data were collected.")
    cv.save()
    buf.seek(0)

    db.add(Report(name=f"{c.name} report", report_type="pdf",
                  organization_id=c.organization_id, campaign_id=c.id, generated_by=user.id))
    audit(db, user, "report.generate", {"type": "campaign.pdf", "campaign": campaign_id})
    db.commit()
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=campaign_{campaign_id}.pdf"})
