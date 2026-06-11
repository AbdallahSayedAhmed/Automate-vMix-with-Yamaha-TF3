import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Wifi, WifiOff, Activity } from 'lucide-react';
import { BridgeLogo } from '../components/BridgeLogo';
import { PanelA } from '../components/PanelA';
import { PanelB } from '../components/PanelB';
import { SettingsModal } from '../components/SettingsModal';
import { useWebSocket } from '../hooks/useWebSocket';
import { toast } from 'sonner';

const LiveClock = React.memo(function LiveClock() {
  const [time, setTime] = React.useState(() => new Date());

  React.useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-sm tabular-nums" style={{ color: '#8B93A8' }}>
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
});

export function Dashboard() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [logPanelOpen, setLogPanelOpen] = useState(true);
  const { vmixConnected, yamahaConnected, logs, meters, triggeredRules, actionStates } = useWebSocket();
  const prevVmix = React.useRef(vmixConnected);
  const prevYamaha = React.useRef(yamahaConnected);

  React.useEffect(() => {
    if (prevVmix.current !== vmixConnected) {
      if (vmixConnected) toast.success('vMix Connected!');
      else toast.error('vMix Connection Lost! Auto-reconnecting…');
      prevVmix.current = vmixConnected;
    }
    if (prevYamaha.current !== yamahaConnected) {
      if (yamahaConnected) toast.success('Yamaha TF3 Connected!');
      else toast.error('Yamaha TF3 Connection Lost! Auto-reconnecting…');
      prevYamaha.current = yamahaConnected;
    }
  }, [vmixConnected, yamahaConnected]);

  const bridgeActive = vmixConnected || yamahaConnected;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: '#070A0F' }}
    >
      {/* ── Top Command Bar ── */}
      <motion.header
        className="shrink-0 glass-panel mx-3 mt-3 rounded-xl px-5 py-3 flex items-center justify-between gap-4"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="shrink-0 rounded-xl overflow-hidden"
            style={{
              boxShadow: '0 0 20px rgba(0,210,255,0.15), 0 2px 8px rgba(0,0,0,0.35)',
            }}
          >
            <BridgeLogo size={36} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight truncate" style={{ color: '#D8DCE6' }}>
              AV Bridge
            </h1>
            <p
              className="text-[10px] uppercase tracking-[0.2em] font-semibold"
              style={{ color: '#5A6278' }}
            >
              Automation Engine
            </p>
          </div>
        </div>

        {/* Connection pills */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <div className={vmixConnected ? 'conn-pill conn-pill--online' : 'conn-pill conn-pill--offline'}>
            {vmixConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>vMix</span>
          </div>
          <div
            className={
              yamahaConnected
                ? 'conn-pill conn-pill--online-yamaha'
                : 'conn-pill conn-pill--offline'
            }
          >
            {yamahaConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>Yamaha TF3</span>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3 shrink-0">
          <LiveClock />

          <button
            type="button"
            onClick={() => setLogPanelOpen((v) => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover-lift ${
              logPanelOpen
                ? 'text-live-cyan'
                : ''
            }`}
            style={{
              background: logPanelOpen ? 'rgba(32,217,255,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${logPanelOpen ? 'rgba(32,217,255,0.25)' : 'rgba(255,255,255,0.06)'}`,
              color: logPanelOpen ? undefined : '#8B93A8',
            }}
          >
            <Activity size={14} />
            Live Monitor
          </button>

          {bridgeActive && (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-live px-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse-dot" />
              Bridge Active
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover-lift"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#8B93A8',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(32,217,255,0.25)';
              e.currentTarget.style.color = '#20D9FF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.color = '#8B93A8';
            }}
          >
            <SettingsIcon size={14} />
            Settings
          </button>
        </div>
      </motion.header>

      {/* ── Split Workspace ── */}
      <main className="flex-1 flex gap-3 min-h-0 px-3 pb-3 pt-3">
        <motion.section
          className="flex-1 min-w-0 min-h-0 flex flex-col"
          layout
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
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

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
