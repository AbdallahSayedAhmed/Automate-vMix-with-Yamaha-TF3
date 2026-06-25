import asyncio
import logging
import random
import time

logging.basicConfig(level=logging.INFO, format='%(asctime)s - VMIX SIM - %(message)s')

# Simulate inputs
INPUTS = [1, 2, 3, 4]
EVENTS = ["TransitionIn", "OverlayIn", "OnCompletion"]

async def handle_client(reader, writer):
    addr = writer.get_extra_info('peername')
    logging.info(f"Client connected from {addr}")
    
    # Send initial VERSION
    writer.write(b"VERSION OK 24.0.0.51\r\n")
    await writer.drain()
    
    try:
        while True:
            # We also listen to see if client sends SUBSCRIBE
            if not reader.at_eof():
                try:
                    data = await asyncio.wait_for(reader.readline(), timeout=0.1)
                    if data:
                        msg = data.decode().strip()
                        logging.info(f"Received from client: {msg}")
                        if msg.startswith("SUBSCRIBE"):
                            writer.write(f"SUBSCRIBE OK {msg.split()[1]}\r\n".encode())
                            await writer.drain()
                except asyncio.TimeoutError:
                    pass

            # Periodically fire an event
            await asyncio.sleep(random.uniform(5, 15))
            
            event = random.choice(EVENTS)
            inp = random.choice(INPUTS)
            
            msg = f"ACTS OK {event} {inp}\r\n"
            logging.info(f"Broadcasting: {msg.strip()}")
            writer.write(msg.encode())
            await writer.drain()

    except ConnectionResetError:
        logging.info(f"Client {addr} disconnected abruptly")
    except Exception as e:
        logging.error(f"Error handling client {addr}: {e}")
    finally:
        writer.close()
        await writer.wait_closed()
        logging.info(f"Connection to {addr} closed")

async def main():
    server = await asyncio.start_server(handle_client, '127.0.0.1', 8099)
    addr = server.sockets[0].getsockname()
    logging.info(f"Serving dummy vMix TCP on {addr}")

    async with server:
        await server.serve_forever()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Shutting down simulator")
