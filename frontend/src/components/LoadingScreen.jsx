import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BridgeLogo } from './BridgeLogo';

const STEPS = [
  'Initializing bridge engine',
  'Loading automation rules',
  'Establishing device links',
  'Arming live production stack',
  'Ready for show',
];

const SESSION_KEY = 'avbridge_loaded_once';

const COLORS = {
  navy: '#0A1628',
  navyDeep: '#060D18',
  navyMid: '#0F1D32',
  cyan: '#00D2FF',
  cyanSoft: 'rgba(0,210,255,0.35)',
  silver: '#C8D0DC',
  silverDim: '#6B7A90',
};

function BackgroundLayer() {
  return (
    <>
      {/* Base gradient — matches logo midnight navy */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 90% 70% at 50% 42%, ${COLORS.navyMid} 0%, ${COLORS.navy} 45%, ${COLORS.navyDeep} 100%)
          `,
        }}
      />

      {/* Brushed-metal radial highlight (logo plate feel) */}
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          background: 'radial-gradient(ellipse 55% 45% at 50% 38%, rgba(200,208,220,0.5) 0%, transparent 70%)',
        }}
      />

      {/* Electric blue glow — matches glowing V */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 'min(72vw, 640px)',
          height: 'min(72vw, 640px)',
          left: '50%',
          top: '38%',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, ${COLORS.cyanSoft} 0%, rgba(0,123,255,0.08) 40%, transparent 68%)`,
          filter: 'blur(2px)',
        }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Secondary cool rim */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 'min(95vw, 900px)',
          height: 'min(95vw, 900px)',
          left: '50%',
          top: '38%',
          transform: 'translate(-50%, -50%)',
          border: '1px solid rgba(0,210,255,0.06)',
          boxShadow: 'inset 0 0 80px rgba(0,210,255,0.04)',
        }}
        animate={{ scale: [1, 1.03, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 75% at 50% 50%, transparent 35%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* Subtle scan grid */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,210,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(0,210,255,0.8) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Floating bokeh particles */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 2 + (i % 3),
            height: 2 + (i % 3),
            left: `${8 + (i * 7.5) % 84}%`,
            top: `${12 + (i * 11) % 76}%`,
            background: i % 2 === 0 ? COLORS.cyan : COLORS.silver,
            boxShadow: `0 0 ${6 + (i % 4) * 2}px ${i % 2 === 0 ? COLORS.cyanSoft : 'rgba(200,208,220,0.25)'}`,
          }}
          animate={{
            y: [0, -18 - (i % 5) * 4, 0],
            opacity: [0.15, 0.55, 0.15],
          }}
          transition={{
            duration: 3.5 + (i % 4) * 0.8,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.25,
          }}
        />
      ))}

      {/* Horizontal light streak */}
      <motion.div
        className="absolute left-0 right-0 h-px"
        style={{
          top: '38%',
          background: 'linear-gradient(90deg, transparent, rgba(0,210,255,0.25), rgba(200,208,220,0.15), rgba(0,210,255,0.25), transparent)',
        }}
        animate={{ opacity: [0.2, 0.6, 0.2] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  );
}

export function LoadingScreen({ onComplete }) {
  const fastPath = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_KEY) === '1';
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const progress = ((step + 1) / STEPS.length) * 100;

  useEffect(() => {
    if (fastPath) {
      const t = setTimeout(() => {
        sessionStorage.setItem(SESSION_KEY, '1');
        onComplete();
      }, 320);
      return () => clearTimeout(t);
    }

    const stepMs = 480;
    const timers = STEPS.map((_, i) => setTimeout(() => setStep(i), 500 + i * stepMs));
    const finish = setTimeout(() => {
      setDone(true);
      sessionStorage.setItem(SESSION_KEY, '1');
      setTimeout(onComplete, 650);
    }, 500 + STEPS.length * stepMs + 400);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
    };
  }, [onComplete, fastPath]);

  if (fastPath) {
    return (
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none overflow-hidden"
        style={{ background: COLORS.navyDeep }}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <BackgroundLayer />
        <motion.div
          animate={{ scale: [1, 1.04, 1], opacity: [0.7, 1, 0] }}
          transition={{ duration: 0.32 }}
          style={{ filter: 'drop-shadow(0 0 28px rgba(0,210,255,0.45))' }}
        >
          <BridgeLogo size={56} />
        </motion.div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{ background: COLORS.navyDeep }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
        >
          <BackgroundLayer />

          <motion.div
            className="relative z-10 flex flex-col items-center px-8 w-full max-w-lg"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Logo halo + mark */}
            <div className="relative mb-10" style={{ width: 200, height: 200 }}>
              <motion.div
                className="absolute inset-0 rounded-[2.2rem]"
                style={{
                  background: 'radial-gradient(circle, rgba(0,210,255,0.22) 0%, transparent 70%)',
                  filter: 'blur(20px)',
                }}
                animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.9, 0.5] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-[2.2rem]"
                  style={{ border: '1px solid rgba(0,210,255,0.12)' }}
                  animate={{ scale: [1, 1.18 + i * 0.06], opacity: [0.35, 0] }}
                  transition={{ duration: 2.8 + i * 0.5, repeat: Infinity, delay: i * 0.9, ease: 'easeOut' }}
                />
              ))}
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={{ scale: 0.88, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                style={{
                  filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.5)) drop-shadow(0 0 40px rgba(0,210,255,0.25))',
                }}
              >
                <BridgeLogo size={180} />
              </motion.div>
            </div>

            {/* Title */}
            <motion.div
              className="text-center mb-10"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.7 }}
            >
              <h1
                className="text-4xl font-bold tracking-tight mb-2"
                style={{
                  background: `linear-gradient(135deg, #E8ECF2 0%, ${COLORS.silver} 45%, ${COLORS.cyan} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '-0.02em',
                }}
              >
                AV Bridge
              </h1>
              <p
                className="text-[11px] uppercase font-semibold"
                style={{ color: COLORS.silverDim, letterSpacing: '0.35em' }}
              >
                Live Production Automation
              </p>
            </motion.div>

            {/* Progress */}
            <div className="w-full max-w-xs mb-5">
              <div
                className="h-[2px] rounded-full overflow-hidden relative"
                style={{
                  background: 'rgba(200,208,220,0.12)',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
                }}
              >
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, rgba(200,208,220,0.4), ${COLORS.cyan}, #007BFF)`,
                    boxShadow: `0 0 16px ${COLORS.cyanSoft}, 0 0 4px ${COLORS.cyan}`,
                  }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <div className="flex justify-between mt-2 px-0.5">
                <span className="text-[10px] font-mono tabular-nums" style={{ color: COLORS.silverDim }}>
                  {Math.round(progress)}%
                </span>
                <span className="text-[10px] font-mono tabular-nums" style={{ color: 'rgba(0,210,255,0.5)' }}>
                  {step + 1}/{STEPS.length}
                </span>
              </div>
            </div>

            {/* Step label */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                className="flex items-center gap-3 min-h-[28px]"
                initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                transition={{ duration: 0.35 }}
              >
                <motion.span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: COLORS.cyan, boxShadow: `0 0 8px ${COLORS.cyan}` }}
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
                <span className="text-sm font-medium" style={{ color: COLORS.silver }}>
                  {STEPS[step]}
                </span>
              </motion.div>
            </AnimatePresence>

            {/* Bottom chrome line */}
            <motion.div
              className="mt-12 h-px w-24 rounded-full"
              style={{
                background: `linear-gradient(90deg, transparent, rgba(200,208,220,0.35), transparent)`,
              }}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
