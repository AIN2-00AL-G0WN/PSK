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

class CodeBulkAddError(AppError):
    """ raised when admin tries to add HSV | OSV codes without country or the input parameters doesn't match the request schema """

class ReservationExpiredError(AppError):
    """ raised when someone tries to confirm after reservation expired """


class InvalidReservationError(AppError):
    """ raised when token is invalid or code is in wrong state """


class PermissionDeniedError(AppError):
    """ raised when non-admin tries an admin-only action """

class UsersOnlyError(AppError):
    """ raised when non-user tries a user-only action"""

class UserNotFound(AppError):
    """raised when user is not present in the database"""

class UserHasReservedCodesError(AppError):
    """raised when the admin tries to delete the user, but the user has some reserved codes"""
