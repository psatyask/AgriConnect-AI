"""terminal market prices: wider variety/grade/unit, unit is part of the unique key

Revision ID: 0005
Revises: 0004
"""
from alembic import op
import sqlalchemy as sa


revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None

OLD = ("source", "state", "district", "market", "commodity_raw", "variety", "grade", "obs_date")


def upgrade() -> None:
    op.alter_column('price_observations', 'variety', type_=sa.String(length=200), existing_nullable=False)
    op.alter_column('price_observations', 'grade', type_=sa.String(length=200), existing_nullable=False)
    op.alter_column('price_observations', 'unit', type_=sa.String(length=100), existing_nullable=False)
    op.drop_constraint('uq_price_observation', 'price_observations', type_='unique')
    op.create_unique_constraint('uq_price_observation', 'price_observations', [*OLD, 'unit'])


def downgrade() -> None:
    op.drop_constraint('uq_price_observation', 'price_observations', type_='unique')
    op.create_unique_constraint('uq_price_observation', 'price_observations', list(OLD))
    op.alter_column('price_observations', 'unit', type_=sa.String(length=20), existing_nullable=False)
    op.alter_column('price_observations', 'grade', type_=sa.String(length=40), existing_nullable=False)
    op.alter_column('price_observations', 'variety', type_=sa.String(length=100), existing_nullable=False)
