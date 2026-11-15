import logging
import time
from collections import defaultdict, deque

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import SessionLocal, init_db
from .models import new_id
from .routers import analytics, audit, auth, billing, campaigns, directory, notifications, orgs, reports, templates, training
from .services.seed import seed

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("phishshield")

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Simple in-memory rate limiter (per IP) ---
_hits: dict[str, deque] = defaultdict(deque)
RATE_LIMIT = settings.rate_limit_per_minute
WINDOW = 60


@app.middleware("http")
async def security_headers_and_rate_limit(request: Request, call_next):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    dq = _hits[ip]
    while dq and now - dq[0] > WINDOW:
        dq.popleft()
    if len(dq) >= RATE_LIMIT:
        return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429)
    dq.append(now)

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.on_event("startup")
def startup():
    init_db()
    if settings.seed_on_startup:
        db = SessionLocal()
        try:
            seed(db)
            log.info("Seed data ensured")
        finally:
            db.close()


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name, "request_id": new_id()}


for r in (auth.router, orgs.router, directory.router, templates.router,
          campaigns.router, training.router, analytics.router,
          notifications.router, audit.router, reports.router, billing.router):
    app.include_router(r, prefix="/api")
