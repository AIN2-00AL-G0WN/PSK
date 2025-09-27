from fastapi.responses import JSONResponse


def json_error(status_code: int, code: str, message: str, details: dict | None = None):
    """
    helper to return error response in a consistent way
    """
    body = {
        "error": code,
        "message": message
    }
    if details:
        body["details"] = details
    return JSONResponse(status_code=status_code, content=body)


class AppError(Exception):
    # base class for domain errors
    def __init__(self, message: str | None = None):
        super().__init__(message)
        self.message = message


class NoCodesAvailableError(AppError):
    """ raised when no codes remain to reserve """


class ReservationExpiredError(AppError):
    """ raised when someone tries to confirm after reservation expired """


class InvalidReservationError(AppError):
    """ raised when token is invalid or code is in wrong state """


class PermissionDeniedError(AppError):
    """ raised when non-admin tries an admin-only action """
