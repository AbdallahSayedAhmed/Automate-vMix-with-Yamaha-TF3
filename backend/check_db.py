import asyncio
from app.db.database import AsyncSessionLocal
from app.db.models import TriggerRule
from sqlalchemy.future import select

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(TriggerRule))
        rules = result.scalars().all()
        for r in rules:
            print(f"Rule {r.id}: active={r.is_active}, source={r.listen_source}, event={r.trigger_event}, channel={r.vmix_input_number}")

if __name__ == "__main__":
    asyncio.run(main())
