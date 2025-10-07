from __future__ import annotations
import uuid
import  time
from sqlalchemy.exc import IntegrityError
from typing import Iterable, Dict, List, Tuple
from datetime import datetime
from http import HTTPStatus
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import select
from app.db.models import Code, CodeStatus, CodeType
from app.core.exceptions import NoCodesAvailableError,UserNotFound,UserHasReservedCodesError
from sqlalchemy import desc, func
from datetime import datetime
from sqlalchemy import  update
from sqlalchemy.orm import Session
from app.db.models import Code, Log, User, CodeStatus, CodeAction, CodeType
from typing import Optional


def get_code_count(db: Session):
    """
        Compute counts grouped by status and map into a Pydantic model.
        """
    rows = (
        db.query(Code.status, func.count(Code.code))
        .group_by(Code.status)
        .all()
    )
    if not rows:
        raise NoCodesAvailableError()
    by_status = {
        (s.value if hasattr(s, "value") else s): n
        for s, n in rows
    }

    return by_status

def create_user(db: Session,
                team_name: str,
                user_name: str,
                contact_email: str,
                password: str,
                is_admin: bool
                ):
    new_user=User(team_name=team_name,
                  user_name=user_name,
                  contact_email=contact_email,
                  password_hash=password,
                  is_admin=is_admin
                  )
    db.add(new_user)
    return new_user


def get_users(db: Session):
    users=db.query(User.id,User.team_name,User.user_name,User.contact_email,User.is_admin).all()
    if not users:
        raise  UserNotFound("No users found in the database")
    return users

def update_user(
        db: Session,
        id: int,
        team_name: str,
        user_name: str,
        contact_email: str,
        password: str,
        is_admin: bool
):
    user=db.query(User).filter(User.id==id).first()

    if not user:
        raise UserNotFound(f"User with id:{id} is not present in the database")

    updates = {
        "team_name": team_name,
        "user_name": user_name,
        "contact_email": contact_email,
        "password": password,
        "is_admin": is_admin,
    }

    # Apply only non-None updates
    for field, value in updates.items():
        if value is not None:
            setattr(user, field, value)
    return user



def delete_user(db: Session, user_id: int):
    # Get user and count reserved codes in one query
    result = (
        db.query(
            User,
            func.count(Code.code).filter(Code.status == CodeStatus.RESERVED.value).label("reserved_count")
        )
        .outerjoin(Code, Code.user_id == User.id)
        .filter(User.id == user_id)
        .group_by(User.id)
        .first()
    )

    if not result:
        raise UserNotFound

    user, reserved_count = result

    if reserved_count > 0:
        raise UserHasReservedCodesError (f"Action denied: user has reserved {reserved_count} code(s).")
    db.delete(user)

