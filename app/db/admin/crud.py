import uuid
import  time
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import NoCodesAvailableError,UserNotFound,UserHasReservedCodesError
from sqlalchemy import desc, func
from datetime import datetime
from sqlalchemy import  update
from app.core.security import get_password_hash
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
                is_admin: str
                ):
    start = time.time()
    hashed_password = get_password_hash(password)
    print(f"Hashing took {time.time() - start:.2f} seconds")
    new_user=User(team_name=team_name,
                  user_name=user_name,
                  contact_email=contact_email,
                  password_hash=hashed_password,
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
        is_admin: str
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
