# app/schemas/users.py
from pydantic import BaseModel, EmailStr, constr, Field
from typing import Optional
import uuid
from datetime import datetime

class ReserveRequest(BaseModel):
    tester_name: str = Field(..., example="John Doe")
    region: Optional[str] = Field(None, example="Asia")

    class Config:
        from_attributes = True


class ReserveResponse(BaseModel):
    code: constr(min_length=16, max_length=16)
    reservation_token: uuid.UUID

    class Config:
        from_attributes = True


class ConfirmRequest(BaseModel):
    code: constr(min_length=16, max_length=16)
    reservation_token: uuid.UUID
    tester_gmail: EmailStr

    class Config:
        from_attributes = True


class CodeRow(BaseModel):
    code: str
    tester_name: Optional[str] = None
    tester_gmail: Optional[str] = None
    region: Optional[str] = None
    requested_at: Optional[datetime] = None
    reservation_token: Optional[str] = None
    status: str
    note: Optional[str] = None

    class Config:
        from_attributes = True


class BatchCodes(BaseModel):
    code: constr(min_length=16, max_length=16)
    clearance_id: Optional[str] = None
    note: Optional[str] = None

    class Config:
        from_attributes = True


class MarkNonUsableRequest(BaseModel):
    codes: constr(min_length=16, max_length=16)
    reason: Optional[str] = None

    class Config:
        from_attributes = True


class MarkNonUsableResponse(BaseModel):
    updated: constr(min_length=16, max_length=16)
    requested: constr(min_length=16, max_length=16)

    class Config:
        from_attributes = True


class ReservedCOdesLogs(BaseModel):
    pass

class ReleasedCodesLogs(BaseModel):
    pass
