import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from .auth import require_role
from .db import get_db
from .models import Inquiry, Listing, ListingStatus, Role, User

router = APIRouter(prefix="/api")
Slug = Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{1,39}$")]
Region = Annotated[str, Field(pattern=r"^[A-Z]{2}$")]
Unit = Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,19}$")]
Farmer = Annotated[User, Depends(require_role(Role.farmer))]
Buyer = Annotated[User, Depends(require_role(Role.buyer))]
Db = Annotated[Session, Depends(get_db)]


class ListingIn(BaseModel):
    region_code: Region
    commodity: Slug
    variety: str = Field(default="", max_length=100)
    grade: str = Field(default="", max_length=40)
    place: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=2000)
    unit: Unit
    quantity: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    currency: Annotated[str, Field(pattern=r"^[A-Z]{3}$")]


class ListingPatch(BaseModel):
    quantity: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=3)
    price: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    description: str | None = Field(default=None, max_length=2000)
    status: ListingStatus | None = None


class ListingOut(BaseModel):
    id: str
    region_code: str
    commodity: str
    variety: str
    grade: str
    place: str
    description: str
    unit: str
    quantity: float
    price: float
    currency: str
    status: ListingStatus
    created_at: str
    farmer_name: str


def _out(l: Listing) -> ListingOut:
    return ListingOut(
        id=str(l.id), region_code=l.region_code, commodity=l.commodity, variety=l.variety, grade=l.grade,
        place=l.place, description=l.description, unit=l.unit, quantity=float(l.quantity), price=float(l.price),
        currency=l.currency, status=l.status, created_at=l.created_at.isoformat(),
        farmer_name=l.farmer.name or "Farmer",  # never the email
    )


@router.get("/listings")
def browse(
    db: Db,
    region: Annotated[str | None, Query(pattern=r"^[A-Z]{2}$")] = None,
    commodity: Annotated[str | None, Query(max_length=40)] = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 24,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict:
    """Public: active listings only, newest first."""
    stmt = select(Listing).where(Listing.status == ListingStatus.active).options(joinedload(Listing.farmer))
    if region:
        stmt = stmt.where(Listing.region_code == region)
    if commodity:
        stmt = stmt.where(Listing.commodity == commodity)
    if q:
        like = f"%{q.strip().replace('%', '').replace('_', '')}%"
        stmt = stmt.where(Listing.place.ilike(like) | Listing.variety.ilike(like))
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    rows = db.scalars(stmt.order_by(Listing.created_at.desc()).limit(limit).offset(offset)).all()
    return {"total": total, "items": [_out(r) for r in rows]}


@router.get("/listings/{listing_id}")
def one(listing_id: uuid.UUID, db: Db) -> ListingOut:
    l = db.scalar(select(Listing).where(Listing.id == listing_id).options(joinedload(Listing.farmer)))
    if l is None or l.status != ListingStatus.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    return _out(l)


@router.post("/listings", status_code=status.HTTP_201_CREATED)
def create(body: ListingIn, user: Farmer, db: Db) -> ListingOut:
    l = Listing(farmer_id=user.id, **body.model_dump())
    db.add(l)
    db.commit()
    return _out(l)


def _own(db: Session, listing_id: uuid.UUID, user: User) -> Listing:
    l = db.scalar(select(Listing).where(Listing.id == listing_id).options(joinedload(Listing.farmer)))
    # 404 (not 403) for someone else's listing, so ids of other farmers' listings are not confirmed.
    if l is None or l.farmer_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    return l


@router.patch("/listings/{listing_id}")
def update(listing_id: uuid.UUID, body: ListingPatch, user: Farmer, db: Db) -> ListingOut:
    l = _own(db, listing_id, user)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(l, field, value)
    db.commit()
    return _out(l)


@router.get("/farmer/listings")
def my_listings(user: Farmer, db: Db) -> dict:
    rows = db.scalars(select(Listing).where(Listing.farmer_id == user.id).options(joinedload(Listing.farmer)).order_by(Listing.created_at.desc())).all()
    counts = dict(db.execute(select(Inquiry.listing_id, func.count()).join(Listing).where(Listing.farmer_id == user.id).group_by(Inquiry.listing_id)).all())
    return {"items": [{**_out(r).model_dump(), "inquiry_count": counts.get(r.id, 0)} for r in rows]}


class InquiryIn(BaseModel):
    message: str = Field(min_length=5, max_length=2000)


class InquiryOut(BaseModel):
    id: str
    listing_id: str
    commodity: str
    message: str
    created_at: str
    buyer_name: str


def _inq(i: Inquiry) -> InquiryOut:
    return InquiryOut(id=str(i.id), listing_id=str(i.listing_id), commodity=i.listing.commodity, message=i.message,
                      created_at=i.created_at.isoformat(), buyer_name=i.buyer.name or "Buyer")


@router.post("/listings/{listing_id}/inquiries", status_code=status.HTTP_201_CREATED)
def inquire(listing_id: uuid.UUID, body: InquiryIn, user: Buyer, db: Db) -> InquiryOut:
    l = db.get(Listing, listing_id)
    if l is None or l.status != ListingStatus.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
    i = Inquiry(listing_id=l.id, buyer_id=user.id, message=body.message.strip())
    db.add(i)
    db.commit()
    return _inq(i)


@router.get("/farmer/inquiries")
def inquiries_received(user: Farmer, db: Db) -> dict:
    """Buyer name and message only. Contact details stay private until the farmer consents (a later feature)."""
    rows = db.scalars(select(Inquiry).join(Listing).where(Listing.farmer_id == user.id)
                      .options(joinedload(Inquiry.listing), joinedload(Inquiry.buyer)).order_by(Inquiry.created_at.desc())).all()
    return {"items": [_inq(i) for i in rows]}


@router.get("/buyer/inquiries")
def inquiries_sent(user: Buyer, db: Db) -> dict:
    rows = db.scalars(select(Inquiry).where(Inquiry.buyer_id == user.id)
                      .options(joinedload(Inquiry.listing), joinedload(Inquiry.buyer)).order_by(Inquiry.created_at.desc())).all()
    return {"items": [_inq(i) for i in rows]}
