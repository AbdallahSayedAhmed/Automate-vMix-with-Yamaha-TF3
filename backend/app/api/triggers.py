from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.database import get_db
from app.db import crud
from app.schemas.trigger import (
    TriggerRuleCreate, TriggerRuleUpdate, TriggerRuleResponse,
    ReorderItem, BulkGroupRequest, BulkIdRequest, BulkToggleRequest, BulkCreateRequest
)
import uuid

router = APIRouter(prefix="/triggers", tags=["Triggers"])

@router.post("/", response_model=TriggerRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_trigger(trigger: TriggerRuleCreate, db: AsyncSession = Depends(get_db)):
    """Create a new trigger rule."""
    return await crud.create_trigger(db, trigger)

@router.get("/", response_model=List[TriggerRuleResponse])
async def list_triggers(db: AsyncSession = Depends(get_db)):
    """List all trigger rules."""
    return await crud.get_all_triggers(db)

@router.get("/{trigger_id}", response_model=TriggerRuleResponse)
async def get_trigger(trigger_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific trigger rule by ID."""
    trigger = await crud.get_trigger(db, trigger_id)
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger rule not found")
    return trigger

@router.put("/{trigger_id}", response_model=TriggerRuleResponse)
async def update_trigger(trigger_id: int, trigger_update: TriggerRuleUpdate, db: AsyncSession = Depends(get_db)):
    """Update a specific trigger rule."""
    trigger = await crud.update_trigger(db, trigger_id, trigger_update)
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger rule not found")
    return trigger

@router.delete("/{trigger_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trigger(trigger_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a specific trigger rule."""
    success = await crud.delete_trigger(db, trigger_id)
    if not success:
        raise HTTPException(status_code=404, detail="Trigger rule not found")

@router.patch("/{trigger_id}/toggle", response_model=TriggerRuleResponse)
async def toggle_trigger_status(trigger_id: int, db: AsyncSession = Depends(get_db)):
    """Toggle the active status of a trigger rule."""
    trigger = await crud.toggle_trigger_status(db, trigger_id)
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger rule not found")
    return trigger

@router.post("/reorder", status_code=status.HTTP_200_OK)
async def reorder_triggers(items: list[ReorderItem], db: AsyncSession = Depends(get_db)):
    """Reorder multiple trigger rules."""
    await crud.bulk_reorder(db, items)
    return {"message": "Reordered successfully"}

@router.post("/bulk-group", status_code=status.HTTP_200_OK)
async def bulk_group(req: BulkGroupRequest, db: AsyncSession = Depends(get_db)):
    """Assign multiple triggers to a group."""
    group_id = str(uuid.uuid4()) if req.group_name else None
    await crud.bulk_group(db, req.ids, group_id, req.group_name if req.group_name else None, req.group_color if req.group_name else None)
    return {"message": "Grouped successfully"}

@router.post("/bulk-delete", status_code=status.HTTP_200_OK)
async def bulk_delete_triggers(req: BulkIdRequest, db: AsyncSession = Depends(get_db)):
    """Delete multiple triggers."""
    await crud.bulk_delete(db, req.ids)
    return {"message": "Deleted successfully"}

@router.post("/bulk-toggle", status_code=status.HTTP_200_OK)
async def bulk_toggle_triggers(req: BulkToggleRequest, db: AsyncSession = Depends(get_db)):
    """Toggle multiple triggers."""
    await crud.bulk_toggle(db, req.ids, req.is_active)
    return {"message": "Toggled successfully"}

@router.post("/bulk-create", response_model=list[TriggerRuleResponse], status_code=status.HTTP_201_CREATED)
async def bulk_create_triggers(req: BulkCreateRequest, db: AsyncSession = Depends(get_db)):
    """Create multiple triggers at once."""
    return await crud.bulk_create(db, req.rules)
