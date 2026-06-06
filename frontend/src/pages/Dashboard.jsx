import React, { useState } from 'react';
import { Settings as SettingsIcon, Terminal } from 'lucide-react';
import { PanelA } from '../components/PanelA';
import { PanelB } from '../components/PanelB';
import { SettingsModal } from '../components/SettingsModal';
import { useWebSocket } from '../hooks/useWebSocket';
import { toast } from 'sonner';
import { Wifi, WifiOff } from 'lucide-react';

export function Dashboard() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { vmixConnected, yamahaConnected, logs, meters, triggeredRules } = useWebSocket();
  const prevVmix = React.useRef(vmixConnected);
  const prevYamaha = React.useRef(yamahaConnected);

  React.useEffect(() => {
    if (prevVmix.current !== vmixConnected) {
      if (vmixConnected) toast.success("vMix Connected!");
      else toast.error("vMix Connection Lost! Auto-reconnecting...");
      prevVmix.current = vmixConnected;
    }
    if (prevYamaha.current !== yamahaConnected) {
      if (yamahaConnected) toast.success("Yamaha TF3 Connected!");
      else toast.error("Yamaha TF3 Connection Lost! Auto-reconnecting...");
      prevYamaha.current = yamahaConnected;
    }
  }, [vmixConnected, yamahaConnected]);

  return (
    <div className="min-h-screen bg-surface-900 text-text-primary p-4 md:p-6 flex flex-col h-screen overflow-hidden">

      {/* Header */}
      <header className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-accent-cyan bg-opacity-10 p-2 rounded-lg border border-accent-cyan border-opacity-30">
            <Terminal className="text-accent-cyan" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-accent-cyan to-accent-green bg-clip-text text-transparent tracking-tight">
              vMix ↔ Yamaha TF3 Bridge
            </h1>
            <p className="text-text-muted text-xs uppercase tracking-widest mt-1">Live Automation Engine</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${vmixConnected ? 'bg-accent-cyan/10 border-accent-cyan/20 text-accent-cyan' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              {vmixConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span className="text-xs font-bold uppercase tracking-wider">vMix</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${yamahaConnected ? 'bg-accent-green/10 border-accent-green/20 text-accent-green' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              {yamahaConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span className="text-xs font-bold uppercase tracking-wider">Yamaha TF3</span>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 bg-surface-800 border border-border-subtle hover:border-accent-cyan hover:text-accent-cyan px-4 py-2 rounded-lg transition-colors text-sm font-semibold"
          >
            <SettingsIcon size={16} />
            <span>Config</span>
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">

        {/* Panel A: Configuration (Takes up 2/3 on large screens) */}
        <section className="lg:col-span-2 min-h-0 h-full flex flex-col">
          <PanelA vmixConnected={vmixConnected} meters={meters} triggeredRules={triggeredRules} />
        </section>

        {/* Panel B: Status & Logs (Takes up 1/3 on large screens) */}
        <section className="lg:col-span-1 min-h-0 h-full flex flex-col">
          <PanelB vmixConnected={vmixConnected} yamahaConnected={yamahaConnected} logs={logs} />
        </section>

      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
