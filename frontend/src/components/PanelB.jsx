import React, { useEffect, useRef } from 'react';

export function PanelB({ vmixConnected, yamahaConnected, logs }) {
  const logEndRef = useRef(null);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  /**
   * Determine color class from the structured log entry level.
   * Falls back to secondary text if the level is unrecognized.
   */
  const getLogColorClass = (log) => {
    const level = (log.level || '').toUpperCase();
    const message = log.message || '';

    if (level === 'SUCCESS') return 'text-accent-green';
    if (level === 'WARNING') return 'text-accent-amber';
    if (level === 'ERROR') return 'text-accent-red';
    // INFO-level messages — highlight connection events
    if (message.includes('Connection Established')) return 'text-accent-green';
    if (message.includes('Connection Lost')) return 'text-accent-red';
    if (message.includes('Matched rule')) return 'text-accent-cyan';
    return 'text-text-secondary';
  };

  /**
   * Format a log's ISO timestamp into a short local time string.
   */
  const formatTime = (log) => {
    if (log.timestamp) {
      try {
        return new Date(log.timestamp).toLocaleTimeString();
      } catch {
        // fall through
      }
    }
    return new Date().toLocaleTimeString();
  };

  return (
    <div className="bg-surface-800 rounded-xl border border-border-subtle flex flex-col h-full shadow-lg overflow-hidden">
      
      {/* Status Header */}
      <div className="p-6 border-b border-border-subtle bg-surface-700 flex justify-around items-center">
        
        {/* vMix Status Indicator */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-text-muted text-xs uppercase tracking-wider font-semibold">vMix Engine</div>
          <div className="flex items-center gap-3 bg-surface-900 px-6 py-3 rounded-lg border border-border-active">
            <div className={`w-4 h-4 rounded-full ${vmixConnected ? 'bg-accent-green status-connected' : 'bg-accent-red status-disconnected'}`} />
            <span className="font-mono font-bold text-lg text-text-primary">
              {vmixConnected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Separator / Connector Line */}
        <div className="h-1 flex-1 mx-8 bg-surface-900 rounded relative overflow-hidden hidden md:block">
          {vmixConnected && yamahaConnected && (
            <div className="absolute inset-0 bg-accent-cyan opacity-30 animate-pulse" />
          )}
        </div>

        {/* Yamaha Status Indicator */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-text-muted text-xs uppercase tracking-wider font-semibold">Yamaha TF3</div>
          <div className="flex items-center gap-3 bg-surface-900 px-6 py-3 rounded-lg border border-border-active">
            <div className={`w-4 h-4 rounded-full ${yamahaConnected ? 'bg-accent-green status-connected' : 'bg-accent-red status-disconnected'}`} />
            <span className="font-mono font-bold text-lg text-text-primary">
              {yamahaConnected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

      </div>

      {/* Terminal Event Log */}
      <div className="flex-1 p-4 bg-[#050508] font-mono text-sm overflow-hidden flex flex-col relative">
        <div className="text-text-muted text-xs uppercase tracking-widest mb-2 flex justify-between items-center">
          <span>Live Execution Log</span>
          <div className="flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse"></span>
             <span>Streaming</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-2">
          {logs.length === 0 ? (
            <div className="text-text-muted opacity-50 italic mt-4">Waiting for events...</div>
          ) : (
            [...logs].reverse().map((log, index) => {
              const colorClass = getLogColorClass(log);
              const timeStr = formatTime(log);
              const message = typeof log === 'string' ? log : (log.message || JSON.stringify(log));

              return (
                <div key={index} className={`break-words ${colorClass}`}>
                  <span className="text-text-muted text-xs mr-3 select-none">
                    [{timeStr}]
                  </span>
                  {log.level && (
                    <span className="text-xs mr-2 opacity-70">[{log.level}]</span>
                  )}
                  {message}
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
        
        {/* CRT Scanline Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-5" 
             style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 4px, 3px 100%' }}>
        </div>
      </div>
    </div>
  );
}
