"""price_signals and signal_evidence: offline model reads and the held-out evidence that gates them

Revision ID: 0006
Revises: 0005
"""
from alembic import op
import sqlalchemy as sa

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'price_signals',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('country', sa.String(2), nullable=False),
        sa.Column('source', sa.String(40), nullable=False),
        sa.Column('state', sa.String(100), nullable=False, server_default=''),
        sa.Column('market', sa.String(200), nullable=False),
        sa.Column('commodity', sa.String(40), nullable=False),
        sa.Column('variety', sa.String(200), nullable=False, server_default=''),
        sa.Column('grade', sa.String(200), nullable=False, server_default=''),
        sa.Column('unit', sa.String(100), nullable=False),
        sa.Column('as_of', sa.Date(), nullable=False),
        sa.Column('p_up', sa.Float(), nullable=False),
        sa.Column('other_markets_change', sa.Float(), nullable=True),
        sa.Column('trained_through', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('source', 'market', 'commodity', 'variety', 'grade', 'unit', name='uq_price_signal'),
    )
    op.create_table(
        'signal_evidence',
        sa.Column('commodity', sa.String(40), primary_key=True),
        sa.Column('country', sa.String(2), nullable=False, server_default='US'),
        sa.Column('auc', sa.Float(), nullable=False),
        sa.Column('auc_low', sa.Float(), nullable=False),
        sa.Column('auc_high', sa.Float(), nullable=False),
        sa.Column('min_window_auc', sa.Float(), nullable=False),
        sa.Column('tests', sa.Integer(), nullable=False),
        sa.Column('passes', sa.Boolean(), nullable=False),
        sa.Column('evaluated_through', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('signal_evidence')
    op.drop_table('price_signals')
