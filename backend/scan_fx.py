import asyncio

async def scan_fx():
    print("Connecting to TF3...")
    try:
        reader, writer = await asyncio.open_connection("192.168.1.18", 49280)
        print("Connected! Scanning FxRtnCh indexes 0 to 9...")
        
        results = []
        for i in range(10):
            cmd = f"get MIXER:Current/FxRtnCh/Fader/Level {i} 0\n"
            writer.write(cmd.encode('utf-8'))
            await writer.drain()
            
            try:
                line = await asyncio.wait_for(reader.readline(), timeout=1.0)
                resp = line.decode('utf-8').strip()
                results.append(f"Index {i}: {resp}")
                print(f"Index {i}: {resp}")
            except asyncio.TimeoutError:
                results.append(f"Index {i}: TIMEOUT")
                print(f"Index {i}: TIMEOUT")
                
        writer.close()
        await writer.wait_closed()
        
        with open("fx_scan_results.txt", "w") as f:
            f.write("\n".join(results))
        print("Done! Saved to fx_scan_results.txt")
        
    except Exception as e:
        print(f"Failed to connect: {e}")
        print("Make sure the backend server is STOPPED before running this!")

if __name__ == "__main__":
    asyncio.run(scan_fx())
