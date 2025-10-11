from pydantic import BaseModel, EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class LoginRequest(BaseModel):
    contact_email: str
    password: str

class UserOut(BaseModel):
    id: int
    team_name: str
    contact_email: str | None
    is_admin: bool
