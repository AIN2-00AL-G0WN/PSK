import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.models import User
from app.api.deps import get_db, admin_required, get_tx_db
from app.schemas.admin.admin import GetCountResponse
from app.db.admin.crud import get_code_count
from app.core.exceptions import NoCodesAvailableError, json_error

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/count")
def get_count(db: Session = Depends(get_db)
              ,admin: User =Depends(admin_required)) -> GetCountResponse:
    try:
        count = get_code_count(db)
        total = sum(count.values())
        return GetCountResponse(
            total = total,
            can_be_used = count.get("can_be_used", 0),
            reserved = count.get("reserved", 0),
            non_usable = count.get("non_usable", 0))

    except NoCodesAvailableError:
        return json_error(404,"No codes in the database","Please provide some ek codes")

@router.post("/users/create")
def create_user(db :Session = Depends(get_tx_db),
                _=Depends(admin_required),
                req = ):
