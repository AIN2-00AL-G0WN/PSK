from app.db.engine import SessionLocal
from app.db.users import crud


def main():
    db = SessionLocal()
    try:
        expired = crud.expire_stale_reservations(db)
        if expired:
            print("Expired codes:", expired)
    finally:
        db.close()

if __name__ == "__main__":
    main()
