import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_roles
from ..models import AuditLog, RoleEnum, User
from ..schemas import AuditLogOut

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogOut])
def list_audit(action: str | None = None, user_email: str | None = None,
               limit: int = 200, db: Session = Depends(get_db),
               user: User = Depends(require_roles(RoleEnum.super_admin, RoleEnum.org_admin))):
    q = db.query(AuditLog)
    if user.role == RoleEnum.org_admin:
        q = q.filter(AuditLog.organization_id == user.organization_id)
    if action:
        q = q.filter(AuditLog.action.ilike(f"%{action}%"))
    if user_email:
        q = q.filter(AuditLog.user_email.ilike(f"%{user_email}%"))
    return q.order_by(AuditLog.created_at.desc()).limit(min(limit, 1000)).all()


@router.get("/export")
def export_audit(db: Session = Depends(get_db),
                 user: User = Depends(require_roles(RoleEnum.super_admin, RoleEnum.org_admin))):
    from fastapi.responses import PlainTextResponse
    q = db.query(AuditLog)
    if user.role == RoleEnum.org_admin:
        q = q.filter(AuditLog.organization_id == user.organization_id)
    rows = q.order_by(AuditLog.created_at.desc()).limit(5000).all()
    lines = ["timestamp,user_email,action,detail,ip"]
    for r in rows:
        detail = (r.detail or "").replace('"', '""')
        lines.append(f'{r.created_at.isoformat()},{r.user_email or ""},{r.action},"{detail}",{r.ip_address or ""}')
    return PlainTextResponse("\n".join(lines), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=audit_log.csv"})
