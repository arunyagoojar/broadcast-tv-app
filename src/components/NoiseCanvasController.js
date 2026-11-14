export function createNoiseController(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const grain = document.createElement('canvas');
  grain.width = grain.height = 256;
  const grainContext = grain.getContext('2d', { alpha: false });
  const pixels = grainContext.createImageData(256, 256);
  const frameInterval = 1000 / 30;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let animation = null;
  let observer = null;
  let running = false;
  let lastFrameAt = 0;
  let randomState = (Date.now() >>> 0) || 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2_500_000 / Math.max(1, rect.width * rect.height)));
    canvas.width = Math.max(1, Math.floor(rect.width * scale));
    canvas.height = Math.max(1, Math.floor(rect.height * scale));
    if (running) drawNoise();
  }

  function drawNoise(timestamp = 0) {
    const data = pixels.data;
    // Regenerate only this small texture; tile it at native pixel resolution.
    for (let i = 0; i < data.length; i += 4) {
      randomState ^= randomState << 13;
      randomState ^= randomState >>> 17;
      randomState ^= randomState << 5;
      const value = 10 + ((randomState & 63) >> 1);
      data[i] = value;
      data[i + 1] = value + 1;
      data[i + 2] = value + 2;
      data[i + 3] = 255;
    }
    grainContext.putImageData(pixels, 0, 0);
    ctx.fillStyle = ctx.createPattern(grain, 'repeat');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const bandY = (timestamp * 0.025) % (canvas.height + 160) - 80;
    const band = ctx.createLinearGradient(0, bandY - 80, 0, bandY + 80);
    band.addColorStop(0, 'rgba(0,0,0,0)');
    band.addColorStop(0.5, 'rgba(0,0,0,0.18)');
    band.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function loop(timestamp) {
    if (timestamp - lastFrameAt >= frameInterval) {
      drawNoise(timestamp);
      lastFrameAt = timestamp;
    }
    animation = requestAnimationFrame(loop);
  }

  function pauseFrames() {
    if (animation !== null) cancelAnimationFrame(animation);
    animation = null;
  }

  function updateAnimation() {
    pauseFrames();
    if (running && document.visibilityState === 'visible' && !reducedMotion.matches) {
      lastFrameAt = 0;
      animation = requestAnimationFrame(loop);
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      drawNoise();
      canvas.classList.remove('hidden');
      updateAnimation();
    },
    stop() {
      running = false;
      canvas.classList.add('hidden');
      pauseFrames();
    },
    init() {
      resize();
      document.addEventListener('visibilitychange', updateAnimation);
      reducedMotion.addEventListener('change', updateAnimation);
      if ('ResizeObserver' in window) {
        observer = new ResizeObserver(resize);
        observer.observe(canvas);
      } else window.addEventListener('resize', resize);
      this.start();
    },
    destroy() {
      running = false;
      pauseFrames();
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', updateAnimation);
      reducedMotion.removeEventListener('change', updateAnimation);
    },
  };
}
