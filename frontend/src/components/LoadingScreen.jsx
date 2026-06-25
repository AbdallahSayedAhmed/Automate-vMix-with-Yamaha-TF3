import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BridgeLogo } from './BridgeLogo';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  'Initializing bridge engine',
  'Loading automation rules',
  'Connecting signal chain',
  'Calibrating audio meters',
  'Arming live production stack',
  'All systems go',
];

const SESSION_KEY = 'avbridge_loaded_once';

const C = {
  bg: '#050911',
  bgCard: '#0A1020',
  cyan: '#00D2FF',
  cyanDim: 'rgba(0,210,255,0.35)',
  cyanGhost: 'rgba(0,210,255,0.08)',
  amber: '#F6B44B',
  amberDim: 'rgba(246,180,75,0.35)',
  silver: '#C8D0DC',
  silverDim: '#4A5568',
  green: '#22C55E',
};

// ─── Waveform Equalizer ──────────────────────────────────────────────────────

function AudioWaveform() {
  const bars = [
    { h: [18, 42, 24], dur: 0.8 },
    { h: [30, 14, 38], dur: 1.1 },
    { h: [22, 48, 18], dur: 0.7 },
    { h: [36, 20, 44], dur: 0.9 },
    { h: [14, 40, 26], dur: 1.2 },
    { h: [28, 12, 36], dur: 0.6 },
    { h: [40, 24, 32], dur: 1.0 },
  ];

  return (
    <div className="flex items-end gap-[3px]" style={{ height: 50 }}>
      {bars.map((bar, i) => (
        <motion.div
          key={i}
          className="rounded-sm"
          style={{
            width: 4,
            background: i % 2 === 0
              ? `linear-gradient(to top, ${C.cyan}, ${C.cyanDim})`
              : `linear-gradient(to top, ${C.amber}, ${C.amberDim})`,
            boxShadow: i % 2 === 0
              ? `0 0 8px ${C.cyanDim}`
              : `0 0 8px ${C.amberDim}`,
          }}
          animate={{ height: bar.h }}
          transition={{
            duration: bar.dur,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ─── Signal Line ─────────────────────────────────────────────────────────────

function SignalLine({ x1, y1, x2, y2, delay = 0, color = C.cyan }) {
  return (
    <motion.line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={color}
      strokeWidth="1"
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: [0, 0.6, 0.3] }}
      transition={{ duration: 1.8, delay, ease: 'easeInOut' }}
    />
  );
}

function SignalRoutes() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid meet"
      style={{ opacity: 0.4 }}
    >
      {/* Left routing lines */}
      <SignalLine x1={20} y1={80} x2={120} y2={160} delay={0.3} />
      <SignalLine x1={120} y1={160} x2={200} y2={160} delay={1.2} />
      <SignalLine x1={20} y1={320} x2={120} y2={240} delay={0.6} color={C.amber} />
      <SignalLine x1={120} y1={240} x2={200} y2={240} delay={1.5} color={C.amber} />

      {/* Right routing lines */}
      <SignalLine x1={200} y1={160} x2={280} y2={160} delay={2.0} />
      <SignalLine x1={280} y1={160} x2={380} y2={80} delay={2.5} />
      <SignalLine x1={200} y1={240} x2={280} y2={240} delay={2.0} color={C.amber} />
      <SignalLine x1={280} y1={240} x2={380} y2={320} delay={2.5} color={C.amber} />

      {/* Signal pulses traveling along paths */}
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          r="2"
          fill={i % 2 === 0 ? C.cyan : C.amber}
          style={{
            filter: `drop-shadow(0 0 4px ${i % 2 === 0 ? C.cyan : C.amber})`,
          }}
          initial={{ cx: 20, cy: i === 1 ? 320 : 80, opacity: 0 }}
          animate={{
            cx: [20, 120, 200, 280, 380],
            cy: i === 1
              ? [320, 240, 240, 240, 320]
              : [80, 160, 160, 160, 80],
            opacity: [0, 1, 1, 1, 0],
          }}
          transition={{
            duration: 3.5,
            delay: 0.8 + i * 1.2,
            repeat: Infinity,
            repeatDelay: 2,
            ease: 'linear',
          }}
        />
      ))}
    </svg>
  );
}

