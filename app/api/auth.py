from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.auth import Token, UserOut
from app.api.deps import get_db, get_current_user, oauth2_scheme
from app.core.security import verify_password, create_access_token
from app.db.models import User
from sqlalchemy.orm import Session
from app.config import settings
from fastapi.security import OAuth2PasswordRequestForm

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.contact_email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect credentials")

    # Derive code_type from team_name or user object
    if "osv" in user.team_name.lower():
        code_type = "OSV"
    elif "hsv" in user.team_name.lower():
        code_type = "HSV"
    else:
        code_type = "COMMON"

    token = create_access_token(
        subject=str(user.id),
        team_name=user.team_name,
        code_type=code_type
    )
    # return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIiwiZXhwIjoxNzU5MzA3OTI1LCJ0ZWFtX25hbWUiOiJPU1YiLCJjb2RlX3R5cGUiOiJPU1YifQ.PdA7OqiriUF4ORjYZcdRM1nm5RVECI0GStqYCF3zdiw"

    return Token(access_token=token, expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)

@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut(id=current_user.id, team_name=current_user.team_name, contact_email=current_user.contact_email, is_admin=current_user.is_admin)

@router.post("/logout")
def logout(token: str = Depends(oauth2_scheme)):
    # Stateless logout: client should discard token
    return {"msg": "logged out — please discard your token"}
