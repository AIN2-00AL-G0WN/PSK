# app/db/models.py
from __future__ import annotations

import enum
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Column,
    BigInteger,
    String,
    Text,
    TIMESTAMP,
    Boolean,
    ForeignKey,
    Index,
    Table,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.types import Enum as SQLEnum

from app.db.base import Base


# ----------------------------
# Enums
# ----------------------------

class CodeStatus(str, enum.Enum):
    CAN_BE_USED = "CAN_BE_USED"
    RESERVED = "RESERVED"
    # IN_USE = "in_use"  # keep if you ever add a confirm step later


class CodeAction(str, enum.Enum):
    RESERVED = "RESERVED"
    RELEASED = "RELEASED"
    DELETED = "DELETED"
    ADDED = "ADDED"
    # If you later want to block/bounce codes again, add:
    # BLOCKED = "blocked"


class CodeType(str, enum.Enum):
    OSV = "OSV"
    HSV = "HSV"
    COMMON = "COMMON"


# ----------------------------
# Geography
# ----------------------------

class Region(Base):
    __tablename__ = "regions"

    id = Column(BigInteger, primary_key=True)
    name = Column(String(128), nullable=False)

    countries = relationship("Country", back_populates="region", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Region {self.name}>"


class Country(Base):
    __tablename__ = "countries"

    id = Column(BigInteger, primary_key=True)
    name = Column(String(128), nullable=False)
    region_id = Column(BigInteger, ForeignKey("regions.id", ondelete="RESTRICT"), nullable=False, index=True)

    region = relationship("Region", back_populates="countries")

    def __repr__(self) -> str:
        return f"<Country {self.name}>"


# ----------------------------
# Association tables (M:N)
# ----------------------------

# Codes can be valid in multiple countries
code_countries = Table(
    "code_countries",
    Base.metadata,
    Column("code", String(64), ForeignKey("codes.code", ondelete="CASCADE"), primary_key=True),
    Column("country_id", BigInteger, ForeignKey("countries.id", ondelete="RESTRICT"), primary_key=True),
    UniqueConstraint("code", "country_id", name="uq_code_country"),
)


# ----------------------------
# Users
# ----------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)

    # free text team name (e.g. "Flowers", "Trill", "Zeus"), indexed for queries
    team_name = Column(String(100), nullable=False, index=True)

    user_name = Column(String(320), nullable=False)
    contact_email = Column(String(320), nullable=False, unique=True, index=True)
    password_hash = Column(Text, nullable=False)

    is_admin = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # codes reserved by this user
    codes = relationship("Code", back_populates="holder", lazy="selectin")

    def __repr__(self) -> str:
        return f"<User {self.user_name} team={self.team_name}>"


# ----------------------------
# Codes
# ----------------------------

class Code(Base):
    __tablename__ = "codes"

    # real codes can contain dashes and vary in length → use String + unique
    code = Column(String(64), primary_key=True, index=True, unique=True)

    # who currently holds it (nullable if available)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    holder = relationship("User", back_populates="codes")

    tester_name = Column(Text, nullable=True)

    # optional free-text region label for UI; authoritative scope is countries (M:N)
    # region_hint = Column(String(64), nullable=True)

    requested_at = Column(TIMESTAMP(timezone=True), nullable=True, index=True)
    released_at = Column(TIMESTAMP(timezone=True), nullable=True, index=True)

    reservation_token = Column(UUID(as_uuid=True), nullable=True)

    status = Column(
        SQLEnum(CodeStatus, name="code_status", native_enum=True),
        nullable=False,
        default=CodeStatus.CAN_BE_USED.value,
        index=True,
    )

    code_type = Column(
        SQLEnum(CodeType, name="code_type", native_enum=True),
        nullable=False,
        default=CodeType.COMMON.value,
        index=True,
    )

    note = Column(Text, nullable=True)

    # countries where this code is valid
    countries = relationship("Country", secondary=code_countries, lazy="selectin")

    __table_args__ = (
        Index("idx_codes_status_requested", "status", "requested_at"),
        Index("idx_codes_type_status", "code_type", "status"),
    )

    def __repr__(self) -> str:
        return f"<Code {self.code} {self.code_type} {self.status}>"


# ----------------------------
# Logs
# ----------------------------

class Log(Base):
    __tablename__ = "logs"

    id = Column(BigInteger, primary_key=True, index=True)

    code = Column(String(64), nullable=False, index=True)

    # (optional) keep user_id for joins; also store human names for fast reporting
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    user_name = Column(String(320), nullable=True)
    contact_email = Column(String(320), nullable=True, index=True)

    tester_name = Column(Text, nullable=True)

    action = Column(SQLEnum(CodeAction, name="code_action", native_enum=True), nullable=False, index=True)

    # denormalized human-readable labels
    region_name = Column(String(128), nullable=True, index=True)    # e.g. "Europe"
    country_name = Column(String(128), nullable=True, index=True)   # e.g. "United Kingdom"

    note = Column(Text, nullable=True)
    logged_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False, index=True)

    __table_args__ = (
        Index("idx_logs_code_action", "code", "action"),
        Index("idx_logs_user_action_time", "user_id", "action", "logged_at"),
        Index("idx_logs_region_country_time", "region_name", "country_name", "logged_at"),
    )