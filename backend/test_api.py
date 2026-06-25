import asyncio
import httpx

async def main():
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
        # Check health
        r = await client.get("/api/health")
        print("Health Check:", r.status_code, r.json())
        
        # Create a trigger
        payload = {
            "name": "Camera 1 Auto Mute",
            "trigger_event": "TransitionIn",
            "vmix_input_number": 1,
            "vmix_input_name": "Cam 1",
            "yamaha_command": "InCh/Fader/On",
            "yamaha_channel": 1,
            "parameter_value": "0",
            "delay_ms": 500,
            "is_active": True
        }
        print("Creating Trigger...")
        r = await client.post("/api/triggers/", json=payload)
        print("Create Status:", r.status_code)
        print("Create Response:", r.json())
        
        trigger_id = r.json().get("id")
        
        # List triggers
        print("\nListing Triggers...")
        r = await client.get("/api/triggers/")
        print("List Response:", len(r.json()), "items found.")
        
        # Toggle trigger
        print("\nToggling Trigger Active Status...")
        r = await client.patch(f"/api/triggers/{trigger_id}/toggle")
        print("Toggle Status:", r.status_code)
        print("New Active State:", r.json().get("is_active"))
        
        # Delete trigger
        print("\nDeleting Trigger...")
        r = await client.delete(f"/api/triggers/{trigger_id}")
        print("Delete Status:", r.status_code)
        
if __name__ == "__main__":
    asyncio.run(main())
