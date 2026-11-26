import enum
import uuid
from datetime import datetime, timezone

from decimal import Decimal

from datetime import date

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    farmer = "farmer"
    buyer = "buyer"
    admin = "admin"  # never self-assignable; granted only directly in the database


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    name: Mapped[str] = mapped_column(String(200), default="")
    picture: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    google_sub: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(300), nullable=True)
    role: Mapped[Role] = mapped_column(Enum(Role, name="role"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    sessions: Mapped[list["AuthSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class AuthSession(Base):
    """Server-side session. Only a SHA-256 hash of the cookie token is stored."""

    __tablename__ = "auth_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="sessions")


class ListingStatus(str, enum.Enum):
    active = "active"
    sold = "sold"
    closed = "closed"


class Listing(Base):
    """A farmer's produce offer. `commodity` is the canonical id used by the country packs (e.g. tomato, corn)."""

    __tablename__ = "listings"
    __table_args__ = (Index("ix_listings_region_status_created", "region_code", "status", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    farmer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    region_code: Mapped[str] = mapped_column(String(2))
    commodity: Mapped[str] = mapped_column(String(40), index=True)
    variety: Mapped[str] = mapped_column(String(100), default="")
    grade: Mapped[str] = mapped_column(String(40), default="")
    place: Mapped[str] = mapped_column(String(200), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    unit: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3))
    status: Mapped[ListingStatus] = mapped_column(Enum(ListingStatus, name="listing_status"), default=ListingStatus.active)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    farmer: Mapped[User] = relationship()
    inquiries: Mapped[list["Inquiry"]] = relationship(back_populates="listing", cascade="all, delete-orphan")


class Inquiry(Base):
    """A buyer's message about a listing. The buyer's email/phone is NOT shared with the farmer."""

    __tablename__ = "inquiries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    listing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), index=True)
    buyer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    listing: Mapped[Listing] = relationship(back_populates="inquiries")
    buyer: Mapped[User] = relationship()


class PriceObservation(Base):
    """A wholesale price reported by an official source for one market, crop and day."""

    __tablename__ = "price_observations"
    __table_args__ = (
        UniqueConstraint("source", "state", "district", "market", "commodity_raw", "variety", "grade", "obs_date", "unit", name="uq_price_observation"),
        Index("ix_price_lookup", "country", "commodity", "state", "district", "market", "obs_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    country: Mapped[str] = mapped_column(String(2))
    source: Mapped[str] = mapped_column(String(40))
    state: Mapped[str] = mapped_column(String(100))
    district: Mapped[str] = mapped_column(String(100), default="")
    market: Mapped[str] = mapped_column(String(200))
    commodity_raw: Mapped[str] = mapped_column(String(100))
    commodity: Mapped[str | None] = mapped_column(String(40), nullable=True)
    variety: Mapped[str] = mapped_column(String(200), default="")
    grade: Mapped[str] = mapped_column(String(200), default="")
    obs_date: Mapped[date] = mapped_column(Date)
    min_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    max_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    modal_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    unit: Mapped[str] = mapped_column(String(100))
    currency: Mapped[str] = mapped_column(String(3))
    period: Mapped[str] = mapped_column(String(10), default="daily", server_default="daily")
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