def bulk_add_codes(
    db: Session,
    *,
    code_type: str,
    region: str | None,
    codes: Iterable[str],
    user_name: str,
    contact_email: str,
) -> Dict:
    """
    Validates, inserts codes, and logs insertions using the Log model.
    Returns:
        {
            "inserted": [list of inserted codes],
            "failed": [(code, reason), ...]  # e.g. ("BADCODE123", "invalid_format")
        }
    Raises:
        ValueError if no valid codes remain after filtering.
    """

    def validate_code(code: str) -> bool:
        return len(code) == 16 and code.isalnum()

    ALLOWED_CODE_TYPES = {
        CodeType.OSV.value,
        CodeType.HSV.value,
        CodeType.COMMON.value
    }
    if code_type not in ALLOWED_CODE_TYPES:
        raise ValueError(f"Invalid code_type '{code_type}'.")

    result = {
        "inserted": [],
        "failed": [],
    }

    seen: set[str] = set()
    normalized: list[str] = []

    for raw in codes or []:
        code = (raw or "").strip().upper()
        if not code:
            result["failed"].append((raw, "empty_or_blank"))
        elif not validate_code(code):
            result["failed"].append((code, "invalid_format"))
        elif code in seen:
            result["failed"].append((code, "duplicate_in_batch"))
        else:
            seen.add(code)
            normalized.append(code)

    if not normalized:
        raise ValueError("No valid codes to insert.")

    now = datetime.utcnow().strftime("%d-%m-%y %I:%M:%S %p")

    # Prepare insert rows
    rows = [
        {
            "code": code,
            "user_id": None,
            "tester_name": None,
            "region": region,
            "requested_at": None,
            "released_at": None,
            "reservation_token": None,
            "status": CodeStatus.CAN_BE_USED.value,
            "note": None,
            "code_type": code_type,
        }
        for code in normalized
    ]

    stmt = (
        insert(Code)
        .values(rows)
        .on_conflict_do_nothing(index_elements=[Code.code])
        .returning(Code.code)
    )

    inserted_rows = db.execute(stmt).fetchall()
    inserted_codes = [r[0] for r in inserted_rows]
    result["inserted"] = inserted_codes

    # Add logs for inserted codes — if log fails, don't block insert
    for code in inserted_codes:
        db.add(Log(
                code=code,
                clearance_id=None,
                user_name=user_name,
                contact_email=contact_email,
                tester_name=None,
                action=CodeAction.ADDED.value,
                note=f"Code added for {code_type} / {region or 'ANY'}",
                logged_at=now
            ))


    # Mark DB-level insert failures
    failed_insert = set(normalized) - set(inserted_codes)
    for code in failed_insert:
        result["failed"].append((code, "duplicate_in_db"))

    return result

def get_codes_grouped(db: Session):
    # Single query: fetch only codes in reserved or can_be_used
    stmt = (
        select(Code)
        .where(Code.status.in_([CodeStatus.RESERVED.value, CodeStatus.CAN_BE_USED.value]))
    )
    rows = db.execute(stmt).scalars().all()

    return rows

PAGE_SIZE = 20

def get_log_date_bounds(db: Session) -> Tuple[Optional[datetime], Optional[datetime]]:
    """Return the oldest and newest logged_at timestamps in the logs table."""
    min_date = db.query(func.min(Log.logged_at)).scalar()
    max_date = db.query(func.max(Log.logged_at)).scalar()
    return min_date, max_date

def get_logs_filtered(
    db: Session,
    *,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    code: Optional[str] = None,
    user_name: Optional[str] = None,
    offset: int = 0,
    limit: int = 20,
) -> Tuple[int, List[Log]]:
    # Set default dates if needed
    if start_date is None or end_date is None:
        min_date, max_date = get_log_date_bounds(db)
        if start_date is None:
            start_date = min_date
        if end_date is None:
            end_date = max_date

    filters = []
    if start_date and end_date:
        filters.append(Log.logged_at.between(start_date, end_date))
    elif start_date:
        filters.append(Log.logged_at >= start_date)
    elif end_date:
        filters.append(Log.logged_at <= end_date)

    if code:
        filters.append(Log.code == code)
    if user_name:
        filters.append(Log.user_name == user_name)

    query = db.query(Log).filter(*filters)

    total_count = query.with_entities(func.count()).scalar() or 0

    logs = (
        query.order_by(Log.logged_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return total_count, logs



def delete_code(db : Session,
                code:str,
                user_name:str,
                contact_email:str):
    code_obj = db.query(Code).filter(
        (Code.code == code) &
        (Code.status == CodeStatus.CAN_BE_USED.value)
    ).first()

    if not code_obj:
        raise NoCodesAvailableError("Code not found or cannot be deleted")

    # Delete code
    db.delete(code_obj)

    # Add log entry
    db.add(Log(
        code=code_obj.code,
        clearance_id=None,
        user_name=user_name,
        contact_email=contact_email,
        tester_name=None,
        action=CodeAction.DELETED.value,
        note="Deleted",
        logged_at=datetime.utcnow()  # pass datetime object, NOT string
    ))