import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebSocket() {
  const [vmixConnected, setVmixConnected] = useState(false);
  const [yamahaConnected, setYamahaConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [meters, setMeters] = useState({});
  const [triggeredRules, setTriggeredRules] = useState({});
  
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectDelay = useRef(1000);
  const isMounted = useRef(true);

  const connectWs = useCallback(() => {
    // Clean up any existing connection
    if (ws.current) {
      ws.current.onclose = null; // prevent triggering reconnect from manual close
      ws.current.close();
    }

    // Determine WS protocol based on current location protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use window.location.host so it works through Vite proxy or direct connection
    const wsUrl = `${protocol}//${window.location.host}/ws/status`;

    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connected');
      // Reset backoff on successful connection
      reconnectDelay.current = 1000;
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'STATUS_UPDATE':
            setVmixConnected(msg.data.vmix_connected);
            setYamahaConnected(msg.data.yamaha_connected);
            break;

          case 'NEW_LOG':
            setLogs(prev => {
              const newLogs = [msg.data, ...prev];
              return newLogs.slice(0, 100);
            });
            break;

          case 'LOG_HISTORY':
            setLogs(msg.data.reverse().slice(0, 100));
            break;
            
          case 'METER_UPDATE':
            setMeters(prev => ({ ...prev, [msg.data.channel]: msg.data.level }));
            break;
            
          case 'RULE_TRIGGERED':
            setTriggeredRules(prev => ({ ...prev, [msg.data.rule_id]: Date.now() }));
            break;

          default:
            console.warn('Unknown WS message type:', msg.type);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error', error);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      // Don't reset status here — keep last known state until we get a fresh STATUS_UPDATE
      // Schedule reconnect with exponential backoff
      if (isMounted.current) {
        const delay = reconnectDelay.current;
        console.log(`Reconnecting in ${delay}ms...`);
        reconnectTimer.current = setTimeout(() => {
          reconnectDelay.current = Math.min(delay * 2, 15000);
          connectWs();
        }, delay);
      }
    };
  }, []);

  useEffect(() => {
    isMounted.current = true;
    connectWs();

    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (ws.current) {
        ws.current.onclose = null; // prevent reconnect on unmount
        ws.current.close();
      }
    };
  }, [connectWs]);

  return { vmixConnected, yamahaConnected, logs, meters, triggeredRules };
}