// ─── Circular Progress ───────────────────────────────────────────────────────

function CircularProgress({ progress, size = 200 }) {
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Track */}
      <svg className="absolute inset-0" width={size} height={size}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="rgba(200,208,220,0.06)"
          strokeWidth={strokeWidth}
        />
      </svg>
      {/* Progress arc */}
      <svg
        className="absolute inset-0"
        width={size} height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{
            filter: `drop-shadow(0 0 6px ${C.cyanDim})`,
          }}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={C.cyan} />
            <stop offset="100%" stopColor={C.amber} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// ─── Typewriter Text ─────────────────────────────────────────────────────────

function TypewriterText({ text }) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [text]);

  return (
    <span style={{ color: C.silver }}>
      {displayed}
      <motion.span
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
        style={{ color: C.cyan }}
      >
        ▌
      </motion.span>
    </span>
  );
}

// ─── Background ──────────────────────────────────────────────────────────────

function BackgroundLayer() {
  return (
    <>
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 100% 80% at 50% 40%, #0D1525 0%, ${C.bg} 60%)`,
        }}
      />

      {/* Brushed-metal highlight */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          background: 'radial-gradient(ellipse 50% 40% at 50% 35%, rgba(200,208,220,0.5) 0%, transparent 70%)',
        }}
      />

      {/* CRT scanlines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,210,255,0.15) 2px, rgba(0,210,255,0.15) 4px)',
        }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,210,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(0,210,255,0.6) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating particles */}
      {[...Array(16)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 1.5 + (i % 3),
            height: 1.5 + (i % 3),
            left: `${5 + (i * 6.2) % 90}%`,
            top: `${8 + (i * 9.3) % 84}%`,
            background: i % 3 === 0 ? C.cyan : i % 3 === 1 ? C.amber : C.silver,
            boxShadow: `0 0 ${4 + (i % 3) * 3}px ${
              i % 3 === 0 ? C.cyanDim : i % 3 === 1 ? C.amberDim : 'rgba(200,208,220,0.2)'
            }`,
          }}
          animate={{
            y: [0, -12 - (i % 5) * 4, 0],
            x: [0, (i % 2 === 0 ? 6 : -6), 0],
            opacity: [0.1, 0.5, 0.1],
          }}
          transition={{
            duration: 3 + (i % 4) * 0.7,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.2,
          }}
        />
      ))}

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.6) 100%)',
        }}
      />
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function LoadingScreen({ onComplete }) {
  const fastPath = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_KEY) === '1';
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const progress = ((step + 1) / STEPS.length) * 100;

  useEffect(() => {
    if (fastPath) {
      const t = setTimeout(() => {
        sessionStorage.setItem(SESSION_KEY, '1');
        onComplete();
      }, 280);
      return () => clearTimeout(t);
    }

    const stepMs = 550;
    const timers = STEPS.map((_, i) => setTimeout(() => setStep(i), 600 + i * stepMs));
    const finish = setTimeout(() => {
      setShowFlash(true);
      setTimeout(() => {
        setDone(true);
        sessionStorage.setItem(SESSION_KEY, '1');
        setTimeout(onComplete, 500);
      }, 200);
    }, 600 + STEPS.length * stepMs + 300);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
    };
  }, [onComplete, fastPath]);

  // Fast-path: minimal flash
  if (fastPath) {
    return (
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none overflow-hidden"
        style={{ background: C.bg }}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
      >
        <BackgroundLayer />
        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0] }}
          transition={{ duration: 0.3 }}
          style={{ filter: `drop-shadow(0 0 24px ${C.cyanDim})` }}
        >
          <BridgeLogo size={52} />
        </motion.div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{ background: C.bg }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          <BackgroundLayer />

          {/* Signal routing animation behind everything */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: 0.5 }}>
            <div style={{ width: 400, height: 400 }}>
              <SignalRoutes />
            </div>
          </div>

          {/* Flash overlay on completion */}
          <AnimatePresence>
            {showFlash && (
              <motion.div
                className="absolute inset-0 z-50"
                style={{ background: C.cyan }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.15, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            )}
          </AnimatePresence>

          {/* Main content */}
          <motion.div
            className="relative z-10 flex flex-col items-center px-8 w-full max-w-md"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Logo inside circular progress */}
            <div className="relative mb-8 flex items-center justify-center">
              <CircularProgress progress={progress} size={180} />

              {/* Pulse rings */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: 180 + i * 30,
                    height: 180 + i * 30,
                    border: `1px solid ${C.cyanGhost}`,
                  }}
                  animate={{ scale: [1, 1.08 + i * 0.04], opacity: [0.3, 0] }}
                  transition={{
                    duration: 2.5 + i * 0.4,
                    repeat: Infinity,
                    delay: i * 0.8,
                    ease: 'easeOut',
                  }}
                />
              ))}

              {/* Logo centered */}
              <motion.div
                className="absolute flex items-center justify-center"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                style={{
                  filter: `drop-shadow(0 6px 24px rgba(0,0,0,0.5)) drop-shadow(0 0 30px ${C.cyanDim})`,
                }}
              >
                <BridgeLogo size={90} />
              </motion.div>

              {/* Percentage inside ring */}
              <motion.div
                className="absolute font-mono text-[11px] font-bold tabular-nums"
                style={{
                  bottom: 28,
                  color: C.cyan,
                  textShadow: `0 0 12px ${C.cyanDim}`,
                }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {Math.round(progress)}%
              </motion.div>
            </div>

            {/* Title */}
            <motion.div
              className="text-center mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <h1
                className="text-3xl font-bold tracking-tight mb-1.5"
                style={{
                  background: `linear-gradient(135deg, #F0F4FA 0%, ${C.silver} 40%, ${C.cyan} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '-0.02em',
                }}
              >
                AV Bridge
              </h1>
              <p
                className="text-[10px] uppercase font-semibold"
                style={{ color: C.silverDim, letterSpacing: '0.4em' }}
              >
                Live Production Automation
              </p>
            </motion.div>

            {/* Audio Waveform */}
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              <AudioWaveform />
            </motion.div>

            {/* Step label with typewriter */}
            <div className="min-h-[24px] mb-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  className="flex items-center gap-2.5"
                  initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: step === STEPS.length - 1 ? C.green : C.cyan,
                      boxShadow: `0 0 8px ${step === STEPS.length - 1 ? C.green : C.cyan}`,
                    }}
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <span className="text-xs font-medium">
                    <TypewriterText text={STEPS[step]} />
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Step counter */}
            <div className="flex items-center gap-3 mb-6">
              {STEPS.map((_, i) => (
                <motion.div
                  key={i}
                  className="rounded-full"
                  style={{
                    width: i <= step ? 16 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: i <= step ? C.cyan : 'rgba(200,208,220,0.12)',
                    boxShadow: i <= step ? `0 0 8px ${C.cyanDim}` : 'none',
                  }}
                  animate={{
                    width: i <= step ? 16 : 6,
                    background: i <= step ? C.cyan : 'rgba(200,208,220,0.12)',
                  }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              ))}
            </div>

            {/* Bottom version */}
            <motion.div
              className="flex items-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              <div
                className="h-px w-12 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(200,208,220,0.2), transparent)',
                }}
              />
              <span
                className="text-[9px] font-mono uppercase tracking-widest"
                style={{ color: 'rgba(200,208,220,0.25)' }}
              >
                v1.2.0
              </span>
              <div
                className="h-px w-12 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(200,208,220,0.2), transparent)',
                }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
