import uuid
from datetime import timedelta

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import create_access_token


def test_token_for_deleted_user_returns_401(client: TestClient) -> None:
    # A correctly signed token whose user no longer exists (e.g. account deleted
    # or database reset) must be rejected as unauthenticated, so clients log out.
    token = create_access_token(uuid.uuid4(), expires_delta=timedelta(minutes=5))
    r = client.get(
        f"{settings.API_V1_STR}/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 401
    assert r.headers["www-authenticate"] == "Bearer"
    assert r.json() == {"detail": "User not found"}
