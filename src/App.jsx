import { useRef, useState, useEffect, useCallback } from 'react';

import { createNoiseController } from './components/NoiseCanvasController';
import { useWakeLock } from './hooks/useWakeLock';
import PlayerStage from './components/PlayerStage';
import HUD from './components/HUD';
import ChannelModal from './components/ChannelModal';
import Overlays from './components/Overlays';

import { CHANNELS } from './constants/channels';
import { fetchChannelContent } from './api/channels';

/* ─────────────────────────────────────────────────────
   MAIN APP COMPONENT
───────────────────────────────────────────────────── */
export default function App() {
  /* ── Refs ── */
  const canvasRef = useRef(null);
  const glitchRef = useRef(null);
  const hudTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const playerRef = useRef(null);
  const noiseRef = useRef(null);
  const currentProgressRef = useRef(0);

  /* ── Mutable state (not triggering re-render) via ref ── */
  const S = useRef({
    activeChannelIndex: 0,
    channelStates: {}, // { [ch.id]: { playlist: [], startedAt: timestamp } }
    switchToken: 0,
    failChainCount: 0,
  });

  /* ── React state (triggers re-render) ── */
  const [statusText, setStatusText] = useState('SCANNING');
  const [statusVisible, setStatusVisible] = useState(true);
  const [hudFadeOut, setHudFadeOut] = useState(false);
  const [networkFadeOut, setNetworkFadeOut] = useState(false);
  const [networkActive, setNetworkActive] = useState(false);
  
  const [currentTitle, setCurrentTitle] = useState('');
  const [playbackTimeStr, setPlaybackTimeStr] = useState('');
  
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [channelLabel, setChannelLabel] = useState('CH 1');
  const [toastMsg, setToastMsg] = useState('');
  const [toastShow, setToastShow] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const [glitchBg, setGlitchBg] = useState('');
  const [isPoweredOff, setIsPoweredOff] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [hasUnmuted, setHasUnmuted] = useState(false);
  const hasUnmutedRef = useRef(false);
  const [currentEmbedUrl, setCurrentEmbedUrl] = useState('');

  /* ── Screen Wake Lock ── */
  useWakeLock();

  /* ── Toast helper ── */
  const showToast = useCallback((msg, ms = 2600) => {
    setToastMsg(msg);
    setToastShow(true);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastShow(false), ms);
  }, []);

  /* ── Status helpers ── */
  const setStatus = useCallback((label) => {
    setStatusText(label);
    setStatusVisible(true);
    if (noiseRef.current) noiseRef.current.start();
  }, []);

  const clearStatusFn = useCallback(() => {
    setStatusVisible(false);
    if (noiseRef.current) noiseRef.current.stop();
  }, []);

  /* ── Channel label sync ── */
  const syncLabels = useCallback(() => {
    const s = S.current;
    const channel = CHANNELS[s.activeChannelIndex];
    if (channel) {
      setChannelLabel(channel.name.replace(' (24/7)', '').toUpperCase());
      setNetworkActive(true);
    }
  }, []);

  /* ── Glitch flash ── */
  const flashGlitch = useCallback(() => {
    setGlitchActive(false);
    if (glitchRef.current) void glitchRef.current.offsetWidth;
    setGlitchBg(
      `repeating-linear-gradient(0deg,rgba(255,255,255,0.85) 0 1px,rgba(0,0,0,0.9) 1px ${2 + Math.random() * 3}px)`
    );
    setGlitchActive(true);
  }, []);

  /* ── HUD auto-hide ── */
  const resetHudIdle = useCallback(() => {
    setHudFadeOut(false);
    setNetworkFadeOut(false);
    clearTimeout(hudTimerRef.current);
    if (document.querySelector('.search-modal.open')) return;
    hudTimerRef.current = setTimeout(() => {
      setHudFadeOut(true);
      setNetworkFadeOut(true);
    }, 3000);
  }, []);

  /* ── Noise canvas (imperative, once) ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const noise = createNoiseController(canvas);
    noise.init();
    noiseRef.current = noise;
    return () => {
      noise.destroy();
      noiseRef.current = null;
    };
  }, []);

  /* ── HUD idle listeners ── */
  useEffect(() => {
    const handler = () => resetHudIdle();
    window.addEventListener('mousemove', handler);
    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', handler);
    const t = setTimeout(resetHudIdle, 0);
    return () => {
      window.removeEventListener('mousemove', handler);
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', handler);
      clearTimeout(t);
      clearTimeout(hudTimerRef.current);
    };
  }, [resetHudIdle]);

  /* ── Switch channel ── */
  const switchTo = useCallback(async (index) => {
    const s = S.current;
    
    // Wrap around index for infinite scrolling
    if (index < 0) index = (CHANNELS.length + (index % CHANNELS.length)) % CHANNELS.length;
    else index = index % CHANNELS.length;

    s.switchToken++;
    const tok = s.switchToken;

    flashGlitch();
    setStatus('TUNING');

    const delayTime = s.failChainCount > 2 ? 800 : 250;
    await new Promise((r) => setTimeout(r, delayTime));
    if (tok !== s.switchToken) return;

    const channel = CHANNELS[index];
    s.activeChannelIndex = index;
    syncLabels();

    // Save to local storage for persistent session
    localStorage.setItem('ytTV_lastChannel', index);

    // Initialize continuous timeline state for this channel if missing
    if (!s.channelStates[channel.id]) {
      s.channelStates[channel.id] = {
        playlist: [],
        // Will be dynamically offset based on the first fetched item
        startedAt: Date.now()
      };
    }

    const state = s.channelStates[channel.id];
    let elapsed = (Date.now() - state.startedAt) / 1000;
    let currentItem = null;
    let resumeAt = 0;
    let exhausted = false;

    // Traverse the timeline
    while (true) {
      let accumulatedTime = 0;
      let foundIndex = -1;

      for (let i = 0; i < state.playlist.length; i++) {
        const item = state.playlist[i];
        if (elapsed < accumulatedTime + item.dur) {
          foundIndex = i;
          resumeAt = elapsed - accumulatedTime;
          break;
        }
        accumulatedTime += item.dur;
      }

      if (foundIndex !== -1) {
        currentItem = state.playlist[foundIndex];
        break;
      } else {
        // The playlist is empty or exhausted, fetch a new dynamic batch!
        setStatus('SCANNING');
        const newItems = await fetchChannelContent(channel);
        if (tok !== s.switchToken) return;

        if (newItems && newItems.length > 0) {
          if (state.playlist.length === 0) {
            const firstItem = newItems[0];
            let randomOffset;
            if (firstItem.dur >= 5400) {
              // Movie: 15 to 25 mins (900s to 1500s)
              randomOffset = Math.floor(Math.random() * (1500 - 900 + 1) + 900);
            } else {
              // TV Show: 3 to 10 mins (180s to 600s)
              randomOffset = Math.floor(Math.random() * (600 - 180 + 1) + 180);
            }
            state.startedAt = Date.now() - (randomOffset * 1000);
            elapsed = (Date.now() - state.startedAt) / 1000;
          }
          state.playlist.push(...newItems);
          // Loop again to find the item in the newly appended items
        } else {
          exhausted = true;
          break;
        }
      }
    }

    if (exhausted || !currentItem) {
      s.failChainCount++;
      setStatus('NO SIGNAL');
      return;
    }

    s.failChainCount = 0;

    if (currentItem.embedUrl) {
      let finalEmbedUrl = currentItem.embedUrl;
      if (resumeAt > 0) {
        try {
          const urlObj = new URL(finalEmbedUrl);
          urlObj.searchParams.set('resumeAt', Math.floor(resumeAt));
          finalEmbedUrl = urlObj.toString();
        } catch (e) {
          console.warn('[TV] Failed to parse embed URL for resume time:', e);
        }
      }
      setCurrentEmbedUrl(finalEmbedUrl);

      setTimeout(() => {
        if (s.switchToken === tok) clearStatusFn();
      }, 1800);
    }
  }, [flashGlitch, setStatus, syncLabels, clearStatusFn]);

  /* ── Initial Load Logic ── */
  useEffect(() => {
    const saved = localStorage.getItem('ytTV_lastChannel');
    let startIndex = 0;
    if (saved !== null && !isNaN(saved)) {
      startIndex = parseInt(saved, 10);
    } else {
      // First time visitor gets a random channel
      startIndex = Math.floor(Math.random() * CHANNELS.length);
    }
    
    // Ensure index is within bounds
    startIndex = Math.max(0, Math.min(startIndex, CHANNELS.length - 1));
    
    // Slight delay to let noise canvas initialize
    setTimeout(() => {
      switchTo(startIndex, 'forward');
    }, 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Unmute Detection ── */
  useEffect(() => {
    const handleBlur = () => {
      setTimeout(() => {
        if (document.activeElement === playerRef.current) {
          if (!hasUnmutedRef.current) {
            setHasUnmuted(true);
            hasUnmutedRef.current = true;
            showToast('AUDIO ENABLED');
          }
        }
      }, 0);
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [hasUnmuted, showToast]);

  /* ── Handle channel failure ── */
  const handleChannelFailure = useCallback(() => {
    const s = S.current;
    if (s.failChainCount > 10) {
      showToast('SIGNAL LOSS DETECTED');
      s.failChainCount = 0;
      setStatus('NO SIGNAL');
      return;
    }
    switchTo(s.activeChannelIndex + 1);
  }, [showToast, setStatus, switchTo]);

  // HTML5 Video Handlers
  const handlePlay = useCallback(() => {
    S.current.failChainCount = 0;
    clearStatusFn();
  }, [clearStatusFn]);

  const skipCurrentVideo = useCallback(() => {
    const s = S.current;
    const channel = CHANNELS[s.activeChannelIndex];
    if (!channel) return;
    const state = s.channelStates[channel.id];
    if (!state || !state.playlist.length) return;

    let elapsed = (Date.now() - state.startedAt) / 1000;
    let accumulatedTime = 0;
    let currentItem = null;

    for (let i = 0; i < state.playlist.length; i++) {
      const item = state.playlist[i];
      if (elapsed < accumulatedTime + item.dur) {
        currentItem = item;
        break;
      }
      accumulatedTime += item.dur;
    }

    if (currentItem) {
      state.startedAt -= (currentItem.dur * 1000);
    }

    switchTo(s.activeChannelIndex);
  }, [switchTo]);

  const handleEnded = useCallback(() => {
    skipCurrentVideo();
  }, [skipCurrentVideo]);

  const handleError = useCallback(() => {
    handleChannelFailure();
  }, [handleChannelFailure]);

  // Listen for iframe player events via postMessage
  useEffect(() => {
    function handleMessage(e) {
      if (e.data && e.data.type === 'PLAYER_EVENT') {
        const { player_status, player_progress } = e.data.data;
        if (player_progress) {
          currentProgressRef.current = player_progress;
        }
        if (player_status === 'playing') {
          handlePlay();
        } else if (player_status === 'completed') {
          handleEnded();
        } else if (player_status === 'paused' && hasUnmutedRef.current) {
          // If paused manually, forcefully resume it immediately
          const s = S.current;
          setTimeout(() => {
            switchTo(s.activeChannelIndex, 'forward');
          }, 100);
        }
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handlePlay, handleEnded, switchTo]);


  /* ── Open / Close Channel Modal ── */
  const openChannelModal = useCallback(() => {
    setChannelModalOpen(true);
    setHudFadeOut(false);
    setNetworkFadeOut(false);
    clearTimeout(hudTimerRef.current);
  }, []);
  const closeChannelModal = useCallback(() => {
    setChannelModalOpen(false);
    resetHudIdle();
  }, [resetHudIdle]);

  const handleSelectChannel = useCallback((id) => {
    const index = CHANNELS.findIndex(ch => ch.id === id);
    if (index !== -1) {
      closeChannelModal();
      switchTo(index, 'forward');
    }
  }, [closeChannelModal, switchTo]);

  /* ── Fullscreen toggle ── */
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.().catch(() => { });
    } else {
      await document.exitFullscreen?.().catch(() => { });
    }
  }, []);

  /* ── Theme cycling ── */
  const themes = useRef(['', 'theme-green', 'theme-amber', 'theme-bw', 'theme-blue', 'theme-purple', 'theme-red', 'theme-cyan']);
  const themeIdx = useRef(0);
  const cycleTheme = useCallback(() => {
    themeIdx.current = (themeIdx.current + 1) % themes.current.length;
    document.body.className = themes.current[themeIdx.current];
  }, []);

  /* ── Power toggle ── */
  const togglePower = useCallback(() => {
    setIsPoweredOff((prev) => {
      const next = !prev;
      if (next) {
        if (playerRef.current && playerRef.current.tagName === 'VIDEO') playerRef.current.pause();
        if (noiseRef.current) noiseRef.current.stop();
      } else {
        if (playerRef.current && playerRef.current.tagName === 'VIDEO') {
          playerRef.current.play().catch(err => console.warn('[TV] Play blocked:', err));
        }
        if (document.querySelector('.status-layer.visible')) {
          if (noiseRef.current) noiseRef.current.start();
        }
      }
      return next;
    });
  }, []);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    function onKeyDown(e) {
      if (channelModalOpen) {
        if (e.key === 'Escape') closeChannelModal();
        return;
      }
      if (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA'
      )
        return;

      const s = S.current;

      if (e.key === ' ') {
        e.preventDefault();
        if (playerRef.current && playerRef.current.tagName === 'VIDEO') {
          playerRef.current.muted = !playerRef.current.muted;
        } else if (playerRef.current && playerRef.current.tagName === 'IFRAME') {
          // Send generic mute command via postMessage for cross-origin iframe
          playerRef.current.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
          playerRef.current.contentWindow.postMessage(JSON.stringify({ type: 'PLAYER_EVENT', data: { action: 'mute' } }), '*');
        }
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        cycleTheme();
      } else if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setOverlayEnabled((prev) => !prev);
      } else if (e.key === '/' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        openChannelModal();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        switchTo(s.activeChannelIndex + 1, 'forward');
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        switchTo(s.activeChannelIndex - 1, 'back');
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [channelModalOpen, closeChannelModal, openChannelModal, switchTo, cycleTheme, toggleFullscreen]);

  /* ── Time & Title Tracker ── */
  useEffect(() => {
    const interval = setInterval(() => {
      const s = S.current;
      const channel = CHANNELS[s.activeChannelIndex];
      if (!channel) return;
      const state = s.channelStates[channel.id];
      if (!state || !state.playlist.length) return;

      let elapsed = (Date.now() - state.startedAt) / 1000;
      let accumulatedTime = 0;
      let currentItem = null;

      for (let i = 0; i < state.playlist.length; i++) {
        const item = state.playlist[i];
        if (elapsed < accumulatedTime + item.dur) {
          currentItem = item;
          break;
        }
        accumulatedTime += item.dur;
      }

      if (currentItem) {
        const currentSeconds = Math.max(0, elapsed - accumulatedTime);
        const remainingSeconds = Math.max(0, currentItem.dur - currentSeconds);

        const formatTime = (secs) => {
          const s = Math.floor(secs);
          const h = Math.floor(s / 3600);
          const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
          const sec = Math.floor(s % 60).toString().padStart(2, '0');
          if (h > 0) return `${h}:${m}:${sec}`;
          return `${m}:${sec}`;
        };

        setPlaybackTimeStr(`${formatTime(currentSeconds)} / -${formatTime(remainingSeconds)}`);
        setCurrentTitle(currentItem.title);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  /* ── JSX ── */
  return (
    <div className={`app${isPoweredOff ? ' power-off' : ''}`}>
      <PlayerStage
        playerRef={playerRef}
        onPlay={handlePlay}
        onEnded={handleEnded}
        onError={handleError}
        embedUrl={isPoweredOff ? '' : currentEmbedUrl}
        hasUnmuted={hasUnmuted}
      />

      <Overlays
        canvasRef={canvasRef}
        overlayEnabled={overlayEnabled}
        glitchRef={glitchRef}
        glitchActive={glitchActive}
        glitchBg={glitchBg}
        statusVisible={statusVisible}
        statusText={statusText}
        networkActive={networkActive}
        networkFadeOut={networkFadeOut}
        currentTitle={currentTitle}
        playbackTimeStr={playbackTimeStr}
        toastShow={toastShow}
        toastMsg={toastMsg}
        togglePower={togglePower}
      />

      <HUD
        hudFadeOut={hudFadeOut}
        channelLabel={channelLabel}
        openChannelModal={openChannelModal}
        switchToNext={() => switchTo(S.current.activeChannelIndex + 1)}
        switchToPrev={() => switchTo(S.current.activeChannelIndex - 1)}
        toggleFullscreen={toggleFullscreen}
        refreshVideo={skipCurrentVideo}
      />

      <ChannelModal
        isOpen={channelModalOpen}
        onClose={closeChannelModal}
        onSelect={handleSelectChannel}
        channels={CHANNELS}
      />
    </div>
  );
}
