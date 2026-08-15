import { useEffect } from 'react';

export function useWakeLock(enabled = true) {
  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      try {
        if (enabled && 'wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('[TV] Wake Lock error:', err);
      }
    };

    const handleVisibilityChange = () => {
      if (enabled && wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    if (enabled) requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (wakeLock) wakeLock.release().catch(() => {});
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);
}
