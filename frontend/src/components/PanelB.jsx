import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Terminal,
} from "lucide-react";

const FILTERS = ["ALL", "YAMAHA", "VMIX", "WARN", "ERR", "INFO", "SYS"];

function getLogBadgeClass(log) {
  const level = (log.level || "").toUpperCase();
  const msg = (log.message || "").toLowerCase();

  if (level === "ERROR" || level === "ERR") return "log-badge--error";
  if (level === "WARNING" || level === "WARN") return "log-badge--warn";
  if (level === "SUCCESS") return "log-badge--success";
  if (msg.includes("yamaha") || msg.includes("osc")) return "log-badge--midi";
  if (msg.includes("vmix")) return "log-badge--info";
  if (level === "INFO" && (msg.includes("sys") || msg.includes("bridge")))
    return "log-badge--sys";
  if (level === "INFO") return "log-badge--info";
  return "log-badge--sys";
}

function getLogBadgeLabel(log) {
  const level = (log.level || "").toUpperCase();
  const msg = (log.message || "").toLowerCase();
  if (level === "WARNING") return "WARN";
  if (level === "ERROR") return "ERR";
  if (level === "SUCCESS") return "OK";
  if (msg.includes("yamaha") || msg.includes("osc")) return "YAMAHA";
  if (msg.includes("vmix")) return "VMIX";
  if (level) return level.slice(0, 4);
  return "SYS";
}

function getLogTextColor(log) {
  const level = (log.level || "").toUpperCase();
  const msg = log.message || "";

  if (level === "SUCCESS") return "#39E58C";
  if (level === "WARNING" || level === "WARN") return "#F6B44B";
  if (level === "ERROR" || level === "ERR") return "#FF5C7A";
  if (msg.includes("Connection Established")) return "#39E58C";
  if (msg.includes("Connection Lost")) return "#FF5C7A";
  if (msg.includes("Matched rule")) return "#20D9FF";
  return "#8B93A8";
}

