import { useState, useEffect, useRef, useCallback } from 'react';

const METER_FLUSH_MS = 120;
const LOG_MAX = 100;

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
  const metersPending = useRef({});
  const metersFlushTimer = useRef(null);

  const flushMeters = useCallback(() => {
    metersFlushTimer.current = null;
    const batch = metersPending.current;
    if (!Object.keys(batch).length) return;
    metersPending.current = {};
    setMeters((prev) => ({ ...prev, ...batch }));
  }, []);

  const scheduleMeterFlush = useCallback(() => {
    if (metersFlushTimer.current) return;
    metersFlushTimer.current = setTimeout(flushMeters, METER_FLUSH_MS);
  }, [flushMeters]);

  const connectWs = useCallback(() => {
    if (ws.current) {
      ws.current.onclose = null;
      ws.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/status`;

    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
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
            setLogs((prev) => [msg.data, ...prev].slice(0, LOG_MAX));
            break;

          case 'LOG_HISTORY':
            setLogs(msg.data.reverse().slice(0, LOG_MAX));
            break;

          case 'METER_UPDATE':
            metersPending.current[msg.data.channel] = msg.data.level;
            scheduleMeterFlush();
            break;

          case 'RULE_TRIGGERED':
            setTriggeredRules((prev) => ({ ...prev, [msg.data.rule_id]: Date.now() }));
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error', error);
    };

    socket.onclose = () => {
      if (isMounted.current) {
        const delay = reconnectDelay.current;
        reconnectTimer.current = setTimeout(() => {
          reconnectDelay.current = Math.min(delay * 2, 15000);
          connectWs();
        }, delay);
      }
    };
  }, [scheduleMeterFlush]);

  useEffect(() => {
    isMounted.current = true;
    connectWs();

    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (metersFlushTimer.current) clearTimeout(metersFlushTimer.current);
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
      }
    };
  }, [connectWs]);

  return { vmixConnected, yamahaConnected, logs, meters, triggeredRules };
};
