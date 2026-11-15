from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------
class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=8)
    full_name: str
    role: str = "participant"
    organization_id: Optional[str] = None


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    organization_id: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Orgs / Departments / Participants ----------
class OrgCreate(BaseModel):
    name: str
    domain: Optional[str] = None


class OrgOut(OrgCreate):
    id: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DepartmentCreate(BaseModel):
    name: str
    organization_id: str


class DepartmentOut(DepartmentCreate):
    id: str

    class Config:
        from_attributes = True


class ParticipantCreate(BaseModel):
    email: str
    full_name: str
    department_id: Optional[str] = None
    organization_id: str


class ParticipantOut(BaseModel):
    id: str
    email: str
    full_name: str
    department_id: Optional[str]
    department_name: Optional[str] = None
    organization_id: str
    awareness_score: float
    trainings_completed: int
    created_at: datetime


class ParticipantImport(BaseModel):
    organization_id: str
    department_id: Optional[str] = None
    rows: list[dict[str, str]]  # [{email, full_name}]


# ---------- Templates ----------
class TemplateCreate(BaseModel):
    name: str
    description: str
    difficulty: str = "beginner"
    educational_objective: str
    subject: str
    body: str
    warning_signs: str
    lesson_module_id: Optional[str] = None


class TemplateOut(TemplateCreate):
    id: str
    is_active: bool
    is_authorized_simulation: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Campaigns ----------
class CampaignCreate(BaseModel):
    name: str
    description: str = ""
    organization_id: str
    template_id: str
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    participant_ids: list[str] = []


class CampaignOut(BaseModel):
    id: str
    name: str
    description: str
    organization_id: str
    template_id: str
    template_name: Optional[str] = None
    status: str
    start_at: Optional[datetime]
    end_at: Optional[datetime]
    scheduled_at: Optional[datetime]
    participant_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class CampaignStatusUpdate(BaseModel):
    status: str  # scheduled/active/paused/completed/cancelled


class EventCreate(BaseModel):
    event_type: str
    token: str


# ---------- Training ----------
class ModuleCreate(BaseModel):
    title: str
    description: str = ""
    category: str
    content: str
    duration_minutes: int = 10
    organization_id: Optional[str] = None


class ModuleOut(ModuleCreate):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class QuizCreate(BaseModel):
    module_id: str
    title: str
    questions: list[dict[str, Any]]
    passing_score: float = 70.0


class QuizOut(BaseModel):
    id: str
    module_id: str
    title: str
    questions: list[dict[str, Any]]  # correct_index stripped for participants
    passing_score: float

    class Config:
        from_attributes = True


class QuizSubmit(BaseModel):
    participant_id: str
    answers: dict[str, int]  # question_id -> chosen option index


class QuizResultOut(BaseModel):
    id: str
    quiz_id: str
    participant_id: str
    score: float
    passed: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Misc ----------
class NotificationOut(BaseModel):
    id: str
    title: str
    message: str
    kind: str
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Billing ----------
class SubscribeRequest(BaseModel):
    plan: str = "premium"


class PlanOut(BaseModel):
    id: str
    name: str
    price: float
    currency: str
    interval_days: Optional[int]
    features: list[str]


class SubscriptionOut(BaseModel):
    plan: str
    status: str
    is_premium: bool
    current_period_end: Optional[datetime]
    currency: str
    premium_price: float
    premium_days: int
    payunit_enabled: bool
    plans: list[PlanOut]


class PaymentOut(BaseModel):
    id: str
    plan: str
    amount: float
    currency: str
    transaction_id: str
    provider_reference: Optional[str]
    status: str
    failure_reason: Optional[str]
    created_at: datetime
    paid_at: Optional[datetime]

    class Config:
        from_attributes = True


class AuditLogOut(BaseModel):
    id: str
    user_email: Optional[str]
    action: str
    detail: str
    ip_address: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
