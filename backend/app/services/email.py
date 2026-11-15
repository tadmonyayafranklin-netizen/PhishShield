"""Outbound mailer for authorized simulation emails.

If SMTP env vars are configured, sends real email via SMTP (TLS).
Otherwise records the message in the log table / console for development.
Simulation emails NEVER request credentials and only target allowlisted
domains or participants explicitly enrolled in a campaign.
"""
import logging
import smtplib
from email.message import EmailMessage

from ..config import settings

log = logging.getLogger("phishshield.mailer")


def domain_allowed(email: str) -> bool:
    domain = email.rsplit("@", 1)[-1].lower()
    allowed = [d.strip().lower() for d in settings.allowed_simulation_domains.split(",")]
    return domain in allowed


def send_simulation_email(to_email: str, to_name: str, subject: str, body: str) -> dict:
    """Send (or simulate) a phishing-awareness training email."""
    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = f"{to_name} <{to_email}>"
    msg["Subject"] = subject
    msg.set_content(body)

    if settings.resend_api_key and not domain_allowed(to_email):
        log.warning("Blocked simulation email to %s — domain not in ALLOWED_SIMULATION_DOMAINS", to_email)
        return {"mode": "blocked", "to": to_email}

    if settings.resend_api_key:
        import httpx

        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.resend_from,
                "to": [to_email],
                "subject": subject,
                "text": body,
            },
            timeout=15,
        )
        resp.raise_for_status()
        return {"mode": "resend", "to": to_email, "id": resp.json().get("id")}

    if settings.smtp_host and not domain_allowed(to_email):
        log.warning("Blocked simulation email to %s — domain not in ALLOWED_SIMULATION_DOMAINS", to_email)
        return {"mode": "blocked", "to": to_email}

    if settings.smtp_host:
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as s:
                if settings.smtp_user:
                    s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as s:
                s.starttls()
                if settings.smtp_user:
                    s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)
        return {"mode": "smtp", "to": to_email}

    # Simulation mode: log only, never actually deliver.
    log.info("[SIMULATED EMAIL] to=%s subject=%r", to_email, subject)
    return {"mode": "simulation", "to": to_email}
