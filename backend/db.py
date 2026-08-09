import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Ensure SQLite DB is created in the backend directory
BACKEND_DIR = Path(__file__).resolve().parent
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'triage.db'}")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that provides a transactional database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Creates all database tables defined in models on startup."""
    # Import models so they are registered with Base metadata before creation
    try:
        from . import models  # noqa: F401
    except ImportError:
        try:
            import models  # noqa: F401
        except ImportError:
            from backend import models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    # Lightweight SQLite migration: add final_triage_level or evidence if missing in existing reports table
    try:
        with engine.connect() as conn:
            from sqlalchemy import text
            columns = [c[1] for c in conn.execute(text("PRAGMA table_info(reports)")).fetchall()]
            if columns and "final_triage_level" not in columns:
                conn.execute(text("ALTER TABLE reports ADD COLUMN final_triage_level VARCHAR(50)"))
                conn.commit()
            if columns and "evidence" not in columns:
                conn.execute(text("ALTER TABLE reports ADD COLUMN evidence JSON DEFAULT '[]'"))
                conn.commit()
    except Exception:
        pass
