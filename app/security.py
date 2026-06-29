"""Authentication, password hashing, and ownership checks."""
from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import dataclass

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings, get_settings


PBKDF2_ITERATIONS = 600_000
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS,
        base64.urlsafe_b64encode(salt).decode(),
        base64.urlsafe_b64encode(digest).decode(),
    )


def verify_password(password: str, stored: str | None) -> tuple[bool, bool]:
    """Return (valid, should_rehash), supporting legacy SHA-256/raw records."""
    if not stored:
        return False, False
    if stored.startswith("pbkdf2_sha256$"):
        try:
            _, iterations, salt, expected = stored.split("$", 3)
            digest = hashlib.pbkdf2_hmac(
                "sha256", password.encode(), base64.urlsafe_b64decode(salt), int(iterations)
            )
            return hmac.compare_digest(base64.urlsafe_b64encode(digest).decode(), expected), False
        except (TypeError, ValueError, binascii.Error):
            return False, False

    legacy_sha = hashlib.sha256(password.encode()).hexdigest()
    if hmac.compare_digest(stored, legacy_sha) or hmac.compare_digest(stored, password):
        return True, True
    return False, False


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def create_access_token(account_id: str, settings: Settings) -> str:
    header = _b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64encode(json.dumps({
        "sub": account_id,
        "iat": int(time.time()),
        "exp": int(time.time()) + settings.auth_token_ttl_seconds,
        "nonce": secrets.token_hex(8),
    }, separators=(",", ":")).encode())
    signature = _b64encode(hmac.new(settings.auth_secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{signature}"


def decode_access_token(token: str, settings: Settings) -> str:
    try:
        header, payload, signature = token.split(".")
        expected = _b64encode(hmac.new(settings.auth_secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            raise ValueError("invalid signature")
        claims = json.loads(_b64decode(payload))
        if int(claims["exp"]) < int(time.time()):
            raise ValueError("expired")
        return str(claims["sub"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="登录已失效，请重新登录")


@dataclass(frozen=True)
class AccountPrincipal:
    account_id: str


def get_current_account(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> AccountPrincipal:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="请先登录")
    return AccountPrincipal(decode_access_token(credentials.credentials, settings))


def require_account(principal: AccountPrincipal, account_id: str) -> None:
    if not hmac.compare_digest(principal.account_id, account_id):
        raise HTTPException(status_code=403, detail="无权访问该家庭账户")


def require_child(store, principal: AccountPrincipal, child_id: str) -> None:
    account = store.get_family_account(principal.account_id)
    if not account or not any(child.id == child_id for child in account.children):
        raise HTTPException(status_code=404, detail="未找到孩子档案")


def public_account(account) -> dict:
    return account.model_dump(mode="json", exclude={"password_hash"})
