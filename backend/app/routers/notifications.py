from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Notification, User
from ..schemas import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _visible_query(db: Session, user: User):
    return db.query(Notification).filter(
        (Notification.user_id == user.id) | (Notification.organization_id == user.organization_id))


@router.get("", response_model=list[NotificationOut])
def list_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _visible_query(db, user).order_by(Notification.created_at.desc()).limit(50).all()


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _visible_query(db, user).filter(Notification.read.is_(False)).update(
        {"read": True}, synchronize_session=False)
    db.commit()
    return {"ok": True}


@router.post("/{notification_id}/read")
def mark_read(notification_id: str, db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    n = _visible_query(db, user).filter(Notification.id == notification_id).first()
    if not n:
        raise HTTPException(404, "Not found")
    n.read = True
    db.commit()
    return {"ok": True}
