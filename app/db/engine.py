from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings

# create engine from DATABASE_URL
engine = create_engine(settings.DATABASE_URL, pool_size=5, max_overflow=0, future=True)

# sessionmaker: use future=True to use SQLAlchemy 2.0 style sessions
SessionLocal = sessionmaker(bind=engine, autoflush=False, future=True)
