import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installUiSound } from './utils/sound'

installUiSound()

// Native-app feel: suppress right-click menu and image drag
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => e.preventDefault());

function mountApp() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

async function prepareDevelopmentPage() {
  if (!('serviceWorker' in navigator) || !import.meta.env.DEV) return false;

  // An older production worker can control the first localhost request. Clear
  // it before mounting, then automatically perform the one clean reload that
  // previously had to be done manually.
  const wasControlled = Boolean(navigator.serviceWorker.controller);
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('broadcast-tv-'))
          .map((key) => caches.delete(key))
      );
    }
  } catch {
    // The development app can still run if browser cache cleanup is blocked.
  }

  const reloadKey = 'broadcastTV_devWorkerReloaded';
  if (wasControlled && sessionStorage.getItem(reloadKey) !== '1') {
    sessionStorage.setItem(reloadKey, '1');
    window.location.reload();
    return true;
  }
  sessionStorage.removeItem(reloadKey);
  return false;
}

prepareDevelopmentPage().then((reloading) => {
  if (!reloading) mountApp();
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        const announceUpdate = (worker) => {
          if (!worker || !navigator.serviceWorker.controller) return;
          window.dispatchEvent(new CustomEvent('broadcast-tv:update-ready', {
            detail: {
              activate: () => worker.postMessage({ type: 'SKIP_WAITING' }),
            },
          }));
        };

        if (registration.waiting) announceUpdate(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed') announceUpdate(worker);
          });
        });

        registration.update();
      })
      .catch((error) => {
        console.warn('[TV] Service worker registration failed:', error);
      });
  });
}
