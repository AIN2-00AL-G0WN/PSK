from pydantic import BaseModel, EmailStr, constr, Field
from typing import Optional,Literal
import uuid
from datetime import datetime


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


# class DeleteUserResponse(BaseModel):
#     team_name: str = Field(..., example="HSV")
#     user_name: str = Field(..., example="Flowers")
#     contact_email: str = Field(..., example="user@example.com")
#     class Config:
#         from_attributes = True


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

class GetUsersResponse(UpdateUserResponse):
    id: int

class AddEkCodesRequest(BaseModel):
    code_type: Literal["OSV", "HSV", "COMMON"] = Field(..., description="OSV | HSV | COMMON")
    region: str = Field(example="Asia")
    codes:list[str]= Field(example="Asia_00000001111")

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