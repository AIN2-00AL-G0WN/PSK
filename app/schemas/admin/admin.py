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
        from_attributes = True

class CreateUserRequestModel(BaseModel):
