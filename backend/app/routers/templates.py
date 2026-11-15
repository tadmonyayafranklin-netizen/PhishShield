import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import audit, get_current_user
from ..models import Difficulty, RoleEnum, SimulationTemplate, User
from ..schemas import TemplateCreate, TemplateOut

router = APIRouter(prefix="/templates", tags=["templates"])


def tpl_out(t: SimulationTemplate) -> TemplateOut:
    return TemplateOut(
        id=t.id, name=t.name, description=t.description, difficulty=t.difficulty.value,
        educational_objective=t.educational_objective, subject=t.subject, body=t.body,
        warning_signs=t.warning_signs, lesson_module_id=t.lesson_module_id,
        is_active=t.is_active, is_authorized_simulation=t.is_authorized_simulation,
        created_at=t.created_at,
    )


@router.get("", response_model=list[TemplateOut])
def list_templates(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(SimulationTemplate).filter(SimulationTemplate.is_active.is_(True))
    if user.role == RoleEnum.participant:
        q = q.filter(SimulationTemplate.is_authorized_simulation.is_(True))
    return [tpl_out(t) for t in q.order_by(SimulationTemplate.name).all()]


@router.post("", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(payload: TemplateCreate, request: Request, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    if user.role == RoleEnum.participant:
        raise HTTPException(403, "Not permitted")
    if payload.difficulty not in [d.value for d in Difficulty]:
        raise HTTPException(400, "Invalid difficulty")
    # Guard: bodies must not request credentials
    lowered = payload.body.lower()
    for banned in ("password:", "enter your password", "ssn", "social security", "credit card number"):
        if banned in lowered:
            raise HTTPException(400, f"Template body must not collect sensitive data ('{banned}')")
    t = SimulationTemplate(
        name=payload.name, description=payload.description, difficulty=Difficulty(payload.difficulty),
        educational_objective=payload.educational_objective, subject=payload.subject,
        body=payload.body, warning_signs=payload.warning_signs,
        lesson_module_id=payload.lesson_module_id)
    db.add(t)
    audit(db, user, "template.create", {"name": t.name}, request)
    db.commit()
    db.refresh(t)
    return tpl_out(t)


@router.patch("/{template_id}/toggle")
def toggle_template(template_id: str, request: Request, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    if user.role == RoleEnum.participant:
        raise HTTPException(403, "Not permitted")
    t = db.get(SimulationTemplate, template_id)
    if not t:
        raise HTTPException(404, "Template not found")
    t.is_active = not t.is_active
    audit(db, user, "template.toggle", {"template_id": template_id}, request)
    db.commit()
    return {"id": t.id, "is_active": t.is_active}
