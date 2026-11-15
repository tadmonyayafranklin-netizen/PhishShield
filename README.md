# PhishShield

A web-based phishing simulation & security awareness training platform for organizations and educators. **Authorized use only** — for security awareness training and controlled phishing simulations.

## Features

- **JWT auth + RBAC** — Super Admin, Organization Admin, Participant
- **Dashboard** — participants, campaigns, emails sent, interactions, awareness score, completion rate, recent activity
- **Campaign management** — draft → scheduled → active → paused/completed/cancelled lifecycle, participant enrollment, simulated email dispatch, pause/resume/terminate
- **Template library** — 5 seeded educational phishing scenarios with difficulty, objectives, warning signs; server-side guard rejects credential-collecting content
- **Participant management** — manual add, CSV import, department organization, awareness scores, CSV export
- **Analytics** — campaign comparison, department scores, monthly trends, delivery/open/click/report/completion rates; CSV + PDF reports
- **Training module** — awareness lessons, quizzes with auto-grading, explanations, certificates
- **Public simulation landing** — tokenized `/sim/:token` educational pages explaining why the email was suspicious
- **Notifications, audit logs** (searchable + exportable), light/dark theme, responsive UI
- **Security** — bcrypt password hashing, JWT sessions, RBAC, rate limiting, security headers, org scoping, privacy-conscious analytics (no credentials ever collected)
- **Plans & billing** — Free and Premium tiers; Premium payments processed via **PayUnit** (hosted checkout + webhook activation). Premium unlocks unlimited campaigns/participants, PDF reports and advanced analytics.

## Quick Start (local dev)

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # optional; defaults work for dev (SQLite)
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173 (proxies /api to :8000)
```

### Demo accounts (seeded)
| Role | Email | Password |
|---|---|---|
| Super Admin | admin@phishshield.io | Admin123! |
| Org Admin | orgadmin@acme.example | OrgAdmin123! |
| Org Admin (2nd org) | admin@northwind.edu | Admin123! |

## Docker
```bash
docker compose up --build
# frontend: http://localhost:8080, api: http://localhost:8000
```

Uses PostgreSQL 16. Set `SECRET_KEY` in `.env` before production.

## Configuration
See `backend/.env.example`:
- `DATABASE_URL` — SQLite for dev, `postgresql+psycopg2://…` for prod
- `SMTP_*` — real SMTP for authorized training emails; leave blank for built-in simulation mailer (logs only)
- `ALLOWED_SIMULATION_DOMAINS` — allowlist for simulation email domains
- `SIMULATION_BASE_URL` — base URL for landing-page links
- `RATE_LIMIT_PER_MINUTE`, `SEED_ON_STARTUP`
- `PAYUNIT_*` — PayUnit credentials & plan pricing. Set `PAYUNIT_ENABLED=true` with `PAYUNIT_API_USER`, `PAYUNIT_API_PASSWORD` and `PAYUNIT_API_KEY` to accept payments. `PAYUNIT_NOTIFY_URL` must be publicly reachable in production so PayUnit can confirm payments; `PAYUNIT_RETURN_URL` should point at the frontend `/billing/return` page. PayUnit requires HTTPS for both URLs — for local testing use a tunnel (e.g. `cloudflared tunnel --url http://localhost:5173`) and point the vars at the tunnel URLs.

## Project structure
```
backend/app/
  models.py        # SQLAlchemy models (users, orgs, participants, campaigns,
                   # templates, events, training, quizzes, reports,
                   # notifications, audit logs)
  routers/         # auth, orgs, directory(users/depts/participants),
                   # templates, campaigns(+public landing), training,
                   # analytics, notifications, audit, reports, billing
  services/        # email mailer, seed data, payunit client
frontend/src/
  pages/           # Dashboard, Campaigns, Templates, Participants,
                   # Analytics, Training, Users, Orgs, Audit, Simulation,
                   # Billing, BillingReturn
  components/      # Layout (sidebar/topbar/theme), UI primitives
```

## Security notes
- Simulation emails are only sent to participants enrolled in a campaign and logged via the mailer; templates cannot contain credential-harvesting content (server-validated).
- Landing pages are tokenized, non-credential-collecting, and purely educational.
- All admin actions are audit-logged; org admins are scoped to their organization.
- Set a strong `SECRET_KEY`, use HTTPS in production, and restrict `ALLOWED_SIMULATION_DOMAINS`.
# PhishShield
