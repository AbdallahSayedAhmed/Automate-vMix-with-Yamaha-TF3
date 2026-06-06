import asyncio

async def test_fx():
    try:
        reader, writer = await asyncio.open_connection("192.168.1.18", 49280)
        
        # Test indexes 0 through 7
        for i in range(8):
            print(f"Testing FxRtnCh index {i}...")
            cmd = f"get MIXER:Current/FxRtnCh/Fader/Level {i} 0\n"
            writer.write(cmd.encode('utf-8'))
            await writer.drain()
            
            line = await asyncio.wait_for(reader.readline(), timeout=2.0)
            print(f"Index {i} response: {line.decode('utf-8').strip()}")
        
        writer.close()
        await writer.wait_closed()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_fx())
