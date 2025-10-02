from pydantic import BaseModel, EmailStr, constr, Field
from typing import Optional
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
