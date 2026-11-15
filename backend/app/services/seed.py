"""Demo seed data for development."""
import json
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from ..models import (
    Campaign, CampaignEvent, CampaignParticipant, CampaignStatus, Department,
    Difficulty, Notification, Org, Participant, Quiz, QuizResult, RoleEnum,
    SimulationTemplate, TrainingModule, User, new_id,
)
from ..security import hash_password, new_token


def utcnow():
    return datetime.now(timezone.utc)


TEMPLATES = [
    {
        "name": "Password Reset Alert",
        "description": "Simulates an urgent password-reset request from a look-alike domain.",
        "difficulty": Difficulty.intermediate,
        "educational_objective": "Recognize spoofed sender domains and verify reset requests through official channels.",
        "subject": "Action required: your password expires in 24 hours",
        "body": "Hello {{name}},\n\nWe detected unusual sign-in activity on your account. Your password will expire in 24 hours.\n\nVerify your identity now: http://phishshield.local/s/{{token}}\n\nIf you did not request this, ignore this message.\n\n— IT Security Team",
        "warning_signs": "Urgency pressure; mismatched sender domain; generic greeting; link goes to a look-alike domain instead of the official portal.",
    },
    {
        "name": "Delivery Notification Scam",
        "description": "Fake parcel/delivery notification prompting a 'customs fee' payment page visit.",
        "difficulty": Difficulty.beginner,
        "educational_objective": "Identify delivery-themed lures and unexpected payment requests.",
        "subject": "Your package could not be delivered",
        "body": "Hi {{name}},\n\nWe attempted to deliver your package but need additional information to complete delivery.\n\nUpdate delivery details: http://phishshield.local/s/{{token}}\n\nThank you,\nGlobal Shipping",
        "warning_signs": "Unexpected delivery notice; asks for personal/payment details; sender is not a known carrier.",
    },
    {
        "name": "Account Security Warning",
        "description": "Generic 'unusual activity' warning designed to harvest credentials via a fake login page.",
        "difficulty": Difficulty.advanced,
        "educational_objective": "Learn to navigate to the real login portal instead of clicking embedded links.",
        "subject": "Security alert: verify your account",
        "body": "Dear {{name}},\n\nUnusual sign-in activity was detected on your account from a new device. For your protection, verify your account within 48 hours.\n\nhttp://phishshield.local/s/{{token}}\n\nSecurity Operations Center",
        "warning_signs": "Vague claims with no specifics; links embedded in the email rather than directing to the official site manually; threatens account suspension.",
    },
    {
        "name": "Document Sharing Notice",
        "description": "Fake shared-document notification mimicking common collaboration tools.",
        "difficulty": Difficulty.intermediate,
        "educational_objective": "Spot fake collaboration invites and confirm shared docs via the real platform.",
        "subject": "{{sender}} shared a document with you",
        "body": "Hi {{name}},\n\nA document has been shared with you. Open it here to review:\nhttp://phishshield.local/s/{{token}}\n\nThis link expires in 7 days.",
        "warning_signs": "Unexpected share notification; sender display name is spoofed; link does not point to the official collaboration domain.",
    },
    {
        "name": "Fraudulent Invoice Awareness",
        "description": "Fake invoice email testing whether staff verify payment changes through known channels.",
        "difficulty": Difficulty.advanced,
        "educational_objective": "Establish out-of-band verification for invoice/payment changes.",
        "subject": "Invoice #INV-2026-1042 — payment details updated",
        "body": "Hello {{name}},\n\nPlease find attached invoice INV-2026-1042. Note our bank details have changed — kindly update your records.\n\nView invoice: http://phishshield.local/s/{{token}}\n\nAccounts Receivable",
        "warning_signs": "Payment-detail changes are a classic fraud indicator; always verify via a known phone number or portal, never via links in the email.",
    },
]

