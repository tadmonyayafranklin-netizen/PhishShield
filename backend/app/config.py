from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "PhishShield API"
    database_url: str = "sqlite:///./phishshield.db"
    secret_key: str = "change-me-in-production-use-a-long-random-string"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    # SMTP: leave blank to use the built-in simulation mailer (dev/demo)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "training@phishshield.local"
    # Resend API: takes precedence over SMTP when set
    resend_api_key: str = ""
    resend_from: str = "PhishShield <training@phishshield.local>"
    simulation_base_url: str = "http://localhost:8000"  # base for landing links
    allowed_simulation_domains: str = "phishshield.local,localhost"  # comma separated
    seed_on_startup: bool = True
    rate_limit_per_minute: int = 120

    # PayUnit billing (https://developer.payunit.net)
    payunit_enabled: bool = False
    payunit_base_url: str = "https://gateway.payunit.net"
    payunit_api_user: str = ""
    payunit_api_password: str = ""
    payunit_api_key: str = ""  # x-api-key application token (live_/test_ prefixed)
    payunit_mode: str = "test"  # "test" or "live"
    payunit_currency: str = "XAF"
    payunit_country: str = "CM"  # ISO country code shown to filter providers; "" = all
    payunit_premium_price: float = 25000.0  # in payunit_currency units
    payunit_premium_days: int = 30
    payunit_return_url: str = ""  # frontend URL; defaults to first CORS origin + /billing/return
    payunit_notify_url: str = ""  # defaults to simulation_base_url + /api/billing/payunit/notify

    class Config:
        env_file = ".env"


settings = Settings()
