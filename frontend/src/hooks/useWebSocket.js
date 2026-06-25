import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

const METER_FLUSH_MS = 120;
const LOG_MAX = 100;

function actionStateKeys(data) {
  const keys = [];
  const hasMember =
    data.member_index != null ||
    data.monitor_channel != null ||
    data.member_id != null;

  if (hasMember) {
    if (data.member_index != null) {
      if (data.action_index != null) {
        keys.push(`${data.rule_id}:member_index:${data.member_index}:action:${data.action_index}`);
      }
      keys.push(`${data.rule_id}:member_index:${data.member_index}`);
    }
    if (data.monitor_channel != null) {
      if (data.action_index != null) {
        keys.push(`${data.rule_id}:monitor_channel:${data.monitor_channel}:action:${data.action_index}`);
      }
      keys.push(`${data.rule_id}:monitor_channel:${data.monitor_channel}`);
    }
    if (data.member_id != null) {
      if (data.action_index != null) {
        keys.push(`${data.rule_id}:member_id:${data.member_id}:action:${data.action_index}`);
      }
      keys.push(`${data.rule_id}:member_id:${data.member_id}`);
    }

    const memberPart =
      data.member_index ?? data.monitor_channel ?? data.member_id;
    if (data.action_index != null) {
      keys.push(
        `${data.rule_id}:member:${memberPart}:action:${data.action_index}`,
      );
    }
    keys.push(`${data.rule_id}:member:${memberPart}`);

    if (data.monitor_channel != null && data.monitor_channel !== memberPart) {
      if (data.action_index != null) {
        keys.push(
          `${data.rule_id}:member:${data.monitor_channel}:action:${data.action_index}`,
        );
      }
      keys.push(`${data.rule_id}:member:${data.monitor_channel}`);
    }

    keys.push(`${data.rule_id}:${data.monitor_channel ?? memberPart}`);
    return keys;
  }

  if (data.action_index != null) {
    keys.push(`${data.rule_id}:action:${data.action_index}`);
  } else {
    keys.push(`${data.rule_id}:rule`);
  }
  return keys;
}

export function useWebSocket() {
  const [vmixConnected, setVmixConnected] = useState(false);
  const [yamahaConnected, setYamahaConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [meters, setMeters] = useState({});
  const [triggeredRules, setTriggeredRules] = useState({});
  const [actionStates, setActionStates] = useState({});
  const [latestEvent, setLatestEvent] = useState(null);

  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectDelay = useRef(1000);
  const isMounted = useRef(true);
  const metersPending = useRef({});
  const metersFlushTimer = useRef(null);
  const connectWsRef = useRef(null);

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

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
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
          case "STATUS_UPDATE":
            setVmixConnected(msg.data.vmix_connected);
            setYamahaConnected(msg.data.yamaha_connected);
            break;

          case "NEW_LOG":
            setLogs((prev) => [msg.data, ...prev].slice(0, LOG_MAX));
            break;

          case "LOG_HISTORY":
            setLogs(msg.data.reverse().slice(0, LOG_MAX));
            break;

          case "METER_UPDATE":
            metersPending.current[msg.data.channel] = msg.data.level;
            scheduleMeterFlush();
            break;

          case "RULE_TRIGGERED":
            setTriggeredRules((prev) => ({
              ...prev,
              [msg.data.rule_id]: Date.now(),
            }));
            break;

          case "ACTION_STATE_UPDATE": {
            const data = { ...msg.data, updated_at: Date.now() };
            const keys = actionStateKeys(data);
            setActionStates((prev) => {
              const next = { ...prev };
              keys.forEach((key) => {
                next[key] = data;
              });
              return next;
            });
            break;
          }

          case "LISTEN_EVENT":
            setLatestEvent({ ...msg.data, updated_at: Date.now() });
            break;

          case "VMIX_INPUTS_UPDATED":
            // Legacy event name — forward silently (no toast; PanelA handles it)
            window.dispatchEvent(
              new CustomEvent("refresh-vmix-inputs", { detail: { manual: false } }),
            );
            break;

          case "VMIX_INPUTS_CHANGED":
            // Fired by XML poller when vMix input list changes.
            // manual:false → PanelA fetches silently without a toast.
            window.dispatchEvent(
              new CustomEvent("refresh-vmix-inputs", {
                detail: { manual: false, ...msg.data },
              }),
            );
            break;

          default:
            break;
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message", err);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error", error);
    };

    socket.onclose = () => {
      if (isMounted.current) {
        const delay = reconnectDelay.current;
        reconnectTimer.current = setTimeout(() => {
          reconnectDelay.current = Math.min(delay * 2, 15000);
          connectWsRef.current?.();
        }, delay);
      }
    };
  }, [scheduleMeterFlush]);

  useEffect(() => {
    connectWsRef.current = connectWs;
  }, [connectWs]);

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

  return {
    vmixConnected,
    yamahaConnected,
    logs,
    meters,
    triggeredRules,
    actionStates,
    latestEvent,
  };
}
