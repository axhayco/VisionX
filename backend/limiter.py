import logging
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

logger = logging.getLogger(__name__)


def get_rate_limit_key(request: Request) -> str:
    """Returns a unique rate limit identifier per client.

    Uses the JWT token (cookie or Authorization header) for authenticated users,
    falling back to client IP address.
    """
    token = request.cookies.get("access_token")
    if token:
        return f"auth:{token[:32]}"

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return f"auth:{auth_header[7:39]}"

    return get_remote_address(request)


limiter = Limiter(key_func=get_rate_limit_key)
