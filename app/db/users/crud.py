import uuid
from app.core.exceptions import NoCodesAvailableError
from sqlalchemy import desc
from datetime import datetime
from sqlalchemy import  update
from sqlalchemy.orm import Session
from app.db.models import Code, Log, User, CodeStatus, CodeAction, CodeType
from typing import Optional

def reserve_one_code(
    db: Session,
    user: User,
    tester_name: str | None,
    region: str | None,
    team: str,
    contact_email: str,
) -> Code:
    def _reserve_code(
        code_type: str, region: Optional[str] = None, user_id: int = None, tester_name: str = None,
        contact_email: str = None
    ) -> Code | None:
        # Filter by status and code_type
        query = db.query(Code).filter(
            Code.status == CodeStatus.CAN_BE_USED.value,
            Code.code_type == code_type,
        )

        # Only filter by region if the code_type is not COMMON
        if code_type != CodeType.COMMON.value and region:
            query = query.filter(Code.region == region)

        query = query.order_by(Code.requested_at.nullsfirst())  # oldest first
        query = query.with_for_update(skip_locked=True)

        candidate = query.first()
        if not candidate:
            return None

        now = datetime.utcnow().strftime("%d-%m-%y %I:%M:%S %p")

        # Update fields
        candidate.user_id = user_id
        candidate.tester_name = tester_name
        candidate.requested_at = now
        candidate.reservation_token = uuid.uuid4()
        candidate.status = CodeStatus.RESERVED
        candidate.released_at = None

        db.flush()  # write changes

        # Log the reservation
        log = Log(
            code=candidate.code,
            action=CodeAction.RESERVED,
            user_name=user.user_name,
            contact_email=contact_email,
            logged_at=now,
            tester_name=tester_name,
        )
        db.add(log)
        db.flush()

        return candidate

        # Priority 1: Try with team-specific code
    row = _reserve_code(user_id=user.id,tester_name=tester_name,contact_email=contact_email,code_type=team, region=region)
    if row:
        return row

    # Priority 2: Fallback to COMMON code
    row = _reserve_code(user_id=user.id,tester_name=tester_name,contact_email=contact_email,code_type=CodeType.COMMON.value, region=None)  # Ignore region when code type is COMMON
    if row:
        return row

    # None found
    raise NoCodesAvailableError()



def release_reserved_code(
    db: Session,
    code: str,
    user: User,
    clearance_id: Optional[str] = None,
    note: Optional[str] = None,
) -> str:

    now = datetime.utcnow().strftime("%d-%m-%y %I:%M:%S %p")

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
            note=None,
        )
        .returning(Code.code)
    )

    result = db.execute(stmt).fetchone()
    if not result:
        raise ValueError(f"Code '{code}' not found.")

    # Step 2: Add log entry
    log_entry = Log(
        code=code,
        action=CodeAction.RELEASED.value,
        user_name=user.user_name,
        contact_email=user.contact_email,
        logged_at=now,
        clearance_id=clearance_id,
        note=note,
    )
    db.add(log_entry)
    return code

def list_of_codes(db: Session, user):

    codes = (
        db.query(
            Code.code,
            Code.tester_name,
            Code.region,
            Code.requested_at,
            Code.reservation_token,
            Code.status,
            Code.note,
        )
        .filter(Code.user_id == user.id, Code.status == CodeStatus.RESERVED.value)
        .order_by(desc(Code.requested_at))
        .all()
    )

    return codes



#
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


