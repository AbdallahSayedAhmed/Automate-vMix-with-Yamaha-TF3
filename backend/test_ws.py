import asyncio
import httpx
import websockets
import json

async def test_api_and_ws():
    print("Testing REST API...")
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
        # Settings
        r = await client.get("/api/settings/")
        print("Settings GET:", r.status_code, r.json())
        
        # vMix status
        r = await client.get("/api/vmix/status")
        print("vMix Status GET:", r.status_code, r.json())

    print("\nTesting WebSocket Connection...")
    try:
        async with websockets.connect("ws://127.0.0.1:8000/ws/status") as ws:
            print("WebSocket connected successfully!")
            
            # Wait for the initial 2 messages (STATUS_UPDATE and LOG_HISTORY)
            for _ in range(2):
                msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                data = json.loads(msg)
                print(f"Received WS Message Type: {data.get('type')}")
                if data.get('type') == 'STATUS_UPDATE':
                    print(f"  vMix Connected: {data['data']['vmix_connected']}")
                    print(f"  Yamaha Connected: {data['data']['yamaha_connected']}")
                    
    except Exception as e:
        print(f"WebSocket test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_api_and_ws())
