import logging
from fastapi.concurrency import run_in_threadpool
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas.users.users import ReserveRequest, ReserveResponse, BatchCodes, MarkNonUsableRequest, MarkNonUsableResponse
from app.db.users import crud
from app.db.models import User
from app.api.deps import get_db, get_tx_db, get_current_user, session_factory
from app.core.exceptions import (
    NoCodesAvailableError,
    json_error,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/reserve", response_model=ReserveResponse)
async def reserve(
    req: ReserveRequest,
    current_user = Depends(get_current_user),
):
    # try:
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

    # except NoCodesAvailableError:
    #     return json_error(409, "no_codes_available", "No codes available right now.")
    #
    # except Exception:
    #     # logger.exception("reserve_failed")
    #     return json_error(500, "reserve_failed", "Server error while reserving code.")
    #


@router.get("/my", summary="List my reserved codes")
async def list_my_codes( current_user = Depends(get_current_user)):
    # try:
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
    # except NoCodesAvailableError:
    #     return json_error(409, "no_codes_available", "No codes available right now.")
    # except Exception:
    #     return json_error(500, "Failed to fetch reserved codes(s)", "Server error while reserving code.")



@router.post("/release")
async def release_code(
    payload: BatchCodes,
    current_user: User = Depends(get_current_user)
):
    # try:
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
    # except ValueError:
    #
    #     return json_error(404,f"Code '{payload.code}' not found.","Failed to release reserved codes.")
    # except Exception:
    #     # logger.exception("release_reserved failed")
    #     return json_error(500, "release_reserved_failed", "Failed to release reserved codes.")


# @router.post("/mark-non-usable", response_model=MarkNonUsableResponse)
# async def mark_non_usable_endpoint(
#     payload: MarkNonUsableRequest,
#     current_user: User = Depends(get_current_user),
#     db: Session = Depends(get_tx_db),
# ):
#     try:
#         updated = await run_in_threadpool( crud.mark_non_usable,
#                                            db=db,
#                                            user=current_user,
#                                            code=payload.codes,
#                                            reason=payload.reason,
#                                            )
#         # db.commit()
#         return {
#             "updated": updated,
#             "requested": payload.codes,
#         }
#     except Exception:
#         # db.rollback()
#         # logger.exception("mark_non_usable failed")
#         return json_error(500, "mark_non_usable_failed", "Failed to mark codes as non-usable.")
