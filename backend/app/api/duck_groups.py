from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.engine.trigger_engine import engine as trigger_engine
from app.db.database import get_db
from app.db import duck_crud
from app.schemas.duck_group import (
    DuckGroupCreate,
    DuckGroupUpdate,
    DuckGroupResponse,
    DuckGroupReorderItem,
)

router = APIRouter(prefix="/duck-groups", tags=["Duck Groups"])


@router.get("/", response_model=List[DuckGroupResponse])
async def list_duck_groups(db: AsyncSession = Depends(get_db)):
    return await duck_crud.get_all_duck_groups(db)


@router.post("/", response_model=DuckGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_duck_group(group: DuckGroupCreate, db: AsyncSession = Depends(get_db)):
    result = await duck_crud.create_duck_group(db, group)
    trigger_engine.invalidate_cache()
    return result


@router.get("/{group_id}", response_model=DuckGroupResponse)
async def get_duck_group(group_id: int, db: AsyncSession = Depends(get_db)):
    group = await duck_crud.get_duck_group(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Duck group not found")
    return group


@router.put("/{group_id}", response_model=DuckGroupResponse)
async def update_duck_group(
    group_id: int, group_update: DuckGroupUpdate, db: AsyncSession = Depends(get_db)
):
    group = await duck_crud.update_duck_group(db, group_id, group_update)
    if not group:
        raise HTTPException(status_code=404, detail="Duck group not found")
    trigger_engine.invalidate_cache()
    return group


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_duck_group(group_id: int, db: AsyncSession = Depends(get_db)):
    success = await duck_crud.delete_duck_group(db, group_id)
    if not success:
        raise HTTPException(status_code=404, detail="Duck group not found")
    trigger_engine.invalidate_cache()


@router.patch("/{group_id}/toggle", response_model=DuckGroupResponse)
async def toggle_duck_group(group_id: int, db: AsyncSession = Depends(get_db)):
    group = await duck_crud.toggle_duck_group(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Duck group not found")
    trigger_engine.invalidate_cache()
    return group


@router.post("/reorder", status_code=status.HTTP_200_OK)
async def reorder_duck_groups(items: List[DuckGroupReorderItem], db: AsyncSession = Depends(get_db)):
    await duck_crud.bulk_reorder_duck_groups(db, items)
    trigger_engine.invalidate_cache()
    return {"message": "Reordered successfully"}


@router.post("/{group_id}/duplicate", response_model=DuckGroupResponse)
async def duplicate_duck_group(group_id: int, db: AsyncSession = Depends(get_db)):
    group = await duck_crud.duplicate_duck_group(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Duck group not found")
    trigger_engine.invalidate_cache()
    return group
