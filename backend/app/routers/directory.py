from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import audit, get_current_user, require_org_scope, require_roles
from ..models import Department, Org, Participant, RoleEnum, User
from ..schemas import (
    DepartmentCreate, DepartmentOut, ParticipantCreate, ParticipantImport,
    ParticipantOut, UserCreate, UserOut,
)
from ..security import hash_password

router = APIRouter(tags=["directory"])


def _dept_name(db: Session, pid: str | None):
    if not pid:
        return None
    d = db.get(Department, pid)
    return d.name if d else None


def participant_out(db: Session, p: Participant) -> ParticipantOut:
    return ParticipantOut(
        id=p.id, email=p.email, full_name=p.full_name, department_id=p.department_id,
        department_name=_dept_name(db, p.department_id), organization_id=p.organization_id,
        awareness_score=p.awareness_score, trainings_completed=p.trainings_completed,
        created_at=p.created_at,
    )


# ---------- Users ----------
@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(User)
    if user.role == RoleEnum.org_admin:
        q = q.filter(User.organization_id == user.organization_id)
    elif user.role == RoleEnum.participant:
        raise HTTPException(403, "Not permitted")
    return q.all()


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, request: Request, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    if user.role == RoleEnum.participant:
        raise HTTPException(403, "Not permitted")
    if user.role == RoleEnum.org_admin:
        if payload.role == RoleEnum.super_admin.value:
            raise HTTPException(403, "Cannot create super admins")
        payload.organization_id = user.organization_id
    if payload.role not in [r.value for r in RoleEnum]:
        raise HTTPException(400, "Invalid role")
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(409, "Email already registered")
    new_user = User(email=payload.email.lower(), hashed_password=hash_password(payload.password),
                    full_name=payload.full_name, role=RoleEnum(payload.role),
                    organization_id=payload.organization_id)
    db.add(new_user)
    audit(db, user, "user.create", {"email": new_user.email, "role": payload.role}, request)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.patch("/users/{user_id}/toggle")
def toggle_user(user_id: str, request: Request, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    if user.role == RoleEnum.org_admin and target.organization_id != user.organization_id:
        raise HTTPException(403, "Access denied")
    if target.id == user.id:
        raise HTTPException(400, "Cannot disable yourself")
    target.is_active = not target.is_active
    audit(db, user, "user.toggle", {"user_id": user_id, "active": target.is_active}, request)
    db.commit()
    return {"id": target.id, "is_active": target.is_active}


# ---------- Departments ----------
@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(org_id: str | None = None, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    q = db.query(Department)
    if user.role != RoleEnum.super_admin:
        q = q.filter(Department.organization_id == user.organization_id)
    if org_id:
        q = q.filter(Department.organization_id == org_id)
    return q.all()


@router.post("/departments", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(payload: DepartmentCreate, request: Request, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    require_org_scope(user, payload.organization_id)
    d = Department(name=payload.name, organization_id=payload.organization_id)
    db.add(d)
    audit(db, user, "department.create", {"name": payload.name}, request)
    db.commit()
    db.refresh(d)
    return d


# ---------- Participants ----------
def _participant_query(db: Session, user: User):
    q = db.query(Participant)
    if user.role != RoleEnum.super_admin:
        q = q.filter(Participant.organization_id == user.organization_id)
    return q


@router.get("/participants", response_model=list[ParticipantOut])
def list_participants(org_id: str | None = None, department_id: str | None = None,
                      search: str | None = None, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    q = _participant_query(db, user)
    if org_id and user.role == RoleEnum.super_admin:
        q = q.filter(Participant.organization_id == org_id)
    if department_id:
        q = q.filter(Participant.department_id == department_id)
    if search:
        like = f"%{search}%"
        q = q.filter(Participant.full_name.ilike(like) | Participant.email.ilike(like))
    return [participant_out(db, p) for p in q.order_by(Participant.full_name).all()]


@router.post("/participants", response_model=ParticipantOut, status_code=status.HTTP_201_CREATED)
def create_participant(payload: ParticipantCreate, request: Request, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    require_org_scope(user, payload.organization_id)
    if user.role == RoleEnum.participant:
        raise HTTPException(403, "Not permitted")
    dup = db.query(Participant).filter(
        Participant.email == payload.email.lower(),
        Participant.organization_id == payload.organization_id).first()
    if dup:
        raise HTTPException(409, "Participant already exists")
    p = Participant(email=payload.email.lower(), full_name=payload.full_name,
                    department_id=payload.department_id, organization_id=payload.organization_id)
    db.add(p)
    audit(db, user, "participant.create", {"email": p.email}, request)
    db.commit()
    db.refresh(p)
    return participant_out(db, p)


@router.post("/participants/import", response_model=dict)
def import_participants(payload: ParticipantImport, request: Request,
                        db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_org_scope(user, payload.organization_id)
    if user.role == RoleEnum.participant:
        raise HTTPException(403, "Not permitted")
    created, skipped = 0, 0
    for row in payload.rows:
        email = (row.get("email") or "").strip().lower()
        name = (row.get("full_name") or row.get("name") or "").strip()
        if not email or "@" not in email or not name:
            skipped += 1
            continue
        exists = db.query(Participant).filter(
            Participant.email == email, Participant.organization_id == payload.organization_id).first()
        if exists:
            skipped += 1
            continue
        db.add(Participant(email=email, full_name=name, department_id=payload.department_id,
                           organization_id=payload.organization_id))
        created += 1
    audit(db, user, "participant.import", {"created": created, "skipped": skipped,
                                           "org": payload.organization_id}, request)
    db.commit()
    return {"created": created, "skipped": skipped}


@router.delete("/participants/{participant_id}")
def delete_participant(participant_id: str, request: Request, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    p = db.get(Participant, participant_id)
    if not p:
        raise HTTPException(404, "Participant not found")
    require_org_scope(user, p.organization_id)
    db.delete(p)
    audit(db, user, "participant.delete", {"email": p.email}, request)
    db.commit()
    return {"deleted": True}
