from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class TriggerRule(Base):
    """
    SQLAlchemy model representing a routing rule from a vMix event
    to a Yamaha RCP command.
    """
    __tablename__ = "trigger_rules"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # ── Identifiers ──────────────────────────────────────────────
    name = Column(String, index=True, nullable=False, default="Unnamed Rule")
    sort_order = Column(Integer, nullable=False, default=0)
    
    # ── Grouping ─────────────────────────────────────────────────
    group_id = Column(String, nullable=True)
    group_name = Column(String, nullable=True)
    group_color = Column(String, nullable=True)
    
    # ── Source (Ingest) ─────────────────────────────────────
    listen_source = Column(String, nullable=False, default='vmix')
    trigger_event = Column(String, nullable=False)   # e.g., 'TransitionIn', 'YamahaMeter'
    vmix_input_number = Column(Integer, nullable=True) # e.g., 5 or channel to listen
    vmix_input_name = Column(String, nullable=True)  # e.g., 'Camera 1'
    
    # ── Ducking Config ───────────────────────────────────────
    threshold = Column(Integer, nullable=True)
    release_threshold = Column(Integer, nullable=True) # Secondary threshold for hysteresis
    silence_timeout_ms = Column(Integer, nullable=True)
    time_threshold = Column(String, nullable=True) # e.g., '00:01:00'
    is_multi_duck = Column(Boolean, nullable=False, default=False)
    duck_members = Column(String, nullable=True)  # JSON array of per-mic duck configs
    is_multi_action = Column(Boolean, nullable=False, default=False)
    actions = Column(String, nullable=True)  # JSON array of ActionConfig
    
    # ── Target (Execute) ──────────────────────────────────
    action_target = Column(String, nullable=False, default='yamaha')
    yamaha_command = Column(String, nullable=False)  # e.g., 'InCh/Fader/Level'
    yamaha_channel = Column(Integer, nullable=False) # e.g., 1 (for InCh 1)
    yamaha_mix = Column(Integer, nullable=False, default=0) # e.g., 1 (for Aux 1)
    vmix_function = Column(String, nullable=True) # e.g., 'SetVolume'
    vmix_target_input = Column(Integer, nullable=True) # Target input for SetVolume
    parameter_value = Column(String, nullable=False) # e.g., '-1000' or '1'
    
    # ── Engine Configuration ─────────────────────────────────────
    delay_ms = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    # ── Runtime stats (updated when rule fires) ───────────────────
    fire_count = Column(Integer, nullable=False, default=0)
    last_fired_at = Column(DateTime, nullable=True)
    
    # ── Audit ────────────────────────────────────────────────────
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class DuckGroup(Base):
    """Auto-duck group: multiple mic channels, per-target restore, shared silence."""
    __tablename__ = "duck_groups"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False, default="Duck Group")
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    silence_timeout_ms = Column(Integer, nullable=False, default=3000)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    members = relationship(
        "DuckGroupMember",
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="DuckGroupMember.sort_order",
    )


class DuckGroupMember(Base):
    """One monitored Yamaha input channel within a duck group."""
    __tablename__ = "duck_group_members"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("duck_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    monitor_channel = Column(Integer, nullable=False)
    threshold = Column(Integer, nullable=False, default=-4000)
    release_threshold = Column(Integer, nullable=False, default=-5000)
    attack_ms = Column(Integer, nullable=False, default=700)
    release_ms = Column(Integer, nullable=False, default=700)
    sort_order = Column(Integer, nullable=False, default=0)

    group = relationship("DuckGroup", back_populates="members")
    actions = relationship(
        "DuckGroupAction",
        back_populates="member",
        cascade="all, delete-orphan",
        order_by="DuckGroupAction.sort_order",
    )


class DuckGroupAction(Base):
    """Action executed when a member channel detects speech."""
    __tablename__ = "duck_group_actions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    member_id = Column(Integer, ForeignKey("duck_group_members.id", ondelete="CASCADE"), nullable=False, index=True)
    action_target = Column(String, nullable=False, default="yamaha")
    yamaha_command = Column(String, nullable=False, default="InCh/Fader/Smooth")
    yamaha_channel = Column(Integer, nullable=False, default=1)
    yamaha_mix = Column(Integer, nullable=False, default=0)
    vmix_function = Column(String, nullable=True)
    vmix_target_input = Column(Integer, nullable=True)
    parameter_value = Column(String, nullable=False, default="-2500")
    sort_order = Column(Integer, nullable=False, default=0)

    member = relationship("DuckGroupMember", back_populates="actions")


class ActivityLog(Base):
    """
    SQLAlchemy model representing an execution log of a triggered rule.
    """
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=utc_now, nullable=False, index=True)
    rule_id = Column(Integer, nullable=True)
    rule_name = Column(String, nullable=True)
    event_source = Column(String, nullable=False) # 'vmix' or 'yamaha'
    event_details = Column(String, nullable=False) # e.g. "Mic 1 crossed -40dB"
    action_target = Column(String, nullable=False) # 'vmix' or 'yamaha'
    action_details = Column(String, nullable=False) # e.g. "Faded Mix 2 to -20dB"
    level = Column(String, nullable=False, default="info") # "info", "warn", "error"
