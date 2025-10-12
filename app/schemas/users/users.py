from pydantic import BaseModel, EmailStr, constr, Field, computed_field
from typing import Optional
import uuid
from datetime import datetime

class ReserveRequest(BaseModel):
    tester_name: str = Field(..., example="John Doe")
    country: str = Field(None, example="UK")
    code_type: str = Field(None, example="OSV")

    class Config:
        from_attributes = True


class ReserveResponse(BaseModel):
    code: str
    code_type: str = Field(None, example="OSV")
    reservation_token: uuid.UUID

    class Config:
        from_attributes = True

class CodeRow(BaseModel):
    code: str
    tester_name: Optional[str] = None
    tester_gmail: Optional[EmailStr] = None
    requested_at: Optional[datetime] = None
    reservation_token: Optional[str] = None
    status: str
    note: Optional[str] = None
    countries:list[str]
    regions :list[set[str]]

    @computed_field(return_type=str)
    @property
    def requested_at_str(self):
        if self.requested_at is None:
            return None
        return self.requested_at.strftime("%d-%m-%Y %I:%M:%S %p")
    class Config:
        from_attributes = True


class BatchCodes(BaseModel):
    code: str
    clearance_id: Optional[str] = None
    note: Optional[str] = None

    class Config:
        from_attributes = True


class MarkNonUsableRequest(BaseModel):
    codes: str
    reason: Optional[str] = None

    class Config:
        from_attributes = True


class MarkNonUsableResponse(BaseModel):
    updated: str
    requested: str

    class Config:
        from_attributes = True


class ReservedCOdesLogs(BaseModel):
    pass

class ReleasedCodesLogs(BaseModel):
    pass
class LogSchema(BaseModel):
    id: int
    code: str
    clearance_id: Optional[str] = None
    user_name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    tester_name: Optional[str] = None
    action: str
    note: Optional[str] = None
    logged_at: datetime

    @computed_field(return_type=str)
    @property
    def logged_at_str(self):
        return self.logged_at.strftime("%d-%m-%Y %I:%M:%S %p")
    class Config:
        from_attributes = True

class LogsResponse(BaseModel):
    logs: list[LogSchema]

class GetAllCountriesResponse(BaseModel):
    id:int
    country:str
    class Config:
        from_attributes = True



# class ConfirmRequest(BaseModel):
#     code: str
#     reservation_token: uuid.UUID
#     tester_gmail: EmailStr
#
#     class Config:
#         from_attributes = True