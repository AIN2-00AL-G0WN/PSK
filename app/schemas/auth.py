from pydantic import BaseModel, EmailStr,model_validator

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class LoginRequest(BaseModel):
    contact_email: EmailStr
    password: str
    @model_validator(mode="before")
    @classmethod
    def preprocess_input(cls,values):
        values['contact_email'] = values['contact_email'].strip().lower()
        values['password'] = values['password'].strip()
        return values


class UserOut(BaseModel):
    id: int
    team_name: str
    contact_email: EmailStr | None
    is_admin: bool
    team_name: str
