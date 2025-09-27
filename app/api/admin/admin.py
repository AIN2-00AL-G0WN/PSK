## import logging
# from fastapi import APIRouter, Depends
# from sqlalchemy.orm import Session
# from app.schemas.codes import ReserveRequest, ReserveResponse, BatchCodes, MarkNonUsableRequest, MarkNonUsableResponse
# from app.db.admin import crud
# from app.db.models import User
# from app.api.deps import get_db, get_tx_db, get_current_user
# from app.core.exceptions import (
#     NoCodesAvailableError,
#     json_error,
# )
#
# logger = logging.getLogger(__name__)
#
# logger = logging.getLogger(__name__)
#
# router = APIRouter(prefix="/admin", tags=["admin"])
#
#
# @router.get("/count")
# def get_count(db: Session = Depends(get_db)):
#     try:
#         result=