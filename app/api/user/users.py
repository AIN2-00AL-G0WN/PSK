import logging
from fastapi.concurrency import run_in_threadpool
from fastapi import APIRouter, Depends
from app.schemas.users.users import (ReserveRequest,
                                     ReserveResponse,
                                     BatchCodes,
                                     LogsResponse,
                                     LogSchema,
                                     MarkNonUsableRequest,
                                     MarkNonUsableResponse,
                                     GetAllCountriesResponse)
from app.db.users import crud
from app.db.models import User
from app.api.deps import  user_required, session_factory
from app.core.exceptions import (
    NoCodesAvailableError,
    json_error,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/reserve", response_model=ReserveResponse)
async def reserve(
    req: ReserveRequest,
    current_user = Depends(user_required),
):
    try:
        def work():
            with session_factory() as db:
                try:
                     code = crud.reserve_one_code(
                        db=db,
                        user=current_user,
                        tester_name=req.tester_name,
                        country =req.country,
                        code_type=req.code_type)
                     db.commit()
                     return code
                except Exception as e:
                    db.rollback()
                    raise e

        code = await run_in_threadpool(work)
        return ReserveResponse(code=code.code, code_type=code.code_type, reservation_token=code.reservation_token)  # or custom dict output

    except NoCodesAvailableError:
        return json_error(409, "no_codes_available", "No codes available right now.")

    except Exception:
        # logger.exception("reserve_failed")
        return json_error(500, "reserve_failed", "Server error while reserving code.")



@router.get("/my", summary="List my reserved codes")
async def list_my_codes( current_user = Depends(user_required)):
    try:
        def work():
            with session_factory() as db:
                try:
                     codes = crud.list_of_codes(db=db, user = current_user)
                     print(codes)
                     result = []
                     for code in codes:
                         result.append({
                             "code": code.code,
                             "tester_name": code.tester_name,
                             "requested_at": code.requested_at,
                             "reservation_token": code.reservation_token,
                             "status": code.status.value,
                             "note": code.note,
                             "countries": [c.name for c in code.countries],
                             "regions": list({c.region.name for c in code.countries if c.region}),  # dedupe regions
                         })
                     return result

                except Exception as e:
                    raise e

        rows= await run_in_threadpool(work)
        return [dict(r) for r in rows]
    except NoCodesAvailableError:
        return json_error(409, "no_codes_available", "No codes available right now.")
    except Exception:
        return json_error(500, "Failed to fetch reserved codes(s)", "Server error while reserving code.")



@router.post("/release")
async def release_code(
    payload: BatchCodes,
    current_user: User = Depends(user_required)
):
    try:
        def work():
            with session_factory() as db:
                try:
                    released = crud.release_reserved_code(
                        db=db,
                        code=payload.code,
                        clearance_id=payload.clearance_id,
                        note=payload.note,
                        user=current_user,
                    )
                    db.commit()
                    return released
                except Exception as e:
                    db.rollback()
                    raise e
        released = await run_in_threadpool(work)
        return {"released": released, "requested": payload.code, "clearance_id": payload.clearance_id}
    except ValueError:
        return json_error(404,f"Code '{payload.code}' not found.","Failed to release reserved codes.")
    except Exception:
        # logger.exception("release_reserved failed")
        return json_error(500, "release_reserved_failed", "Failed to release reserved codes.")


@router.get("/logs", response_model=LogsResponse)
async def get_user_logs(user: User =Depends(user_required),):
    try:
        def work():
            with session_factory() as db:
                return crud.user_logs(db=db,user_id=user.id)
        logs = await run_in_threadpool(work)
        logs_response = [LogSchema.from_orm(log) for log in logs]
        return LogsResponse(logs=logs_response)
    except Exception as e:
        raise e


@router.get("/countries",response_model=list[GetAllCountriesResponse])
async def get_all_countries(_=Depends(user_required),):
    try:
        def work():
            with session_factory() as db:
                return crud.get_all_countries(db)

        result = await run_in_threadpool(work)
        return [{"id": row.id, "country": row.name} for row in result]


    except Exception as e:
        raise e