function formatTime(log) {
  if (log.timestamp) {
    try {
      return new Date(log.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      /* fall through */
    }
  }
  return new Date().toLocaleTimeString([], { hour12: false });
}

function matchesFilter(log, filter) {
  if (filter === "ALL") return true;
  const level = (log.level || "").toUpperCase();
  const msg = (log.message || "").toLowerCase();

  switch (filter) {
    case "YAMAHA":
      return (
        msg.includes("yamaha") ||
        msg.includes("osc") ||
        msg.includes("tf3") ||
        msg.includes("mixer")
      );
    case "VMIX":
      return msg.includes("vmix");
    case "WARN":
      return level === "WARNING" || level === "WARN";
    case "ERR":
      return level === "ERROR" || level === "ERR";
    case "INFO":
      return level === "INFO" || level === "SUCCESS";
    case "SYS":
      return (
        !msg.includes("yamaha") &&
        !msg.includes("osc") &&
        !msg.includes("vmix") &&
        level !== "WARNING" &&
        level !== "ERROR"
      );
    default:
      return true;
  }
}

export function PanelB({
  vmixConnected,
  yamahaConnected,
  logs,
  isOpen,
  onToggle,
}) {
  const logEndRef = useRef(null);
  const scrollRef = useRef(null);
  const [filter, setFilter] = useState("ALL");
  const [terminalExpanded, setTerminalExpanded] = useState(true);
  const [userScrolled, setUserScrolled] = useState(false);
  const prevLogCount = useRef(logs.length);

  const filteredLogs = useMemo(
    () => logs.filter((l) => matchesFilter(l, filter)),
    [logs, filter],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      setUserScrolled(!atBottom);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [terminalExpanded, isOpen]);

  useEffect(() => {
    if (!userScrolled && logs.length > prevLogCount.current) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLogCount.current = logs.length;
  }, [logs, userScrolled]);

  const bridgeOnline = vmixConnected && yamahaConnected;

  return (
    <AnimatePresence mode="wait">
      {isOpen ? (
        <motion.aside
          key="log-panel"
          className="log-panel relative shrink-0 flex flex-col min-h-0"
          style={{ width: "min(380px, 100%)" }}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "min(380px, 100%)", opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {/* Left-center rail handle */}
          <button
            type="button"
            className="rail-handle"
            onClick={onToggle}
            aria-label="Collapse log panel"
          >
            <ChevronRight size={16} />
          </button>

          <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden">
            {/* System Telemetry */}
            <div
              className="px-4 py-3 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-[10px] font-bold tracking-[0.15em] uppercase"
                  style={{ color: "#5A6278" }}
                >
                  System Telemetry
                </span>
                <span
                  className="flex items-center gap-1.5 text-[10px]"
                  style={{ color: "#8B93A8" }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
                    style={{ background: "#20D9FF" }}
                  />
                  Telemetry Running
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "vMix Server", online: vmixConnected },
                  { label: "Yamaha TF3", online: yamahaConnected },
                ].map(({ label, online }) => (
                  <div
                    key={label}
                    className="rounded-lg px-3 py-2.5 flex items-center gap-2"
                    style={{
                      background: "rgba(0,0,0,0.25)",
                      border: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${online ? "status-connected" : "status-disconnected"}`}
                      style={{ background: online ? "#39E58C" : "#FF5C7A" }}
                    />
                    <div className="min-w-0">
                      <div
                        className="text-[9px] uppercase tracking-wider font-semibold truncate"
                        style={{ color: "#5A6278" }}
                      >
                        {label}
                      </div>
                      <div
                        className={`text-xs font-bold font-mono ${online ? "text-live" : ""}`}
                        style={{ color: online ? undefined : "#FF5C7A" }}
                      >
                        {online ? "ONLINE" : "OFFLINE"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Terminal header — collapsible toggle */}
            <button
              type="button"
              className="w-full px-4 py-2.5 flex items-center justify-between shrink-0 transition-colors"
              style={{
                borderBottom: terminalExpanded
                  ? "1px solid rgba(255,255,255,0.06)"
                  : "none",
                background: "rgba(0,0,0,0.15)",
              }}
              onClick={() => setTerminalExpanded((v) => !v)}
            >
              <div className="flex items-center gap-2">
                <Terminal size={14} style={{ color: "#20D9FF" }} />
                <span
                  className="text-xs font-bold font-mono tracking-wide"
                  style={{ color: "#20D9FF" }}
                >
                  &gt;_ LIVE BRIDGE LOGGER
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center gap-1.5 text-[10px]"
                  style={{ color: "#8B93A8" }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: bridgeOnline ? "#39E58C" : "#F6B44B" }}
                  />
                  {bridgeOnline ? "Telemetry Online" : "Partial Link"}
                </span>
                {terminalExpanded ? (
                  <ChevronUp size={14} style={{ color: "#5A6278" }} />
                ) : (
                  <ChevronDown size={14} style={{ color: "#5A6278" }} />
                )}
              </div>
            </button>

            <AnimatePresence initial={false}>
              {terminalExpanded && (
                <motion.div
                  className="flex flex-col flex-1 min-h-0"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  {/* Filter tabs */}
                  <div
                    className="px-3 py-2 flex items-center justify-between gap-2 shrink-0 flex-wrap"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <div className="flex gap-0.5 flex-wrap">
                      {FILTERS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          className={`log-filter-tab ${filter === f ? "log-filter-tab--active" : ""}`}
                          onClick={() => setFilter(f)}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <span
                      className="text-[10px] font-mono"
                      style={{ color: "#5A6278" }}
                    >
                      {filteredLogs.length}
                    </span>
                  </div>

                  {/* Log feed */}
                  <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs"
                    style={{ background: "#050508" }}
                  >
                    {filteredLogs.length === 0 ? (
                      <div className="italic mt-4" style={{ color: "#5A6278" }}>
                        Waiting for events…
                      </div>
                    ) : (
                      [...filteredLogs].reverse().map((log, index) => {
                        const message =
                          typeof log === "string"
                            ? log
                            : log.message || JSON.stringify(log);
                        const badgeClass = getLogBadgeClass(log);
                        const badgeLabel = getLogBadgeLabel(log);
                        const textColor = getLogTextColor(log);

                        return (
                          <motion.div
                            key={`${log.timestamp || index}-${index}`}
                            className="py-1 leading-relaxed wrap-break-word"
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <span
                              className="select-none mr-2"
                              style={{ color: "#5A6278" }}
                            >
                              [{formatTime(log)}]
                            </span>
                            <span className={`log-badge ${badgeClass}`}>
                              {badgeLabel}
                            </span>
                            <span style={{ color: textColor }}>{message}</span>
                          </motion.div>
                        );
                      })
                    )}
                    <div ref={logEndRef} />
                  </div>

                  {/* Footer status */}
                  <div
                    className="px-4 py-2 flex items-center justify-between shrink-0 text-[10px]"
                    style={{
                      borderTop: "1px solid rgba(255,255,255,0.04)",
                      background: "rgba(0,0,0,0.2)",
                    }}
                  >
                    <span
                      className={`flex items-center gap-1.5 font-semibold ${bridgeOnline ? "text-live" : ""}`}
                      style={{ color: bridgeOnline ? undefined : "#8B93A8" }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
                        style={{
                          background: bridgeOnline ? "#39E58C" : "#F6B44B",
                        }}
                      />
                      {bridgeOnline ? "Bridge Active" : "Bridge Standby"}
                    </span>
                    <span style={{ color: "#5A6278" }}>
                      {logs.length} events
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.aside>
      ) : (
        <motion.button
          key="log-collapsed"
          type="button"
          className="log-panel-collapsed shrink-0 flex items-center justify-center rounded-l-xl"
          style={{
            width: 36,
            background:
              "linear-gradient(145deg, rgba(21,27,39,0.95), rgba(16,21,31,0.9))",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRight: "none",
            color: "#5A6278",
          }}
          onClick={onToggle}
          aria-label="Expand log panel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ color: "#20D9FF", borderColor: "rgba(32,217,255,0.2)" }}
        >
          <ChevronLeft size={16} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
