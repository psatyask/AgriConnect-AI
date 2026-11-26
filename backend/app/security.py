import hashlib
import secrets
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy.orm import Session

from .config import settings
from .models import AuthSession, User, utcnow

_hasher = PasswordHasher()
# Verified against when the email is unknown, so login timing does not reveal which emails exist.
_DUMMY_HASH = _hasher.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(stored: str | None, password: str) -> bool:
    try:
        return _hasher.verify(stored or _DUMMY_HASH, password) and stored is not None
    except (VerificationError, InvalidHashError):
        return False


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    db.add(AuthSession(token_hash=_digest(token), user_id=user.id, expires_at=utcnow() + timedelta(days=settings.session_days)))
    user.last_login_at = utcnow()
    db.commit()
    return token


def find_session_user(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    s = db.get(AuthSession, _digest(token))
    if s is None:
        return None
    if s.expires_at <= utcnow():
        db.delete(s)
        db.commit()
        return None
    return s.user


def delete_session(db: Session, token: str | None) -> None:
    if token and (s := db.get(AuthSession, _digest(token))):
        db.delete(s)
        db.commit()
