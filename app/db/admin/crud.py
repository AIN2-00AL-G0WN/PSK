from __future__ import annotations
from typing import Iterable, Dict, List, Tuple
from sqlalchemy import false,or_
from sqlalchemy.orm import selectinload
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import select
from app.core.exceptions import (NoCodesAvailableError,
                                 UserNotFound,
                                 UserHasReservedCodesError)
from sqlalchemy import  func
from datetime import datetime
from sqlalchemy.orm import Session
from app.db.models import Code, Log, User, CodeStatus, CodeAction, CodeType, Region,Country
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
    now = datetime.utcnow().strftime("%d-%m-%y %I:%M:%S %p")
    new_user=User(team_name=team_name,
                  user_name=user_name,
                  contact_email=contact_email,
                  password_hash=password,
                  is_admin=is_admin,
                  created_at=now
                  )
    db.add(new_user)
    return new_user



def fetch_users_with_reserved_codes(
    db: Session,
    *,
    only_user_id: Optional[int] = None,
) -> List[User]:

    q = (
        db.query(User)
        .options(

            selectinload(User.codes.and_(Code.status == CodeStatus.RESERVED))
        )
    )

    if only_user_id is not None:
        q = q.filter(
            or_(
                User.id == only_user_id,
                User.is_admin == false()
            )
        )
    else:
        q = q.filter(User.is_admin == false())

    return q.all()


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

    for field, value in updates.items():
        if value is not None:
            setattr(user, field, value)
    user.created_at = datetime.utcnow().strftime("%d-%m-%y %I:%M:%S %p")
    return user



def delete_user(db: Session, user_id: int):

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
    countries: Iterable[str] | None,   # <-- multiple countries supported
    codes: Iterable[str],
    user_name: str,
    contact_email: str,
) -> Dict:
    """
    Insert codes and associate each with zero or more countries.
    Returns:
      {
        "inserted": [code, ...],               # actually inserted into codes table
        "failed": [(code, reason), ...],       # validation or duplicate reasons
        "unknown_countries": ["X", ...],       # country names not found in DB
        "attached": {(code, country_name), ...}# associations created
      }
      - If a country name is unknown, code is still inserted, just no association for that name.
    """

    def validate_code(code: str) -> bool:

        return bool(code and code.strip())

    allowed_types = {CodeType.OSV.value, CodeType.HSV.value, CodeType.COMMON.value}
    if code_type not in allowed_types:
        raise ValueError(f"Invalid code_type '{code_type}'. Allowed: {sorted(allowed_types)}")

    result: Dict = {
        "inserted": [],
        "failed": [],
        "unknown_countries": [],
        "attached": set(),
    }


    seen: set[str] = set()
    normalized: List[str] = []
    for raw in (codes or []):
        code = (raw or "").strip().upper()
        if not code:
            result["failed"].append((raw, "empty_or_blank"))
            continue
        if not validate_code(code):
            result["failed"].append((code, "invalid_format"))
            continue
        if code in seen:
            result["failed"].append((code, "duplicate_in_batch"))
            continue
        seen.add(code)
        normalized.append(code)

    if not normalized:
        raise ValueError("No valid codes to insert.")


    rows = [
        {
            "code": code,
            "user_id": None,
            "tester_name": None,
            "requested_at": None,
            "released_at": None,
            "reservation_token": None,
            "status": CodeStatus.CAN_BE_USED,
            "note": None,
            "code_type": CodeType(code_type),
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


    failed_insert = set(normalized) - set(inserted_codes)
    for code in failed_insert:
        result["failed"].append((code, "duplicate_in_db"))


    country_name_list = [c.strip() for c in (countries or []) if c and c.strip()]
    country_map: dict[str, Country] = {}
    if country_name_list:
        found = db.query(Country).filter(Country.name.in_(country_name_list)).all()
        country_map = {c.name: c for c in found}
        unknown = sorted(set(country_name_list) - set(country_map.keys()))
        result["unknown_countries"].extend(unknown)

    if inserted_codes and country_map:
        code_objs = db.query(Code).filter(Code.code.in_(inserted_codes)).all()
        for code_obj in code_objs:

            existing = {c.id for c in code_obj.countries}
            for name, country_obj in country_map.items():
                if country_obj.id not in existing:
                    code_obj.countries.append(country_obj)
                    result["attached"].add((code_obj.code, name))


    now = datetime.utcnow()
    for code in inserted_codes:
        db.add(Log(
            code=code,
            user_id=None,
            user_name=user_name,
            contact_email=contact_email,
            tester_name=None,
            action=CodeAction.ADDED,   # pass Enum
            note=f"Code added for {code_type} / {', '.join(country_map.keys()) or 'ANY'}",
            logged_at=now,
        ))

    return result

def get_codes_grouped(db: Session):

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


    db.delete(code_obj)


    db.add(Log(
        code=code_obj.code,
        user_name=user_name,
        contact_email=contact_email,
        tester_name=None,
        action=CodeAction.DELETED.value,
        note="Deleted",
        logged_at=datetime.utcnow().strftime("%d-%m-%y %I:%M:%S %p")  # pass datetime object, NOT string
    ))