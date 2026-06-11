from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class DuckGroupActionBase(BaseModel):
    action_target: str = Field("yamaha", description="'yamaha' or 'vmix'")
    yamaha_command: str = Field("InCh/Fader/Smooth")
    yamaha_channel: int = Field(1)
    yamaha_mix: int = Field(0)
    vmix_function: Optional[str] = None
    vmix_target_input: Optional[int] = None
    parameter_value: str = Field("-2500", description="Duck level or command value")
    sort_order: int = 0


class DuckGroupActionCreate(DuckGroupActionBase):
    pass


class DuckGroupActionResponse(DuckGroupActionBase):
    id: int
    member_id: int

    model_config = {"from_attributes": True}


class DuckGroupMemberBase(BaseModel):
    monitor_channel: int = Field(..., ge=1, le=40)
    threshold: int = Field(-4000)
    release_threshold: int = Field(-5000)
    attack_ms: int = Field(700, ge=0)
    release_ms: int = Field(700, ge=0)
    sort_order: int = 0
    actions: List[DuckGroupActionCreate] = Field(default_factory=list)


class DuckGroupMemberCreate(DuckGroupMemberBase):
    pass


class DuckGroupMemberResponse(BaseModel):
    id: int
    group_id: int
    monitor_channel: int
    threshold: int
    release_threshold: int
    attack_ms: int
    release_ms: int
    sort_order: int
    actions: List[DuckGroupActionResponse] = []

    model_config = {"from_attributes": True}


class DuckGroupBase(BaseModel):
    name: str = Field("Duck Group")
    sort_order: int = 0
    is_active: bool = True
    silence_timeout_ms: int = Field(3000, ge=0)


class DuckGroupCreate(DuckGroupBase):
    members: List[DuckGroupMemberCreate] = Field(default_factory=list)


class DuckGroupUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    silence_timeout_ms: Optional[int] = Field(None, ge=0)
    members: Optional[List[DuckGroupMemberCreate]] = None


class DuckGroupResponse(DuckGroupBase):
    id: int
    members: List[DuckGroupMemberResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DuckGroupReorderItem(BaseModel):
    id: int
    sort_order: int
