from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class TriggerRuleBase(BaseModel):
    name: str = Field(..., description="Human-readable name for the trigger rule")
    sort_order: int = Field(0, description="Order of the rule in the list")
    group_id: Optional[str] = Field(None, description="UUID of the group this rule belongs to")
    group_name: Optional[str] = Field(None, description="Name of the group")
    group_color: Optional[str] = Field(None, description="Color of the group")
    
    listen_source: str = Field('vmix', description="'vmix' or 'yamaha'")
    trigger_event: str = Field(..., description="vMix event type or 'YamahaMeter'")
    vmix_input_number: Optional[int] = Field(None, description="vMix input number or Yamaha channel to listen")
    vmix_input_name: Optional[str] = Field(None, description="vMix input name (optional if number is used)")
    
    threshold: Optional[int] = Field(None, description="Audio threshold for ducking")
    release_threshold: Optional[int] = Field(None, description="Secondary threshold for ducking release (hysteresis)")
    silence_timeout_ms: Optional[int] = Field(None, description="Silence timeout for ducking")
    time_threshold: Optional[str] = Field(None, description="Time remaining threshold for vMix video playback (e.g., '00:01:00')")
    
    action_target: str = Field('yamaha', description="'yamaha' or 'vmix'")
    yamaha_command: str = Field(..., description="Yamaha RCP parameter path (e.g., InCh/Fader/Level)")
    yamaha_channel: int = Field(..., description="Yamaha channel number (e.g., 1 to 32)")
    yamaha_mix: int = Field(0, description="Yamaha Aux Mix number (0 if not used, 1 to 20 for Aux 1-20)")
    vmix_function: Optional[str] = Field(None, description="vMix function to call (e.g., SetVolume)")
    vmix_target_input: Optional[int] = Field(None, description="vMix target input for SetVolume")
    parameter_value: str = Field(..., description="Value to send (e.g., '-1000' for -10dB, or '1' for On)")
    
    delay_ms: int = Field(0, ge=0, description="Delay in milliseconds before executing command")
    is_active: bool = Field(True, description="Whether the rule is currently active")

class TriggerRuleCreate(TriggerRuleBase):
    pass

class TriggerRuleUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    group_color: Optional[str] = None
    listen_source: Optional[str] = None
    trigger_event: Optional[str] = None
    vmix_input_number: Optional[int] = None
    vmix_input_name: Optional[str] = None
    threshold: Optional[int] = None
    release_threshold: Optional[int] = None
    silence_timeout_ms: Optional[int] = None
    time_threshold: Optional[str] = None
    action_target: Optional[str] = None
    yamaha_command: Optional[str] = None
    yamaha_channel: Optional[int] = None
    yamaha_mix: Optional[int] = None
    vmix_function: Optional[str] = None
    vmix_target_input: Optional[int] = None
    parameter_value: Optional[str] = None
    delay_ms: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None

class TriggerRuleResponse(TriggerRuleBase):
    id: int
    fire_count: int = 0
    last_fired_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }

class ReorderItem(BaseModel):
    id: int
    sort_order: int

class BulkGroupRequest(BaseModel):
    ids: list[int]
    group_name: str = ""
    group_color: str = "#20D9FF"
    group_id: Optional[str] = None

class BulkIdRequest(BaseModel):
    ids: list[int]

class BulkToggleRequest(BaseModel):
    ids: list[int]
    is_active: bool

class BulkCreateRequest(BaseModel):
    rules: list[TriggerRuleCreate]

class ActivityLogCreate(BaseModel):
    rule_id: Optional[int] = None
    rule_name: Optional[str] = None
    event_source: str
    event_details: str
    action_target: str
    action_details: str
    level: str = "info"

class ActivityLogResponse(ActivityLogCreate):
    id: int
    timestamp: datetime
    
    model_config = {
        "from_attributes": True
    }
