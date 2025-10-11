import uuid
from zoneinfo import ZoneInfo

from app.core.exceptions import NoCodesAvailableError
from sqlalchemy import desc, select
from datetime import datetime
from sqlalchemy import  update
from sqlalchemy.orm import Session
from app.db.models import (Code,
                           Log,
                           User,
                           CodeStatus,
                           CodeAction,
                           CodeType,
                           Region,
                           Country)
from typing import Optional
from sqlalchemy.orm import joinedload



def reserve_one_code(
    db: Session,
    user: User,
    tester_name: str | None,
    country: str | None,
    code_type: str,
) -> Code:

    def _reserve_code(
        code_type: CodeType,
        country: str | None = None,
        user_id: int | None = None,
        tester_name: str | None = None,
        contact_email: str | None = None,
    ) -> Code | None:
        # Normalize to Enum
        ct = CodeType(code_type) if isinstance(code_type, str) else code_type
        # Start with status + code_type filter
        query = (
            db.query(Code)
            .filter(
                (Code.status == CodeStatus.CAN_BE_USED.value) &   # use Enum, not .value
                (Code.code_type == ct)
            )
        )

        # For non-COMMON, restrict by associated country
        if ct != CodeType.COMMON and country:
            query = query.join(Code.countries).filter(Country.name == country)

        # Lock a single candidate row (oldest first, NULLs first)
        query = query.order_by(Code.requested_at.nullsfirst()).with_for_update(skip_locked=True)

        candidate: Code | None = query.first()
        if not candidate:
            return None

        now = now = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%d-%m-%Y %I:%M:%S %p")

        # Update fields
        candidate.user_id = user_id
        candidate.tester_name = tester_name
        candidate.requested_at = now
        candidate.reservation_token = uuid.uuid4()
        candidate.status = CodeStatus.RESERVED.value   # assign Enum directly
        candidate.released_at = None

        db.flush()

        # Compute region name if possible
        region_name = None
        if country:
            match = next((cou for cou in candidate.countries if cou.name == country), None)
            if match and match.region:
                region_name = match.region.name

        # Log the reservation
        db.add(Log(
            code=candidate.code,
            user_id=user.id,
            action=CodeAction.RESERVED.value,
            user_name=user.user_name,
            contact_email=user.contact_email,
            tester_name=tester_name,
            region_name=region_name,
            country_name=country,
            logged_at=now,
        ))
        db.flush()

        return candidate

    # Priority 1: Try with requested code_type
    row = _reserve_code(
        code_type=code_type,
        country=country,
        user_id=user.id,
        tester_name=tester_name,
        contact_email=user.contact_email,
    )
    if row:
        return row

    # Priority 2: Fallback to COMMON type (ignores country restriction if COMMON)
    row = _reserve_code(
        code_type=CodeType.COMMON,
        country=country,
        user_id=user.id,
        tester_name=tester_name,
        contact_email=user.contact_email,
    )
    if row:
        return row

    # Nothing available
    raise NoCodesAvailableError()

def release_reserved_code(
    db: Session,
    code: str,
    user: User,
    clearance_id: Optional[str] = None,
    note: Optional[str] = None,
) -> str:

    now = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%d-%m-%Y %I:%M:%S %p")

    # Step 1: Update the reserved code
    stmt = (
        update(Code)
        .where(Code.code == code, Code.status == CodeStatus.RESERVED.value)
        .values(
            status=CodeStatus.CAN_BE_USED.value,
            user_id=None,
            tester_name=None,
            reservation_token=None,
            requested_at=None,
            released_at=now,
            note=note,
        )
        .returning(Code.code)
    )

    result = db.execute(stmt).fetchone()
    if not result:
        raise ValueError(f"Code '{code}' not found.")

    # Fetch the full code object with relationships (for region/country info)
    code_obj = db.query(Code).filter_by(code=code).first()

    # Extract region + country info
    region_name = None
    country_name = None
    if code_obj and code_obj.countries:
        # Just take the first associated country
        country = code_obj.countries[0]
        country_name = country.name
        region_name = country.region.name if country.region else None

    # Step 2: Add log entry
    log_entry = Log(
        code=code,
        action=CodeAction.RELEASED.value,
        user_id=user.id,
        user_name=user.user_name,
        contact_email=user.contact_email,
        logged_at=now,
        note=clearance_id if clearance_id  else note,
        region_name=region_name,
        country_name=country_name,
    )

    db.add(log_entry)
    return code



def list_of_codes(db: Session, user):
    codes = (
        db.query(Code)
        .options(
            joinedload(Code.countries).joinedload(Country.region)  # eager load countries + their region
        )
        .filter(Code.user_id == user.id, Code.status == CodeStatus.RESERVED)
        .order_by(Code.requested_at.desc())
        .all()
    )
    return codes


def user_logs(db: Session, user_id: int):
    stmt = (
        select(Log)
        .where(Log.user_id == user_id)
        .order_by(Log.logged_at.desc())
        .limit(20)
    )
    result = db.execute(stmt).scalars().all()
    return result

def get_all_countries(db: Session):
    stmt = select(Country.id, Country.name)
    result = db.execute(stmt).all()
    return result




# def mark_non_usable(
#     db: Session,
#     user: User,
#     code: str,
#     reason: str | None = None
# ) -> str:
#     try:
#         now = datetime.utcnow().strftime("%d-%m-%y %I:%M:%S %p")
#
#
#         code_row = (
#             db.query(Code)
#             .filter(Code.code == code)
#             .with_for_update()
#             .first()
#         )
#
#         if not code_row:
#             raise ValueError(f"Code '{code}' not found.")
#
#
#         code_row.status = CodeStatus.NON_USABLE.value
#         code_row.reserved_until = None
#         code_row.reservation_token = None
#         code_row.user_id = None
#         code_row.tester_name = None
#         code_row.note = reason
#
#         db.flush()
#
#
#         db.add(Log(
#             code=code,
#             action=CodeAction.BLOCKED.value,
#             user_name=user.user_name,
#             contact_email=user.contact_email,
#             logged_at=now,
#             note=reason
#         ))
#         db.commit()
#         return code_row.code
#     except ValueError as e:
#         db.rollback()
#         raise  e
#     except  Exception as e:
#         db.rollback()
#         raise e


