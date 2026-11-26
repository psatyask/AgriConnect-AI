from typing import Annotated, Literal

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import google as google_mod
from .config import settings
from .db import get_db
from .models import Role, User
from .security import create_session, delete_session, find_session_user, hash_password, verify_password

router = APIRouter(prefix="/api")
COOKIE = "agri_session"
SelfRole = Literal["farmer", "buyer"]  # admin can never be chosen by a client


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    picture: str | None
    role: Role


def _out(u: User) -> UserOut:
    return UserOut(id=str(u.id), email=u.email, name=u.name, picture=u.picture, role=u.role)


class GoogleIn(BaseModel):
    credential: str = Field(min_length=10)
    role: SelfRole | None = None  # required only the first time an account is created


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    name: str = Field(default="", max_length=200)
    role: SelfRole


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


def _start(db: Session, user: User, response: Response) -> UserOut:
    token = create_session(db, user)
    response.set_cookie(
        COOKIE, token, max_age=settings.session_days * 86400, httponly=True,
        samesite="lax", secure=settings.cookie_secure, path="/",
    )
    return _out(user)


@router.get("/config")
def public_config() -> dict:
    """Public settings the browser needs. The Google client ID is not a secret."""
    return {"googleClientId": settings.google_oauth_client_id.strip() if settings.google_configured else None}


@router.post("/auth/google")
def google_sign_in(body: GoogleIn, response: Response, db: Annotated[Session, Depends(get_db)]) -> UserOut:
    try:
        claims = google_mod.verify_google_credential(body.credential)
    except google_mod.GoogleTokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
    except google_mod.GoogleUnavailable as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    sub, email = claims["sub"], claims["email"].lower()
    user = db.scalar(select(User).where(User.google_sub == sub))
    if user is None:
        user = db.scalar(select(User).where(User.email == email))
        if user is not None:
            # Link an existing email account. If it was a password account whose email was never
            # verified, drop that password: someone could have pre-registered this address.
            if not user.email_verified:
                user.password_hash = None
            user.google_sub, user.email_verified = sub, True
        else:
            if body.role is None:
                raise HTTPException(status.HTTP_409_CONFLICT, "role_required")
            user = User(email=email, email_verified=True, google_sub=sub, role=Role(body.role))
            db.add(user)
    user.name = user.name or claims.get("name", "")
    user.picture = claims.get("picture") or user.picture
    db.commit()
    return _start(db, user, response)


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, response: Response, db: Annotated[Session, Depends(get_db)]) -> UserOut:
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(email=email, name=body.name, password_hash=hash_password(body.password), role=Role(body.role))
    db.add(user)
    db.commit()
    return _start(db, user, response)


@router.post("/auth/login")
def login(body: LoginIn, response: Response, db: Annotated[Session, Depends(get_db)]) -> UserOut:
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not verify_password(user.password_hash if user else None, body.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password")
    return _start(db, user, response)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, db: Annotated[Session, Depends(get_db)], agri_session: Annotated[str | None, Cookie()] = None) -> None:
    delete_session(db, agri_session)
    response.delete_cookie(COOKIE, path="/")


def current_user(db: Annotated[Session, Depends(get_db)], agri_session: Annotated[str | None, Cookie()] = None) -> User:
    user = find_session_user(db, agri_session)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    return user


def require_role(*roles: Role):
    """Roles are checked on the server from the database; the browser's claim is never trusted."""
    def dep(user: Annotated[User, Depends(current_user)]) -> User:
        if user.role not in roles and user.role != Role.admin:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed for your role")
        return user
    return dep


@router.get("/auth/me")
def me(user: Annotated[User, Depends(current_user)]) -> UserOut:
    return _out(user)


@router.get("/farmer/overview")
def farmer_overview(user: Annotated[User, Depends(require_role(Role.farmer))]) -> dict:
    return {"role": user.role, "message": "Farmer area. Real listings arrive with the marketplace API."}


@router.get("/buyer/overview")
def buyer_overview(user: Annotated[User, Depends(require_role(Role.buyer))]) -> dict:
    return {"role": user.role, "message": "Buyer area. Real listings arrive with the marketplace API."}
