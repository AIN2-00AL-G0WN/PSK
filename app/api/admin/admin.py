import logging
from typing import Callable
from wsgiref.util import request_uri
from datetime import datetime
from typing import Optional
from fastapi.concurrency import run_in_threadpool
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import Enum
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from app.db.models import User
from fastapi import  status
from app.api.deps import session_factory,admin_required,get_current_user
from app.schemas.admin.admin import GetCountResponse,CreateUserResponse,CreateUserRequest,UpdateUserRequest,UpdateUserResponse,DeleteUserRequest,GetUsersResponse,AddEkCodesRequest,AddEkCodeResponse,LogsResponse,LogSchema
from app.db.admin import crud
from app.core.exceptions import NoCodesAvailableError, json_error,UserHasReservedCodesError,UserNotFound
from app.core.security import get_password_hash
from app.db.models import CodeStatus, CodeType
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 20

@router.get("/count")
async def get_count(
        _=Depends(admin_required)) -> GetCountResponse:
    try:
        def work():
            with session_factory() as db:
                return crud.get_code_count(db=db)
        count = await run_in_threadpool(work)
        total = sum(count.values())
        return GetCountResponse(
            total = total,
            can_be_used = count.get("can_be_used", 0),
            reserved = count.get("reserved", 0),
            non_usable = count.get("non_usable", 0))

    except NoCodesAvailableError:
        return json_error(404,"No codes in the database","Please provide some ek codes")

@router.post("/users/create", response_model=CreateUserResponse)
async def create_user(
                _=Depends(admin_required),
                req : CreateUserRequest = Depends()):
    try:
        def work():
            with session_factory() as db:
                try:
                    result = crud.create_user(
                    db,
                    req.team_name,
                    req.user_name,
                    req.contact_email,
                    hashed_password,
                    req.is_admin
                    )
                    db.commit()
                    return result
                except Exception as e:
                    db.rollback()
                    raise e
        hashed_password = await run_in_threadpool(get_password_hash,req.password)
        user= await run_in_threadpool(work)
        return user
    except:
        return json_error(500,f"{status.HTTP_500_INTERNAL_SERVER_ERROR}","Something went wrong")


@router.get("/users/get-users", response_model=list[GetUsersResponse])
async def get_users(
                _= Depends(admin_required)):
    try:
        def work():
            with session_factory() as db:
                return crud.get_users(db = db)
        users= await run_in_threadpool(work)
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
async def update_user(
        _= Depends(admin_required),
        req: UpdateUserRequest = Depends()
):
    try:
        def work():
            with session_factory() as db:
                try:
                    user = crud.update_user(db=db,
                                            id=req.id,
                                            team_name=req.team_name,
                                            user_name=req.user_name,
                                            contact_email=req.contact_email,
                                            password=req.password,
                                            is_admin=req.is_admin)
                    db.commit()
                    db.refresh(user)
                    return user
                except Exception as e:
                    db.rollback()
                    raise e
        updated_user = await run_in_threadpool(work)
        return updated_user
    except UserNotFound as e:
        return json_error(404, f"{status.HTTP_404_NOT_FOUND}","User not found")
    except Exception as e:
        return {"error": "Failed to update user"}


@router.delete("/users/delete")
async def delete_user(
        _=Depends(admin_required),
        req: DeleteUserRequest =Depends()
):
    try:
        def work():
            with session_factory() as db:
                try:
                    crud.delete_user(db = db,user_id = req.id)
                    db.commit()
                except Exception as e:
                    db.rollback()
                    raise e

        await run_in_threadpool(work)
        return   {"message": "User deleted successfully"}
    except UserNotFound:
        return json_error(404,"User not found","Unable to locate the user in the database")
    except UserHasReservedCodesError as e:
        return json_error(401, f"{status.HTTP_401_UNAUTHORIZED}", e.message)
    except:
        return json_error(500,"Something went wrong","Unable to delete the user from the database")


