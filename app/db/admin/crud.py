import uuid
from app.core.exceptions import NoCodesAvailableError
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