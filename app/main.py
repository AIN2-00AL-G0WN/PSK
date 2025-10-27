
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
import asyncio
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text as sa_text
from app.db.base import Base
from app.db.engine import engine, SessionLocal
from app.api.auth.auth import router as auth_router
from app.api.user.users import router as users_router
from app.api.admin.admin import router as admin_router
from app.core.exceptions import (AppError,
                                 CodeBulkAddError,
                                 NoCodesAvailableError,
                                 ReservationExpiredError,
                                 InvalidReservationError,
                                 PermissionDeniedError,
                                 UsersOnlyError,
                                 )
from app.db.models import User
from app.core.security import get_password_hash
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

executor = ThreadPoolExecutor(max_workers=15)

@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_running_loop()
    loop.set_default_executor(executor)

    # DB setup
    ensure_enum_exists()
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        users = {
            "Admin": {"user_name": "admin", "email": "admin@example.com", "is_admin": True},
            "Trillium": {"user_name": "osv", "email": "osv@example.com", "is_admin": False},
            "Zeus": {"user_name": "hsv", "email": "hsv@example.com", "is_admin": False},
        }

        for team, data in users.items():
            existing = db.query(User).filter(User.contact_email == data["email"]).first()
            if not existing:
                user = User(
                    team_name=team,
                    user_name=data["user_name"],
                    password_hash=get_password_hash("Rdl@12345"),
                    contact_email=data["email"],
                    is_admin=data["is_admin"],
                )
                db.add(user)

        db.commit()
    except Exception:
        db.rollback()

    finally:
        db.close()

    logger.info(" ----------------- Startup complete. App is running ---------------------")
    yield
    logger.info("------------------ Shutting down thread pool... ------------------------")
    executor.shutdown(wait=True)
    logger.info("------------------ Thread pool shut down successfully -------------------")

app = FastAPI(title="promo-tool",lifespan=lifespan)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(admin_router)
origins = [
    "http://146.205.10.159:8000",
    "http://146.205.10.159:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(

    GZipMiddleware,
    minimum_size = 1000
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

@app.exception_handler(AppError)
async def no_codes_handler(request: Request, exc: AppError):
    logger.exception()
    return JSONResponse(status_code=500, content={"detail": "Something went wrong"})

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

@app.exception_handler(UsersOnlyError)
async def user_only_handler(request: Request, exc: UsersOnlyError):
    return JSONResponse(status_code=403, content={"detail": "Users only"})

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(status_code=400, content={"detail": exc.message or "Application error"})

@app.exception_handler(CodeBulkAddError)
async def code_bulk_add_handler(request: Request, exc: CodeBulkAddError):
    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.message
        }
    )
