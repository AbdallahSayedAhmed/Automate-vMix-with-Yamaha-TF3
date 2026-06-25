import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Settings as SettingsIcon,
  Wifi,
  WifiOff,
  ChevronDown,
  RefreshCw,
  Maximize2,
  Activity,
} from "lucide-react";
import { BridgeLogo } from "../components/BridgeLogo";
import { PanelA } from "../components/PanelA";
import { PanelB } from "../components/PanelB";
import { SettingsModal } from "../components/SettingsModal";
import { useWebSocket } from "../hooks/useWebSocket";
import { toast } from "sonner";

const LiveClock = React.memo(function LiveClock() {
  const [time, setTime] = React.useState(() => new Date());

  React.useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="live-clock font-mono text-sm tabular-nums">
      {time.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}
    </span>
  );
});

function EventMonitorBar({ event }) {
  const isYamaha = event?.source === "yamaha";
  const accent = isYamaha ? "#39E58C" : "#20D9FF";
  const sourceLabel = event?.source_label || "Waiting";
  const timeLabel = event?.timestamp
    ? new Date(event.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "--:--:--";

  const items = [
    {
      label: "Listen source",
      value: event ? `${sourceLabel} listen` : "No event yet",
    },
    {
      label: "Listening to",
      value: event?.listen_label || "Waiting for vMix/Yamaha",
    },
    { label: "Event", value: event?.event_label || "Waiting for match" },
    {
      label: "Command",
      value: event?.command_summary || "No command fired yet",
    },
  ];

  return (
    <motion.div
      className="glass-panel mt-2 rounded-xl px-3 py-2"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        borderColor: `${accent}33`,
        marginInline: "var(--dashboard-gap)",
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]"
          style={{
            color: accent,
            background: `${accent}14`,
            border: `1px solid ${accent}33`,
          }}
        >
          <Activity size={12} /> Live event
        </div>
        <span className="font-mono text-[10px]" style={{ color: "#5A6278" }}>
          {timeLabel}
        </span>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-1 md:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="min-w-0 rounded-lg px-2 py-1"
              style={{ background: "rgba(0,0,0,0.18)" }}
            >
              <div
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: "#5A6278" }}
              >
                {item.label}
              </div>
              <div
                className="truncate text-[11px] font-semibold"
                style={{ color: item.label === "Command" ? "#D8DCE6" : accent }}
                title={item.value}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function Dashboard() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [logPanelOpen, setLogPanelOpen] = useState(true);
  const [commandExpanded, setCommandExpanded] = useState(true);

  const {
    vmixConnected,
    yamahaConnected,
    logs,
    meters,
    triggeredRules,
    actionStates,
    latestEvent,
  } = useWebSocket();

  const prevVmix = React.useRef(vmixConnected);
  const prevYamaha = React.useRef(yamahaConnected);

  React.useEffect(() => {
    if (prevVmix.current !== vmixConnected) {
      if (vmixConnected) toast.success("vMix Connected!");
      else toast.error("vMix Connection Lost! Auto-reconnecting…");
      prevVmix.current = vmixConnected;
    }
    if (prevYamaha.current !== yamahaConnected) {
      if (yamahaConnected) toast.success("Yamaha TF3 Connected!");
      else toast.error("Yamaha TF3 Connection Lost! Auto-reconnecting…");
      prevYamaha.current = yamahaConnected;
    }
  }, [vmixConnected, yamahaConnected]);

  React.useEffect(() => {
    if (window.electronAPI?.isElectron) {
      document.body.classList.add("electron-app");
    }
  }, []);

  // ── Dispatch the custom event that PanelA listens to ─────────────────────
  const requestVmixInputRefresh = React.useCallback((manual = true) => {
    window.dispatchEvent(
      new CustomEvent("refresh-vmix-inputs", { detail: { manual } }),
    );
  }, []);

  // ── Wire up Electron global shortcut (Ctrl+Shift+R) → refresh ────────────
  // FIXED: electronAPI may be undefined in web/dev mode; guard with optional
  // chaining. The preload was previously written as ESM (import/export) which
  // silently fails in Electron's CommonJS-only preload sandbox — now fixed in
  // electron-preload.cjs. This effect is safe to run regardless.
  React.useEffect(() => {
    if (!window.electronAPI?.onRefreshInputs) return;
    const cleanup = window.electronAPI.onRefreshInputs(() => {
      requestVmixInputRefresh(true);
    });
    return () => cleanup?.();
  }, [requestVmixInputRefresh]);

  const bridgeActive = vmixConnected || yamahaConnected;
  const connectionSummary = `${vmixConnected ? "vMix Online" : "vMix Offline"} • ${yamahaConnected ? "Yamaha Online" : "Yamaha Offline"}`;

  return (
    <div className="dashboard-shell">
      {/* ── Top Command Bar ── */}
      <motion.header
        className={`dashboard-command-bar glass-panel ${commandExpanded ? "" : "dashboard-command-bar--collapsed"}`}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Identity */}
        <div className="dashboard-brand min-w-0" style={{ WebkitAppRegion: "no-drag" }}>
          <div
            className="dashboard-brand__mark shrink-0 rounded-xl overflow-hidden"
            style={{
              boxShadow: "0 0 20px rgba(0,210,255,0.15), 0 2px 8px rgba(0,0,0,0.35)",
            }}
          >
            <BridgeLogo size={36} />
          </div>
          <div className="min-w-0">
            <h1
              className="text-sm font-bold tracking-tight truncate"
              style={{ color: "#D8DCE6" }}
            >
              AV Bridge
            </h1>
            <p
              className="text-[10px] uppercase tracking-[0.2em] font-semibold"
              style={{ color: "#5A6278" }}
            >
              Automation Engine
            </p>
          </div>

          <button
            type="button"
            className="dashboard-context-toggle"
            onClick={() => setCommandExpanded((v) => !v)}
            aria-expanded={commandExpanded}
            aria-label={
              commandExpanded ? "Collapse status panel" : "Expand status panel"
            }
          >
            <span className="dashboard-status-summary">{connectionSummary}</span>
            <ChevronDown
              size={15}
              className={`dashboard-context-toggle__icon ${commandExpanded ? "dashboard-context-toggle__icon--open" : ""}`}
            />
          </button>
        </div>

        {/* Connection pills */}
        <div className="dashboard-connection-pills">
          <div className={vmixConnected ? "conn-pill conn-pill--online" : "conn-pill conn-pill--offline"}>
            {vmixConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>vMix</span>
          </div>
          <div className={yamahaConnected ? "conn-pill conn-pill--online-yamaha" : "conn-pill conn-pill--offline"}>
            {yamahaConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>Yamaha TF3</span>
          </div>
        </div>

        {/* Right controls */}
        <div className="dashboard-controls" style={{ WebkitAppRegion: "no-drag" }}>
          <LiveClock />

          {/* Refresh + Fullscreen — kept together as a pair */}
          <div className="dashboard-vmix-actions">
            <button
              type="button"
              onClick={() => requestVmixInputRefresh(true)}
              className="dashboard-control-btn hover-lift"
              title="Refresh vMix Inputs (Ctrl+Shift+R)"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#8B93A8",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(32,217,255,0.25)";
                e.currentTarget.style.color = "#20D9FF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                e.currentTarget.style.color = "#8B93A8";
              }}
            >
              <RefreshCw size={14} />
            </button>

            {/* FIXED: was calling window.electronAPI?.toggleFullscreen() directly.
                That silently no-ops when the preload fails (ESM bug). Now sends
                via IPC which is the correct pattern, with a web fallback. */}
            <button
              type="button"
              onClick={() => {
                if (window.electronAPI?.toggleFullscreen) {
                  window.electronAPI.toggleFullscreen();
                } else {
                  // Web fallback — works in browser / dev mode
                  if (document.fullscreenElement) {
                    document.exitFullscreen?.();
                  } else {
                    document.documentElement.requestFullscreen?.();
                  }
                }
              }}
              className="dashboard-control-btn hover-lift"
              title="Toggle Fullscreen (F11)"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#8B93A8",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(32,217,255,0.25)";
                e.currentTarget.style.color = "#20D9FF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                e.currentTarget.style.color = "#8B93A8";
              }}
            >
              <Maximize2 size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setLogPanelOpen((v) => !v)}
            aria-pressed={logPanelOpen}
            className={`dashboard-control-btn hover-lift ${logPanelOpen ? "dashboard-control-btn--active text-live-cyan" : ""}`}
            style={{
              background: logPanelOpen ? "rgba(32,217,255,0.08)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${logPanelOpen ? "rgba(32,217,255,0.25)" : "rgba(255,255,255,0.06)"}`,
              color: logPanelOpen ? undefined : "#8B93A8",
            }}
          >
            <Activity size={14} />
            <span>Live Monitor</span>
          </button>

          {bridgeActive && (
            <span className="dashboard-active-indicator text-xs font-semibold text-live">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse-dot" />
              Bridge Active
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="dashboard-control-btn hover-lift"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "#8B93A8",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(32,217,255,0.25)";
              e.currentTarget.style.color = "#20D9FF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = "#8B93A8";
            }}
          >
            <SettingsIcon size={14} />
            <span>Settings</span>
          </button>
        </div>
      </motion.header>

      <EventMonitorBar event={latestEvent} />

      {/* ── Split Workspace ── */}
      <main className="dashboard-workspace">
        <motion.section
          className="dashboard-primary-panel"
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <PanelA
            vmixConnected={vmixConnected}
            meters={meters}
            triggeredRules={triggeredRules}
            actionStates={actionStates}
          />
        </motion.section>

        <PanelB
          vmixConnected={vmixConnected}
          yamahaConnected={yamahaConnected}
          logs={logs}
          isOpen={logPanelOpen}
          onToggle={() => setLogPanelOpen((v) => !v)}
        />
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
