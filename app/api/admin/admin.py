import logging
import time

from fastapi import APIRouter, Depends
from sqlalchemy import Enum
from sqlalchemy.orm import Session
from app.db.models import User
from fastapi import  status
from app.api.deps import get_db, admin_required, get_tx_db
from app.schemas.admin.admin import GetCountResponse,CreateUserResponse,CreateUserRequest,UpdateUserRequest,UpdateUserResponse,DeleteUserRequest,GetUsersResponse
from app.db.admin import crud
from app.core.exceptions import NoCodesAvailableError, json_error,UserHasReservedCodesError,UserNotFound

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/count")
def get_count(db: Session = Depends(get_db)
              ,_=Depends(admin_required)) -> GetCountResponse:
    try:
        count = crud.get_code_count(db)
        total = sum(count.values())
        return GetCountResponse(
            total = total,
            can_be_used = count.get("can_be_used", 0),
            reserved = count.get("reserved", 0),
            non_usable = count.get("non_usable", 0))

    except NoCodesAvailableError:
        return json_error(404,"No codes in the database","Please provide some ek codes")

@router.post("/users/create", response_model=CreateUserResponse)
def create_user(db :Session = Depends(get_tx_db),
                _=Depends(admin_required),
                req : CreateUserRequest = Depends()):
    try:
        user=crud.create_user(db,
                            req.team_name,
                            req.user_name,
                            req.contact_email,
                            req.password,
                            req.is_admin
                        )
        start_commit = time.time()
        db.commit()
        print(f"DB commit took {time.time() - start_commit:.2f} seconds")
        return user
    except:
        db.rollback()
        logger.exception("User creation failed")
        return json_error(500,f"{status.HTTP_500_INTERNAL_SERVER_ERROR}","Something went wrong")


@router.get("/users/get-users", response_model=list[GetUsersResponse])
def get_users(db:Session = Depends(get_db),
              _= Depends(admin_required)):
    try:
        users=crud.get_users(db)
        result = []
        for user in users:
            result.append({
                "id": user.id,
                "team_name": user.team_name.value,
                "user_name": user.user_name,
                "contact_email": user.contact_email,
                "is_admin": user.is_admin,
            })
        return result
    except UserNotFound as e:
        return json_error(404, f"{status.HTTP_404_NOT_FOUND}", e.message)


@router.patch("/users/update", response_model=UpdateUserResponse)
def update_user(
    db: Session = Depends(get_tx_db),
    _= Depends(admin_required),
    req: UpdateUserRequest = Depends()
):
    try:
        updated_user = crud.update_user(
            db=db,
            id=req.id,
            team_name=req.team_name,
            user_name=req.user_name,
            contact_email=req.contact_email,
            password=req.password,
            is_admin=req.is_admin
        )
        db.commit()
        db.refresh(updated_user)
        return updated_user
    except Exception as e:
        db.rollback()
        return {"error": "Failed to update user"}


@router.delete("/users/delete")
def delete_user(
        db:Session = Depends(get_tx_db),
        _=Depends(admin_required),
        req: DeleteUserRequest =Depends()
):
    try:
        crud.delete_user(db,user_id = req.id)
        return   {"message": "User deleted successfully"}
    except UserNotFound:
        db.rollback()
        logger.exception("User deletion failed")
        return json_error(404,"User not found","Unable to locate the user in the database")
    except UserHasReservedCodesError as e:
        db.rollback()
        logger.exception("User deletion failed")
        return json_error(401, f"{status.HTTP_401_UNAUTHORIZED}", e.message)
    except:
        db.rollback()
        logger.exception("User deletion failed")
        return json_error(500,"Something went wrong","Unable to delete the user from the database")