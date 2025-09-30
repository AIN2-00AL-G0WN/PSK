from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text as sa_text
from app.db.base import Base
from app.db.engine import engine, SessionLocal
from app.api.auth import router as auth_router
from app.api.user.users import router as users_router
from app.api.admin.admin import router as admin_router
from app.core.exceptions import AppError, NoCodesAvailableError, ReservationExpiredError, InvalidReservationError, PermissionDeniedError
from app.db.models import User
from app.core.security import get_password_hash
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI(title="promo-tool")

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(admin_router)
origins = [
    "http://192.168.0.115:8080/",  # React dev server
    # Add prod domain here if deployed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
def ensure_enum_exists():
    ddl = """
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'code_status') THEN
    CREATE TYPE code_status AS ENUM (
      'can_be_used','reserved','in_use','expired','released','non_usable','suspended'
    );
  END IF;
END
$$;
"""
    with engine.connect() as conn:
        conn.execute(sa_text(ddl))
        conn.commit()
# Map domain exceptions to HTTP
@app.exception_handler(NoCodesAvailableError)
async def no_codes_handler(request: Request, exc: NoCodesAvailableError):
    return JSONResponse(status_code=404, content={"detail": "No codes available"})

@app.exception_handler(ReservationExpiredError)
async def reservation_expired_handler(request: Request, exc: ReservationExpiredError):
    return JSONResponse(status_code=400, content={"detail": "Reservation expired"})

@app.exception_handler(InvalidReservationError)
async def invalid_reservation_handler(request: Request, exc: InvalidReservationError):
    return JSONResponse(status_code=400, content={"detail": "Invalid reservation"})

@app.exception_handler(PermissionDeniedError)
async def permission_denied_handler(request: Request, exc: PermissionDeniedError):
    return JSONResponse(status_code=403, content={"detail": "Permission denied"})

# generic AppError -> 400
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(status_code=400, content={"detail": exc.message or "Application error"})

# Dev startup: create tables and default admin,osv,hsv users (DEV ONLY)
@app.on_event("startup")
def startup():
    # ensure enum type exists first (prevents CREATE TABLE ordering issues)
    ensure_enum_exists()

    # now create tables
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.team_name == "ADMIN").first()
        osv = db.query(User).filter(User.team_name == "OSV").first()
        hsv = db.query(User).filter(User.team_name == "HSV").first()
        if not admin:
            u = User(team_name="ADMIN", user_name="admin", password_hash=get_password_hash("Rdl@12345"), contact_email="admin@example.com", is_admin=True)
            db.add(u)
            db.commit()
        if not osv:
            u = User(team_name="OSV", user_name="osv", password_hash=get_password_hash("Rdl@12345"), contact_email="osv@example.com", is_admin=False)
            db.add(u)
            db.commit()
        if not hsv:
            u = User(team_name="HSV", user_name="hsv", password_hash=get_password_hash("Rdl@12345"), contact_email="hsv@example.com", is_admin=False)
            db.add(u)
            db.commit()
    finally:
        db.close()
