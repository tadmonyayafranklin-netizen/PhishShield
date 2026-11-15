"""PhishShield data models."""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String,
    Text, UniqueConstraint, Index,
)
from sqlalchemy.orm import DeclarativeBase, relationship


def utcnow():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


def new_id():
    return str(uuid.uuid4())


class RoleEnum(str, enum.Enum):
    super_admin = "super_admin"
    org_admin = "org_admin"
    participant = "participant"


class CampaignStatus(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    active = "active"
    paused = "paused"
    completed = "completed"
    cancelled = "cancelled"


class Difficulty(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class Org(Base):
    __tablename__ = "organizations"
    id = Column(String, primary_key=True, default=new_id)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=True, index=True)  # approved email domain
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    users = relationship("User", back_populates="organization")
    departments = relationship("Department", back_populates="organization")


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=new_id)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False, default=RoleEnum.participant)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True, index=True)
    participant_id = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    organization = relationship("Org", back_populates="users")


class Department(Base):
    __tablename__ = "departments"
    id = Column(String, primary_key=True, default=new_id)
    name = Column(String(255), nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)

    organization = relationship("Org", back_populates="departments")
    participants = relationship("Participant", back_populates="department")


class Participant(Base):
    __tablename__ = "participants"
    id = Column(String, primary_key=True, default=new_id)
    email = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    department_id = Column(String, ForeignKey("departments.id"), nullable=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    awareness_score = Column(Float, default=0.0)
    trainings_completed = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)

    __table_args__ = (UniqueConstraint("email", "organization_id", name="uq_participant_email_org"),)

    department = relationship("Department", back_populates="participants")
    campaign_links = relationship("CampaignParticipant", back_populates="participant")
    quiz_results = relationship("QuizResult", back_populates="participant")


class SimulationTemplate(Base):
    __tablename__ = "simulation_templates"
    id = Column(String, primary_key=True, default=new_id)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    difficulty = Column(Enum(Difficulty), default=Difficulty.beginner)
    educational_objective = Column(Text, nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)  # email body with {{name}} placeholders
    warning_signs = Column(Text, nullable=False)  # JSON-ish list stored as text lines
    lesson_module_id = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_authorized_simulation = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)


class Campaign(Base):
    __tablename__ = "campaigns"
    id = Column(String, primary_key=True, default=new_id)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False, default="")
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    template_id = Column(String, ForeignKey("simulation_templates.id"), nullable=False)
    status = Column(Enum(CampaignStatus), default=CampaignStatus.draft, index=True)
    start_at = Column(DateTime, nullable=True)
    end_at = Column(DateTime, nullable=True)
    scheduled_at = Column(DateTime, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow)

    template = relationship("SimulationTemplate")
    events = relationship("CampaignEvent", back_populates="campaign")
    participant_links = relationship("CampaignParticipant", back_populates="campaign")


class CampaignParticipant(Base):
    __tablename__ = "campaign_participants"
    id = Column(String, primary_key=True, default=new_id)
    campaign_id = Column(String, ForeignKey("campaigns.id"), nullable=False, index=True)
    participant_id = Column(String, ForeignKey("participants.id"), nullable=False, index=True)
    token = Column(String(64), unique=True, nullable=False, index=True)  # landing page token
    email_sent = Column(Boolean, default=False)
    email_sent_at = Column(DateTime, nullable=True)

    __table_args__ = (UniqueConstraint("campaign_id", "participant_id", name="uq_campaign_participant"),)

    campaign = relationship("Campaign", back_populates="participant_links")
    participant = relationship("Participant", back_populates="campaign_links")
    events = relationship("CampaignEvent", back_populates="campaign_participant")


class CampaignEvent(Base):
    """Privacy-conscious engagement events. Never stores credentials."""
    __tablename__ = "campaign_events"
    id = Column(String, primary_key=True, default=new_id)
    campaign_id = Column(String, ForeignKey("campaigns.id"), nullable=False, index=True)
    campaign_participant_id = Column(String, ForeignKey("campaign_participants.id"), nullable=False, index=True)
    event_type = Column(String(64), nullable=False)  # delivered/opened/clicked/reported/completed
    created_at = Column(DateTime, default=utcnow, index=True)

    __table_args__ = (Index("ix_events_type_time", "event_type", "created_at"),)

    campaign = relationship("Campaign")
    campaign_participant = relationship("CampaignParticipant", back_populates="events")


class TrainingModule(Base):
    __tablename__ = "training_modules"
    id = Column(String, primary_key=True, default=new_id)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False, default="")
    category = Column(String(64), nullable=False)  # phishing/social_engineering/passwords/mfa/email_security
    content = Column(Text, nullable=False)
    duration_minutes = Column(Integer, default=10)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True)  # null = global
    created_at = Column(DateTime, default=utcnow)

    quizzes = relationship("Quiz", back_populates="module")


class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(String, primary_key=True, default=new_id)
    module_id = Column(String, ForeignKey("training_modules.id"), nullable=False)
    title = Column(String(255), nullable=False)
    questions = Column(Text, nullable=False)  # JSON: [{id, question, options[], correct_index, explanation}]
    passing_score = Column(Float, default=70.0)

    module = relationship("TrainingModule", back_populates="quizzes")
    results = relationship("QuizResult", back_populates="quiz")


class QuizResult(Base):
    __tablename__ = "quiz_results"
    id = Column(String, primary_key=True, default=new_id)
    quiz_id = Column(String, ForeignKey("quizzes.id"), nullable=False, index=True)
    participant_id = Column(String, ForeignKey("participants.id"), nullable=False, index=True)
    score = Column(Float, nullable=False)
    answers = Column(Text, nullable=False, default="{}")  # JSON of chosen options (no PII)
    passed = Column(Boolean, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    quiz = relationship("Quiz", back_populates="results")
    participant = relationship("Participant", back_populates="quiz_results")


class Report(Base):
    __tablename__ = "reports"
    id = Column(String, primary_key=True, default=new_id)
    name = Column(String(255), nullable=False)
    report_type = Column(String(64), nullable=False)  # pdf / csv
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True)
    campaign_id = Column(String, ForeignKey("campaigns.id"), nullable=True)
    generated_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    kind = Column(String(64), default="info")
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)


class PlanEnum(str, enum.Enum):
    free = "free"
    premium = "premium"


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    expired = "expired"
    cancelled = "cancelled"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    success = "success"
    failed = "failed"


class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(String, primary_key=True, default=new_id)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False,
                              unique=True, index=True)
    plan = Column(Enum(PlanEnum), nullable=False, default=PlanEnum.free)
    status = Column(Enum(SubscriptionStatus), nullable=False,
                    default=SubscriptionStatus.active)
    current_period_end = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    organization = relationship("Org")


class Payment(Base):
    __tablename__ = "payments"
    id = Column(String, primary_key=True, default=new_id)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False, index=True)
    plan = Column(Enum(PlanEnum), nullable=False, default=PlanEnum.premium)
    amount = Column(Float, nullable=False)
    currency = Column(String(8), nullable=False, default="XAF")
    transaction_id = Column(String(64), unique=True, nullable=False, index=True)  # sent to PayUnit
    provider_reference = Column(String(128), nullable=True)
    status = Column(Enum(PaymentStatus), nullable=False, default=PaymentStatus.pending, index=True)
    failure_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    paid_at = Column(DateTime, nullable=True)

    organization = relationship("Org")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, nullable=True, index=True)
    user_email = Column(String(255), nullable=True)
    organization_id = Column(String, nullable=True, index=True)
    action = Column(String(128), nullable=False, index=True)
    detail = Column(Text, nullable=False, default="{}")
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)
