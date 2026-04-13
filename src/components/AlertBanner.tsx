import { useState, useEffect } from 'react';

interface Props {
  show: boolean;
  onDismiss: () => void;
}

export function AlertBanner({ show, onDismiss }: Props) {
  useEffect(() => {
    if (show) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        setTimeout(() => osc.stop(), 1500);
      } catch {}
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 w-full bg-destructive z-50 py-2 px-6 flex justify-between items-center alert-banner">
      <span className="font-bold tracking-widest text-sm text-foreground">
        ⚠️ CRITICAL STAMPEDE RISK DETECTED — COMMENCE EVACUATION PROTOCOL
      </span>
      <button
        onClick={onDismiss}
        className="text-[10px] border border-foreground/40 px-3 py-1 rounded text-foreground hover:bg-foreground/10 transition-colors"
      >
        ACKNOWLEDGE
      </button>
    </div>
  );
}
