from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import delete
from typing import List, Optional

from app.db.models import DuckGroup, DuckGroupMember, DuckGroupAction
from app.schemas.duck_group import DuckGroupCreate, DuckGroupUpdate, DuckGroupMemberCreate


def _member_to_model(member_in, group_id: int) -> DuckGroupMember:
    member = DuckGroupMember(
        group_id=group_id,
        monitor_channel=member_in.monitor_channel,
        threshold=member_in.threshold,
        release_threshold=member_in.release_threshold,
        attack_ms=member_in.attack_ms,
        release_ms=member_in.release_ms,
        sort_order=member_in.sort_order,
    )
    for ai, action_in in enumerate(member_in.actions):
        member.actions.append(
            DuckGroupAction(
                action_target=action_in.action_target,
                yamaha_command=action_in.yamaha_command,
                yamaha_channel=action_in.yamaha_channel,
                yamaha_mix=action_in.yamaha_mix,
                vmix_function=action_in.vmix_function,
                vmix_target_input=action_in.vmix_target_input,
                parameter_value=action_in.parameter_value,
                sort_order=action_in.sort_order if action_in.sort_order else ai,
            )
        )
    if not member.actions:
        member.actions.append(
            DuckGroupAction(
                action_target="yamaha",
                yamaha_command="InCh/Fader/Smooth",
                yamaha_channel=10,
                yamaha_mix=0,
                parameter_value="-2500",
                sort_order=0,
            )
        )
    return member


async def get_duck_group(db: AsyncSession, group_id: int) -> Optional[DuckGroup]:
    result = await db.execute(
        select(DuckGroup)
        .options(
            selectinload(DuckGroup.members).selectinload(DuckGroupMember.actions)
        )
        .where(DuckGroup.id == group_id)
    )
    return result.scalars().first()


async def get_all_duck_groups(db: AsyncSession) -> List[DuckGroup]:
    result = await db.execute(
        select(DuckGroup)
        .options(
            selectinload(DuckGroup.members).selectinload(DuckGroupMember.actions)
        )
        .order_by(DuckGroup.sort_order, DuckGroup.id)
    )
    return list(result.scalars().all())


async def get_active_duck_groups(db: AsyncSession) -> List[DuckGroup]:
    result = await db.execute(
        select(DuckGroup)
        .options(
            selectinload(DuckGroup.members).selectinload(DuckGroupMember.actions)
        )
        .where(DuckGroup.is_active == True)
    )
    return list(result.scalars().all())


async def create_duck_group(db: AsyncSession, group_in: DuckGroupCreate) -> DuckGroup:
    db_group = DuckGroup(
        name=group_in.name,
        sort_order=group_in.sort_order,
        is_active=group_in.is_active,
        silence_timeout_ms=group_in.silence_timeout_ms,
    )
    for mi, member_in in enumerate(group_in.members):
        member = _member_to_model(member_in, group_id=0)
        if member.sort_order == 0 and mi:
            member.sort_order = mi
        db_group.members.append(member)
    db.add(db_group)
    await db.commit()
    await db.refresh(db_group)
    return await get_duck_group(db, db_group.id)


async def update_duck_group(
    db: AsyncSession, group_id: int, group_update: DuckGroupUpdate
) -> Optional[DuckGroup]:
    db_group = await get_duck_group(db, group_id)
    if not db_group:
        return None

    data = group_update.model_dump(exclude_unset=True)
    members_data = data.pop("members", None)

    for key, value in data.items():
        setattr(db_group, key, value)

    if members_data is not None:
        await db.execute(
            delete(DuckGroupMember).where(DuckGroupMember.group_id == group_id)
        )
        await db.flush()
        for mi, member_in in enumerate(members_data):
            if isinstance(member_in, dict):
                member_in = DuckGroupMemberCreate(**member_in)
            member = _member_to_model(member_in, group_id=group_id)
            if member.sort_order == 0 and mi:
                member.sort_order = mi
            db_group.members.append(member)

    await db.commit()
    return await get_duck_group(db, group_id)


async def delete_duck_group(db: AsyncSession, group_id: int) -> bool:
    db_group = await get_duck_group(db, group_id)
    if not db_group:
        return False
    await db.delete(db_group)
    await db.commit()
    return True


async def toggle_duck_group(db: AsyncSession, group_id: int) -> Optional[DuckGroup]:
    db_group = await get_duck_group(db, group_id)
    if not db_group:
        return None
    db_group.is_active = not db_group.is_active
    await db.commit()
    return await get_duck_group(db, group_id)


async def bulk_reorder_duck_groups(db: AsyncSession, updates: list) -> None:
    for item in updates:
        db_group = await get_duck_group(db, item.id)
        if db_group:
            db_group.sort_order = item.sort_order
    await db.commit()


async def duplicate_duck_group(db: AsyncSession, group_id: int) -> Optional[DuckGroup]:
    source = await get_duck_group(db, group_id)
    if not source:
        return None
    all_groups = await get_all_duck_groups(db)
    max_order = max((g.sort_order for g in all_groups), default=0)
    names = [g.name for g in all_groups]
    base = source.name.replace(" (", " (").rstrip()
    import re
    base = re.sub(r" \(\d+\)$", "", source.name.strip())
    n = 1
    while f"{base} ({n})" in names:
        n += 1

    members = []
    for m in source.members:
        actions = [
            {
                "action_target": a.action_target,
                "yamaha_command": a.yamaha_command,
                "yamaha_channel": a.yamaha_channel,
                "yamaha_mix": a.yamaha_mix,
                "vmix_function": a.vmix_function,
                "vmix_target_input": a.vmix_target_input,
                "parameter_value": a.parameter_value,
                "sort_order": a.sort_order,
            }
            for a in m.actions
        ]
        members.append(
            {
                "monitor_channel": m.monitor_channel,
                "threshold": m.threshold,
                "release_threshold": m.release_threshold,
                "attack_ms": m.attack_ms,
                "release_ms": m.release_ms,
                "sort_order": m.sort_order,
                "actions": actions,
            }
        )

    return await create_duck_group(
        db,
        DuckGroupCreate(
            name=f"{base} ({n})",
            sort_order=max_order + 1,
            is_active=source.is_active,
            silence_timeout_ms=source.silence_timeout_ms,
            members=[DuckGroupMemberCreate(**m) for m in members],
        ),
    )
