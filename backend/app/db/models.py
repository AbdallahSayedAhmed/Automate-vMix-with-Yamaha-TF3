from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime
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
