let audioCtx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// A short, soft, modern UI tick — quiet and unobtrusive.
export function playClick() {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2600, now);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(660, now);
  osc.frequency.exponentialRampToValueAtTime(330, now + 0.035);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.05, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.1);
}

let installed = false;
export function installUiSound() {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  // Prime the AudioContext on the first user gesture so later programmatic
  // plays are permitted by browser autoplay policies.
  const prime = () => {
    getCtx();
    window.removeEventListener('pointerdown', prime);
  };
  window.addEventListener('pointerdown', prime, { once: true });

  document.addEventListener(
    'click',
    (e) => {
      const el = e.target?.closest?.('button, [role="button"], a[href]');
      if (!el || el.hasAttribute('data-no-sound')) return;
      playClick();
    },
    true
  );
}