MODULES = [
    {
        "title": "Recognizing Phishing Emails",
        "category": "phishing",
        "description": "Core indicators of phishing: urgency, spoofed domains, mismatched links.",
        "content": "## Phishing Indicators\n\n- **Urgency & fear**: 'Your account will be suspended' is a classic pressure tactic.\n- **Check the sender domain**: hover to see the real address; look-alike domains differ by a character.\n- **Inspect links before clicking**: legitimate orgs rarely send credential links by email.\n- **Generic greetings**: 'Dear user' instead of your name can signal a mass campaign.\n- **Verify out-of-band**: contact the sender via a known phone number or portal.\n\nRemember: this was an authorized security awareness simulation.",
        "duration_minutes": 12,
        "quizzes": [{
            "title": "Phishing Basics Quiz",
            "passing_score": 70,
            "questions": [
                {"id": "q1", "question": "An email claims your account will be suspended in 1 hour unless you click a link. Best action?", "options": ["Click quickly to avoid suspension", "Go to the official site directly and verify", "Reply asking if it's real"], "correct_index": 1, "explanation": "Never use embedded links for verification; navigate to the official site yourself."},
                {"id": "q2", "question": "Sender shows 'support@paypa1-secure.com'. This is suspicious because:", "options": ["It has too many hyphens", "The domain is a look-alike, not paypal.com", "It's too short"], "correct_index": 1, "explanation": "Attackers register look-alike domains. Always check the exact domain."},
                {"id": "q3", "question": "Which is the safest way to verify an unexpected invoice?", "options": ["Click the link and log in", "Call the vendor using a known phone number", "Forward it to IT"], "correct_index": 1, "explanation": "Out-of-band verification prevents following attacker-controlled links."},
            ],
        }],
    },
    {
        "title": "Social Engineering Defense",
        "category": "social_engineering",
        "description": "How attackers manipulate people and how to resist.",
        "content": "## Social Engineering\n\nAttackers exploit trust, authority, and urgency. Pretexts include IT support, executives, and vendors.\n\n- **Verify identity** before acting on unusual requests, even from 'the boss'.\n- **Slow down** — urgency is the attacker's tool.\n- **Report, don't engage** with suspicious requests.",
        "duration_minutes": 10,
        "quizzes": [{
            "title": "Social Engineering Quiz",
            "passing_score": 70,
            "questions": [
                {"id": "q1", "question": "A 'CEO' emails asking you to buy gift cards urgently. You should:", "options": ["Comply quickly", "Verify via a second channel (call/text)", "Buy them anyway"], "correct_index": 1, "explanation": "Executive impersonation is common; verify through an independent channel."},
            ],
        }],
    },
    {
        "title": "Password Security & MFA",
        "category": "passwords",
        "description": "Strong passwords, password managers, and multi-factor authentication.",
        "content": "## Passwords & MFA\n\n- Use a **password manager** and unique passwords per account.\n- Enable **MFA** everywhere it's offered — it blocks most credential attacks.\n- Never reuse passwords; a breach on one site shouldn't compromise others.\n- Watch for MFA fatigue/push bombing and never approve unexpected prompts.",
        "duration_minutes": 10,
        "quizzes": [{
            "title": "Passwords & MFA Quiz",
            "passing_score": 70,
            "questions": [
                {"id": "q1", "question": "You receive an MFA push you didn't request. You should:", "options": ["Approve it — maybe it's you", "Deny it and report it", "Ignore it forever"], "correct_index": 1, "explanation": "Unexpected MFA prompts may indicate an attack; deny and report."},
                {"id": "q2", "question": "Best password practice:", "options": ["Reuse one strong password everywhere", "Unique password per account via a manager", "Write passwords on a sticky note"], "correct_index": 1, "explanation": "Unique passwords limit blast radius of a single breach."},
            ],
        }],
    },
    {
        "title": "Email Security Best Practices",
        "category": "email_security",
        "description": "Handling attachments, links, and reporting suspicious mail.",
        "content": "## Email Security\n\n- Don't open unexpected attachments; verify with the sender first.\n- Hover over links to preview destinations.\n- Report suspicious email using your organization's report button — never forward credentials.\n- Remember: no legitimate service will ask for your password by email or link.",
        "duration_minutes": 8,
        "quizzes": [{
            "title": "Email Security Quiz",
            "passing_score": 70,
            "questions": [
                {"id": "q1", "question": "A colleague forwards a suspicious email 'just to check'. You should:", "options": ["Open it too", "Report it via the official channel and delete it", "Reply to the sender"], "correct_index": 1, "explanation": "Report through official channels; don't spread potentially malicious content."},
            ],
        }],
    },
]


