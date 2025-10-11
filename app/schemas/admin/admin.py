from pydantic import BaseModel, Field, model_validator
from typing import Optional,Literal
from datetime import datetime
from app.db.models import CodeType

class GetCountResponse(BaseModel):
    total: int = 0
    can_be_used: int = 0
    reserved: int = 0
    non_usable: int = 0
    class Config:
        orm_mode = True


class CreateUserRequest(BaseModel):
    team_name : str =Field(...,example="HSV")
    user_name : str =Field(... , example = "Flowers")
    contact_email : str = Field (..., example="user@example.com")
    password : str = Field(... , example="Rdl@12345")
    is_admin : bool = Field(... , example=False)

    class Config:
        orm_mode = True


class CreateUserResponse(BaseModel):
    team_name : str =Field(...,example="HSV")
    user_name : str =Field(... , example = "Flowers")
    contact_email : str = Field (..., example="user@example.com")
    is_admin : bool = Field(... , example=False)

    class Config:
        orm_mode = True


class DeleteUserRequest(BaseModel):
    id : int

    class Config:
        orm_mode = True


class UpdateUserRequest(BaseModel):
    id: int
    team_name: Optional[str] = Field(None, example="HSV")
    user_name: Optional[str] = Field(None, example="Flowers")
    contact_email: Optional[str] = Field(None, example="user@example.com")
    password: Optional[str] = Field(None, example="Rdl@12345")
    is_admin: Optional[bool] = Field(None, example=False)

    class Config:
        orm_mode = True


class UpdateUserResponse(CreateUserResponse):
    pass




class CodeCountry(BaseModel):
    name: str = Field(..., example="United States")


class ReservedCode(BaseModel):
    code: str = Field(..., example="NAKA-DMAA-AADA-YT01")
    code_type: CodeType
    countries: list[str] = Field(default_factory=list)


class UserWithReservedCodes(BaseModel):
    id: int
    user_name: str
    team_name: str
    contact_email: str
    is_admin: bool
    reserved_count: int
    reserved_codes: list[ReservedCode] = Field(default_factory=list)

    class Config:
        orm_mode = True

class AddEkCodesRequest(BaseModel):
    code_type: Literal["OSV", "HSV", "COMMON"] = Field(..., description="OSV | HSV | COMMON")
    countries: list[str] = Field(example="US,Canada")
    codes:list[str]= Field(example="AAAA-BBBB-CCCC-DDD4")

    @model_validator(mode="after")
    def validate_countries_required(cls, values):
        code_type = values.code_type
        countries = values.countries
        if code_type != "COMMON" and not countries:
            raise ValueError("countries is required unless code_type is 'COMMON'")
        return values

class AddEkCodeResponse(BaseModel):
    inserted:list[str]
    failed:list[tuple[str,str]]

class LogSchema(BaseModel):
    id: int
    code: str
    clearance_id: Optional[str] = None
    user_name: Optional[str] = None
    contact_email: Optional[str] = None
    tester_name: Optional[str] = None
    action: str
    note: Optional[str] = None
    logged_at: datetime

    class Config:
        from_attributes = True

class LogsResponse(BaseModel):
    total_count: int
    logs: list[LogSchema]

# class DeleteEkCodeRequest:
#     pass