@router.post("/codes/add")
async def add_ek_code(
    req: AddEkCodesRequest = Depends(),
    _: bool = Depends(admin_required),
    current_user = Depends(get_current_user)
)->AddEkCodeResponse:
    try:
        def work():
            with session_factory() as db:
                try:
                    result = crud.bulk_add_codes(
                        db=db,
                        code_type=req.code_type,
                        region=req.region,
                        codes=req.codes,
                        contact_email = current_user.contact_email,
                        user_name = current_user.user_name,
                    )
                    db.commit()
                    return result
                except Exception as e:
                    db.rollback()
                    raise e

        result = await run_in_threadpool(work)
        return result

    except ValueError as ve:
        return json_error(400, "invalid_input", str(ve))
    except IntegrityError:
        return json_error(409, "conflict", "One or more codes conflict with existing data.")
    except SQLAlchemyError:
        return json_error(500, "db_error", "Database error while adding codes.")
    except Exception:
        logger.exception("bulk_add_unexpected_error")
        return json_error(500, "unexpected_error", "Unexpected server error.")


@router.get("codes/all")
async def get_all_codes(_=Depends(admin_required)):
    try:

        def work():
            with session_factory() as db:
                return crud.get_codes_grouped(db)

        rows = await run_in_threadpool(work)
        result = {
            CodeType.OSV.value: {"reserved": [], "can_be_used": []},
            CodeType.HSV.value: {"reserved": [], "can_be_used": []},
            CodeType.COMMON.value: {"reserved": [], "can_be_used": []},
        }

        for c in rows:
            if c.status.value == CodeStatus.RESERVED.value:
                result[c.code_type]["reserved"].append(c.code)
            elif c.status.value == CodeStatus.CAN_BE_USED.value:
                result[c.code_type]["can_be_used"].append(c.code)

        return result
    except Exception:
        logger.exception("delete_code_unexpected_error")
        return json_error(500, "unexpected_error", "Unexpected server error.")


@router.delete("/codes/{code}")
async def delete_code(
    code: str,
    _=Depends(admin_required),
    current_user = Depends(get_current_user)
):
    try:
        def work():
            try:
                with session_factory() as db:
                    crud.delete_code(db,code=code,
                                     user_name=current_user.user_name,
                                     contact_email=current_user.contact_email)

                    db.commit()
            except Exception as e:
                db.rollback()
                raise e
        await run_in_threadpool(work)
        return {"message": f"Deleted {code}"}
    except NoCodesAvailableError:
        return json_error(404, "not_found", "Code does not exist or is reserved.")
    except Exception:
        logger.exception("delete_code_unexpected_error")
        return json_error(500, "unexpected_error", "Unexpected server error.")


@router.get("/logs", response_model=LogsResponse)
async def get_logs(
    page: int = Query(1, ge=1, description="Page number starting from 1"),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, description="Items per page"),
    code: Optional[str] = Query(None, description="Filter by code"),
    user_name: Optional[str] = Query(None, description="Filter by user name"),
    start_date: Optional[str] = Query(None, description="Start date in ISO format (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date in ISO format (YYYY-MM-DD)"),
):
    try:
        start_dt = datetime.fromisoformat(start_date) if start_date else None
        end_dt = datetime.fromisoformat(end_date) if end_date else None
    except ValueError:
        return json_error(status_code=400, code="Invalid input", message="Invalid date format. Use ISO format YYYY-MM-DD.")

    if start_dt and end_dt and start_dt > end_dt:
        return json_error(status_code=400, code="Invalid input", message="start_date cannot be after end_date.")

    offset = (page - 1) * page_size

    def work():
        with session_factory() as db:
            return crud.get_logs_filtered(
                db=db,
                code=code,
                user_name=user_name,
                start_date=start_dt,
                end_date=end_dt,
                offset=offset,
                limit=page_size,
            )

    try:
        total_count, logs = await run_in_threadpool(work)

        # Convert Log ORM objects to Pydantic schema objects
        logs_response = [LogSchema.from_orm(log) for log in logs]

        return LogsResponse(total_count=total_count, logs=logs_response)

    except Exception:
        logger.exception("get_logs_unexpected_error")
        return json_error(500, "unexpected_error", "Unexpected server error.")
