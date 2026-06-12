import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Settings as SettingsIcon,
  Wifi,
  WifiOff,
  Activity,
  ChevronDown,
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
        <div className="dashboard-brand min-w-0">
          <div
            className="dashboard-brand__mark shrink-0 rounded-xl overflow-hidden"
            style={{
              boxShadow:
                "0 0 20px rgba(0,210,255,0.15), 0 2px 8px rgba(0,0,0,0.35)",
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
            <span className="dashboard-status-summary">
              {connectionSummary}
            </span>
            <ChevronDown
              size={15}
              className={`dashboard-context-toggle__icon ${commandExpanded ? "dashboard-context-toggle__icon--open" : ""}`}
            />
          </button>
        </div>

        {/* Connection pills */}
        <div className="dashboard-connection-pills">
          <div
            className={
              vmixConnected
                ? "conn-pill conn-pill--online"
                : "conn-pill conn-pill--offline"
            }
          >
            {vmixConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>vMix</span>
          </div>
          <div
            className={
              yamahaConnected
                ? "conn-pill conn-pill--online-yamaha"
                : "conn-pill conn-pill--offline"
            }
          >
            {yamahaConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>Yamaha TF3</span>
          </div>
        </div>

        {/* Right controls */}
        <div className="dashboard-controls">
          <LiveClock />

          <button
            type="button"
            onClick={() => setLogPanelOpen((v) => !v)}
            aria-pressed={logPanelOpen}
            className={`dashboard-control-btn hover-lift ${logPanelOpen ? "dashboard-control-btn--active text-live-cyan" : ""}`}
            style={{
              background: logPanelOpen
                ? "rgba(32,217,255,0.08)"
                : "rgba(255,255,255,0.03)",
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

      {/* ── Split Workspace ── */}
      <main className="dashboard-workspace">
        <motion.section
          className="dashboard-primary-panel"
          layout
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
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
