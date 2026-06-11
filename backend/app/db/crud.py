from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from typing import List, Optional
from datetime import datetime, timezone

from app.db.models import TriggerRule
from app.schemas.trigger import TriggerRuleCreate, TriggerRuleUpdate
import json


def _serialize_duck_members(data: dict) -> dict:
    members = data.get("duck_members")
    if members is not None:
        if isinstance(members, list):
            data["duck_members"] = json.dumps([m.model_dump() if hasattr(m, "model_dump") else m for m in members])
        elif members == []:
            data["duck_members"] = "[]"
    return data

async def get_trigger(db: AsyncSession, trigger_id: int) -> Optional[TriggerRule]:
    """Get a single trigger rule by ID."""
    result = await db.execute(select(TriggerRule).where(TriggerRule.id == trigger_id))
    return result.scalars().first()

async def get_all_triggers(db: AsyncSession) -> List[TriggerRule]:
    """Get all trigger rules."""
    result = await db.execute(select(TriggerRule).order_by(TriggerRule.sort_order, TriggerRule.id))
    return list(result.scalars().all())

async def get_active_triggers(db: AsyncSession) -> List[TriggerRule]:
    """Get all currently active trigger rules."""
    result = await db.execute(select(TriggerRule).where(TriggerRule.is_active == True))
    return list(result.scalars().all())

async def create_trigger(db: AsyncSession, trigger: TriggerRuleCreate) -> TriggerRule:
    """Create a new trigger rule."""
    data = _serialize_duck_members(trigger.model_dump())
    db_trigger = TriggerRule(**data)
    db.add(db_trigger)
    await db.commit()
    await db.refresh(db_trigger)
    return db_trigger

async def update_trigger(db: AsyncSession, trigger_id: int, trigger_update: TriggerRuleUpdate) -> Optional[TriggerRule]:
    """Update an existing trigger rule."""
    db_trigger = await get_trigger(db, trigger_id)
    if not db_trigger:
        return None
        
    update_data = trigger_update.model_dump(exclude_unset=True)
    update_data = _serialize_duck_members(update_data)
    for key, value in update_data.items():
        setattr(db_trigger, key, value)
        
    await db.commit()
    await db.refresh(db_trigger)
    return db_trigger

async def delete_trigger(db: AsyncSession, trigger_id: int) -> bool:
    """Delete a trigger rule."""
    db_trigger = await get_trigger(db, trigger_id)
    if not db_trigger:
        return False
        
    await db.delete(db_trigger)
    await db.commit()
    return True

async def toggle_trigger_status(db: AsyncSession, trigger_id: int) -> Optional[TriggerRule]:
    """Toggle the is_active status of a trigger rule."""
    db_trigger = await get_trigger(db, trigger_id)
    if not db_trigger:
        return None
        
    db_trigger.is_active = not db_trigger.is_active
    await db.commit()
    await db.refresh(db_trigger)
    return db_trigger

async def bulk_reorder(db: AsyncSession, updates: list):
    """Update sort_order for multiple triggers."""
    for item in updates:
        db_trigger = await get_trigger(db, item.id)
        if db_trigger:
            db_trigger.sort_order = item.sort_order
    await db.commit()

async def bulk_group(db: AsyncSession, ids: list[int], group_id: str | None, group_name: str | None, group_color: str | None):
    """Assign multiple triggers to a group, or ungroup when group_name is empty."""
    result = await db.execute(select(TriggerRule).where(TriggerRule.id.in_(ids)))
    triggers = list(result.scalars().all())
    for t in triggers:
        if not group_name:
            t.group_id = None
            t.group_name = None
            t.group_color = None
        else:
            t.group_id = group_id
            t.group_name = group_name
            t.group_color = group_color
    await db.commit()
    return triggers

async def bulk_delete(db: AsyncSession, ids: list[int]):
    """Delete multiple triggers."""
    await db.execute(delete(TriggerRule).where(TriggerRule.id.in_(ids)))
    await db.commit()

async def bulk_toggle(db: AsyncSession, ids: list[int], is_active: bool):
    """Toggle active status for multiple triggers."""
    result = await db.execute(select(TriggerRule).where(TriggerRule.id.in_(ids)))
    triggers = list(result.scalars().all())
    for t in triggers:
        t.is_active = is_active
    await db.commit()
    return triggers

async def get_triggers_by_ids(db: AsyncSession, ids: list[int]) -> List[TriggerRule]:
    if not ids:
        return []
    result = await db.execute(select(TriggerRule).where(TriggerRule.id.in_(ids)))
    return list(result.scalars().all())

async def record_rule_fire(db: AsyncSession, rule_id: int) -> None:
    """Increment fire counter when a rule executes."""
    trigger = await get_trigger(db, rule_id)
    if not trigger:
        return
    trigger.fire_count = (trigger.fire_count or 0) + 1
    trigger.last_fired_at = datetime.now(timezone.utc)
    await db.commit()

def _next_copy_name(existing_names: list[str], base_name: str) -> str:
    import re
    base = re.sub(r' \(\d+\)$', '', base_name.strip())
    n = 1
    while f"{base} ({n})" in existing_names:
        n += 1
    return f"{base} ({n})"


async def duplicate_trigger(db: AsyncSession, trigger_id: int) -> Optional[TriggerRule]:
    """Clone a rule with an incremented (n) name, placed at the end of the list."""
    source = await get_trigger(db, trigger_id)
    if not source:
        return None
    all_rules = await get_all_triggers(db)
    max_order = max((r.sort_order for r in all_rules), default=0)
    names = [r.name for r in all_rules]
    data = {
        c.name: getattr(source, c.name)
        for c in TriggerRule.__table__.columns
        if c.name not in ('id', 'created_at', 'updated_at', 'fire_count', 'last_fired_at', 'name', 'sort_order')
    }
    data['name'] = _next_copy_name(names, source.name)
    data['sort_order'] = max_order + 1
    data['fire_count'] = 0
    data['last_fired_at'] = None
    db_trigger = TriggerRule(**data)
    db.add(db_trigger)
    await db.commit()
    await db.refresh(db_trigger)
    return db_trigger

async def bulk_create(db: AsyncSession, rules: list) -> List[TriggerRule]:
    """Create multiple triggers at once."""
    db_triggers = [TriggerRule(**_serialize_duck_members(rule.model_dump())) for rule in rules]
    db.add_all(db_triggers)
    await db.commit()
    for t in db_triggers:
        await db.refresh(t)
    return db_triggers

from app.db.models import ActivityLog
from app.schemas.trigger import ActivityLogCreate

async def create_activity_log(db: AsyncSession, log_in: ActivityLogCreate) -> ActivityLog:
    db_log = ActivityLog(**log_in.model_dump())
    db.add(db_log)
    await db.commit()
    await db.refresh(db_log)
    return db_log

async def get_recent_logs(db: AsyncSession, limit: int = 50) -> List[ActivityLog]:
    result = await db.execute(select(ActivityLog).order_by(ActivityLog.timestamp.desc()).limit(limit))
    return list(result.scalars().all())
