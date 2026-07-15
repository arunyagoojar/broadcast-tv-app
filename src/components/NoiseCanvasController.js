export function createNoiseController(canvas) {
  const ctx = canvas.getContext('2d');
  const frameInterval = 1000 / 60;
  const sampleScale = 2;
  let animId = null;
  let imageData = null;
  let lastFrameAt = 0;
  let resizeObserver = null;
  let randomState = (Date.now() >>> 0) || 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(rect.width / sampleScale));
    const height = Math.max(1, Math.ceil(rect.height / sampleScale));

    if (canvas.width === width && canvas.height === height && imageData) return;

    canvas.width = width;
    canvas.height = height;
    imageData = ctx.createImageData(width, height);
  }

  function drawNoise() {
    if (!imageData) resize();
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      randomState ^= randomState << 13;
      randomState ^= randomState >>> 17;
      randomState ^= randomState << 5;
      const v = randomState & 255;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 195;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function loop(timestamp) {
    if (timestamp - lastFrameAt >= frameInterval) {
      drawNoise();
      lastFrameAt = timestamp;
    }
    animId = requestAnimationFrame(loop);
  }

  return {
    start() {
      canvas.classList.remove('hidden');
      if (animId === null) {
        lastFrameAt = 0;
        animId = requestAnimationFrame(loop);
      }
    },
    stop() {
      canvas.classList.add('hidden');
      if (animId !== null) cancelAnimationFrame(animId);
      animId = null;
    },
    init() {
      resize();
      if ('ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvas);
      } else {
        window.addEventListener('resize', resize);
      }
      this.start();
    },
    destroy() {
      window.removeEventListener('resize', resize);
      resizeObserver?.disconnect();
      if (animId !== null) cancelAnimationFrame(animId);
      animId = null;
      imageData = null;
    },
  };
}
