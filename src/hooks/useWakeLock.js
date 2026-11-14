import { useEffect } from 'react';

export function useWakeLock(enabled = true) {
  useEffect(() => {
    let wakeLock = null;
    let disposed = false;
    let requesting = false;

    const requestWakeLock = async () => {
      try {
        if (!enabled || disposed || requesting || wakeLock && !wakeLock.released || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
        requesting = true;
        const acquired = await navigator.wakeLock.request('screen');
        if (disposed) await acquired.release();
        else wakeLock = acquired;
      } catch (err) {
        console.warn('[TV] Wake Lock error:', err);
      } finally {
        requesting = false;
      }
    };

    const handleVisibilityChange = () => {
      if (enabled && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    if (enabled) requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      if (wakeLock) wakeLock.release().catch(() => {});
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);
}
