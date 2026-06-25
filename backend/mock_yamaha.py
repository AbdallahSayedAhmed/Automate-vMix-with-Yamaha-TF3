import asyncio
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - YAMAHA MOCK - %(message)s')

async def handle_client(reader, writer):
    addr = writer.get_extra_info('peername')
    logging.info(f"Client connected from {addr}")
    
    try:
        while True:
            data = await reader.read(1024)
            if not data:
                break
            
            msg = data.decode()
            logging.info(f"Received RCP Command: {msg.strip()}")
            
            # Simulated Processing Time
            await asyncio.sleep(0.01)
            
            # Respond with OK
            response = f"OK {msg.strip()}\n"
            writer.write(response.encode())
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
    server = await asyncio.start_server(handle_client, '127.0.0.1', 49280)
    addr = server.sockets[0].getsockname()
    logging.info(f"Serving dummy Yamaha TF3 RCP on {addr}")

    async with server:
        await server.serve_forever()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Shutting down mock")
