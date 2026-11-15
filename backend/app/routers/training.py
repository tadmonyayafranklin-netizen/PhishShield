import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import audit, get_current_user
from ..models import Participant, Quiz, QuizResult, RoleEnum, TrainingModule, User
from ..schemas import (
    ModuleCreate, ModuleOut, QuizCreate, QuizOut, QuizResultOut, QuizSubmit,
)

router = APIRouter(prefix="/training", tags=["training"])


def _mod_out(m: TrainingModule) -> ModuleOut:
    return ModuleOut(id=m.id, title=m.title, description=m.description, category=m.category,
                     content=m.content, duration_minutes=m.duration_minutes,
                     organization_id=m.organization_id, created_at=m.created_at)


@router.get("/modules", response_model=list[ModuleOut])
def list_modules(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(TrainingModule).filter(
        (TrainingModule.organization_id == user.organization_id)
        | (TrainingModule.organization_id.is_(None)))
    return [_mod_out(m) for m in q.order_by(TrainingModule.category, TrainingModule.title).all()]


@router.post("/modules", response_model=ModuleOut, status_code=status.HTTP_201_CREATED)
def create_module(payload: ModuleCreate, request: Request, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    if user.role == RoleEnum.participant:
        raise HTTPException(403, "Not permitted")
    m = TrainingModule(**payload.model_dump())
    db.add(m)
    audit(db, user, "training.module_create", {"title": m.title}, request)
    db.commit()
    db.refresh(m)
    return _mod_out(m)


@router.get("/quizzes", response_model=list[QuizOut])
def list_quizzes(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    out = []
    for q in db.query(Quiz).all():
        questions = json.loads(q.questions)
        safe = [{k: v for k, v in qq.items() if k != "correct_index"} for qq in questions]
        out.append(QuizOut(id=q.id, module_id=q.module_id, title=q.title,
                           questions=safe, passing_score=q.passing_score))
    return out


@router.post("/quizzes", response_model=QuizOut, status_code=status.HTTP_201_CREATED)
def create_quiz(payload: QuizCreate, request: Request, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    if user.role == RoleEnum.participant:
        raise HTTPException(403, "Not permitted")
    for qq in payload.questions:
        if "correct_index" not in qq or "options" not in qq:
            raise HTTPException(400, "Each question needs options and correct_index")
    q = Quiz(module_id=payload.module_id, title=payload.title,
             questions=json.dumps(payload.questions), passing_score=payload.passing_score)
    db.add(q)
    audit(db, user, "training.quiz_create", {"title": q.title}, request)
    db.commit()
    db.refresh(q)
    return QuizOut(id=q.id, module_id=q.module_id, title=q.title,
                   questions=[{k: v for k, v in x.items() if k != "correct_index"}
                              for x in payload.questions],
                   passing_score=q.passing_score)


@router.post("/quizzes/{quiz_id}/submit", response_model=dict)
def submit_quiz(quiz_id: str, payload: QuizSubmit, db: Session = Depends(get_db)):
    q = db.get(Quiz, quiz_id)
    p = db.get(Participant, payload.participant_id)
    if not q or not p:
        raise HTTPException(404, "Quiz or participant not found")
    questions = json.loads(q.questions)
    correct = 0
    graded = {}
    for qq in questions:
        chosen = payload.answers.get(qq["id"])
        is_correct = chosen == qq["correct_index"]
        graded[qq["id"]] = {
            "correct": is_correct,
            "correct_index": qq["correct_index"],
            "explanation": qq.get("explanation", ""),
        }
        if is_correct:
            correct += 1
    score = round(correct / len(questions) * 100, 1) if questions else 0
    passed = score >= q.passing_score
    result = QuizResult(quiz_id=q.id, participant_id=p.id, score=score,
                        answers=json.dumps(payload.answers), passed=passed)
    db.add(result)
    # Update participant aggregates
    p.trainings_completed = (p.trainings_completed or 0) + (1 if passed else 0)
    p.awareness_score = round(min(100.0, (p.awareness_score or 0) + (score / 20 if passed else 0)), 1)
    db.commit()
    return {"score": score, "passed": passed, "passing_score": q.passing_score,
            "correct": correct, "total": len(questions), "details": graded}


@router.get("/results/{participant_id}", response_model=list[QuizResultOut])
def participant_results(participant_id: str, db: Session = Depends(get_db)):
    return db.query(QuizResult).filter(QuizResult.participant_id == participant_id) \
             .order_by(QuizResult.created_at.desc()).all()