def seed(db: Session):
    if db.query(User).filter(User.email == "admin@phishshield.io").first():
        return

    org = Org(name="Acme Corporation", domain="acme.example")
    org2 = Org(name="Northwind University", domain="northwind.edu")
    db.add_all([org, org2])
    db.flush()

    depts = [
        Department(name="Engineering", organization_id=org.id),
        Department(name="Finance", organization_id=org.id),
        Department(name="HR", organization_id=org.id),
        Department(name="IT", organization_id=org.id),
    ]
    depts2 = [
        Department(name="Sciences", organization_id=org2.id),
        Department(name="Administration", organization_id=org2.id),
    ]
    db.add_all(depts + depts2)
    db.flush()

    admin = User(email="admin@phishshield.io", hashed_password=hash_password("Admin123!"),
                 full_name="Root Admin", role=RoleEnum.super_admin, organization_id=org.id)
    orgadmin = User(email="orgadmin@acme.example", hashed_password=hash_password("OrgAdmin123!"),
                    full_name="Org Admin", role=RoleEnum.org_admin, organization_id=org.id)
    padmin = User(email="admin@northwind.edu", hashed_password=hash_password("Admin123!"),
                  full_name="NW Admin", role=RoleEnum.org_admin, organization_id=org2.id)
    db.add_all([admin, orgadmin, padmin])
    db.flush()

    # Participants
    first_names = ["Ava", "Liam", "Maya", "Noah", "Zoe", "Ethan", "Ivy", "Lucas", "Nora", "Owen"]
    last_names = ["Chen", "Patel", "Garcia", "Kim", "Novak", "Silva", "Okafor", "Rossi", "Tanaka", "Weber"]
    participants = []
    for i in range(40):
        d = depts[i % len(depts)]
        email = f"{first_names[i % 10].lower()}.{last_names[i % 10].lower()}{i}@acme.example"
        p = Participant(email=email, full_name=f"{first_names[i % 10]} {last_names[i % 10]}",
                        department_id=d.id, organization_id=org.id,
                        awareness_score=round(random.uniform(30, 95), 1),
                        trainings_completed=random.randint(0, 4))
        participants.append(p)
    db.add_all(participants)
    db.flush()

    # Templates
    templates = []
    for t in TEMPLATES:
        tpl = SimulationTemplate(**t)
        templates.append(tpl)
    db.add_all(templates)
    db.flush()

    # Training modules & quizzes
    module_ids = {}
    for m in MODULES:
        mod = TrainingModule(title=m["title"], description=m["description"], category=m["category"],
                             content=m["content"], duration_minutes=m["duration_minutes"],
                             organization_id=None)
        db.add(mod)
        db.flush()
        module_ids[m["title"]] = mod.id
        for q in m["quizzes"]:
            db.add(Quiz(module_id=mod.id, title=q["title"],
                        questions=json.dumps(q["questions"]), passing_score=q["passing_score"]))
    db.flush()

    # Campaigns with historical events for analytics
    now = utcnow()
    for idx, tpl in enumerate(templates):
        camp = Campaign(
            name=f"{tpl.name} Awareness Drive — Q{idx + 1}",
            description=f"Authorized phishing simulation using template '{tpl.name}'.",
            organization_id=org.id, template_id=tpl.id,
            status=[CampaignStatus.completed, CampaignStatus.active, CampaignStatus.completed,
                    CampaignStatus.scheduled, CampaignStatus.completed][idx],
            start_at=now - timedelta(days=90 - idx * 20),
            end_at=now - timedelta(days=80 - idx * 20),
            created_by=orgadmin.id,
        )
        db.add(camp)
        db.flush()
        # link subset of participants and generate events
        links = []
        for p in random.sample(participants, min(20, len(participants))):
            link = CampaignParticipant(campaign_id=camp.id, participant_id=p.id,
                                       token=new_token(), email_sent=True,
                                       email_sent_at=camp.start_at)
            db.add(link)
            links.append(link)
        db.flush()
        for link in links:
            base = camp.start_at or now - timedelta(days=30)
            db.add(CampaignEvent(campaign_id=camp.id, campaign_participant_id=link.id,
                                 event_type="delivered", created_at=base))
            if random.random() < 0.8:
                db.add(CampaignEvent(campaign_id=camp.id, campaign_participant_id=link.id,
                                     event_type="opened", created_at=base + timedelta(hours=2)))
            if random.random() < 0.5:
                db.add(CampaignEvent(campaign_id=camp.id, campaign_participant_id=link.id,
                                     event_type="clicked", created_at=base + timedelta(hours=3)))
                if random.random() < 0.7:
                    db.add(CampaignEvent(campaign_id=camp.id, campaign_participant_id=link.id,
                                         event_type="completed", created_at=base + timedelta(hours=4)))
            if random.random() < 0.3:
                db.add(CampaignEvent(campaign_id=camp.id, campaign_participant_id=link.id,
                                     event_type="reported", created_at=base + timedelta(hours=3, minutes=30)))

    # Notifications
    db.add(Notification(user_id=orgadmin.id, organization_id=org.id,
                        title="Welcome to PhishShield",
                        message="Your organization has been set up. Create your first campaign to begin awareness training.",
                        kind="info"))

    # Audit log entry
    from ..models import AuditLog
    db.add(AuditLog(user_id=admin.id, user_email=admin.email, organization_id=org.id,
                    action="system.seed", detail='{"message": "Demo data seeded"}'))
    db.commit()
