from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import audit, get_current_user, require_roles
from ..models import Org, RoleEnum, User
from ..schemas import OrgCreate, OrgOut
from ..security import hash_password

router = APIRouter(prefix="/orgs", tags=["organizations"])


@router.get("", response_model=list[OrgOut])
def list_orgs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Org)
    if user.role != RoleEnum.super_admin:
        q = q.filter(Org.id == user.organization_id)
    return q.all()


@router.post("", response_model=OrgOut, status_code=status.HTTP_201_CREATED)
def create_org(payload: OrgCreate, request: Request, db: Session = Depends(get_db),
               user: User = Depends(require_roles(RoleEnum.super_admin))):
    org = Org(name=payload.name, domain=payload.domain)
    db.add(org)
    db.flush()
    audit(db, user, "org.create", {"org_id": org.id, "name": org.name}, request)
    db.commit()
    db.refresh(org)
    return org


@router.patch("/{org_id}/toggle")
def toggle_org(org_id: str, request: Request, db: Session = Depends(get_db),
               user: User = Depends(require_roles(RoleEnum.super_admin))):
    org = db.get(Org, org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    org.is_active = not org.is_active
    audit(db, user, "org.toggle", {"org_id": org_id, "active": org.is_active}, request)
    db.commit()
    return {"id": org.id, "is_active": org.is_active}
