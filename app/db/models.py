# app/db/models.py
import enum
from sqlalchemy import (
    Column,
    BigInteger,
    Text,
    CHAR,
    TIMESTAMP,
    Enum as SQLEnum,
    ForeignKey,
    String,
    func,
    Index,
    Boolean,
    text as sa_text,
)
from sqlalchemy.orm import validates
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base


class CodeStatus(enum.Enum):
    CAN_BE_USED = "can_be_used"
    RESERVED = "reserved"
    NON_USABLE = "non_usable"


class CodeAction(str, enum.Enum):
    RESERVED = "reserved"
    RELEASED = "released"
    BLOCKED = "blocked"

class CodeType(str, enum.Enum):
    OSV = "OSV"
    HSV = "HSV"
    COMMON = "COMMON"

class UserTeam(str, enum.Enum):
    OSV = "OSV"
    HSV = "HSV"
    ADMIN = "ADMIN"

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)
    team_name = Column(
        SQLEnum(UserTeam, name="user_team", native_enum=True),
        nullable=False,
        unique=True,
        index=True,
    )
    user_name = Column(String(320), nullable=False, unique=False)
    password_hash = Column(Text, nullable=False)
    contact_email = Column(String(320), nullable=False, unique=True)
    is_admin = Column(Boolean, nullable=False, server_default=sa_text("false"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    @validates("team_name")
    def validate_team_name(self, key, value):
        if value not in UserTeam._value2member_map_:
            raise ValueError(f"Invalid team_name '{value}' for User")
        return value


class Code(Base):
    __tablename__ = "codes"

    code = Column(CHAR(16), primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=True, index=True)
    tester_name = Column(Text, nullable=True)
    region = Column(Text, nullable=True)
    requested_at = Column(TIMESTAMP(timezone=True), nullable=True)
    released_at = Column(TIMESTAMP(timezone=True), nullable=True, index=True)
    reservation_token = Column(UUID(as_uuid=True), nullable=True)

    status = Column(
        SQLEnum(
            CodeStatus,
            name="code_status",
            native_enum=True,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=CodeStatus.CAN_BE_USED,
    )

    code_type = Column(
        SQLEnum(CodeType, name="code_type", native_enum=True),
        nullable=False,
        default=CodeType.COMMON.value,
    )

    note = Column(Text, nullable=True)

    __table_args__ = (
        Index("idx_codes_status_reserved", "status", "released_at"),
    )

class Log(Base):
    __tablename__ = "logs"

    id = Column(BigInteger, primary_key=True, index=True)
    code = Column(CHAR(16), nullable=False, index=True)
    clearance_id = Column (Text, nullable=True)
    user_name = Column(String(320), nullable=True)
    contact_email = Column(String(320), index=True)
    tester_name = Column(Text, nullable=True)
    action = Column(
        SQLEnum(CodeAction, name="code_action", native_enum=True),
        nullable=False,
        index=True,
    )

    note = Column(Text, nullable=True)
    logged_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_logs_code_action", "code", "action"),
        Index("idx_logs_contact_action_loggedat", "contact_email", "action", "logged_at"),
    )
