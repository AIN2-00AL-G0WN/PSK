from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings

# create engine from DATABASE_URL
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=5,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True
)


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True, expire_on_commit=False)
