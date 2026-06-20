import { useRef, useState, useEffect, useCallback } from 'react';

import { seededShuffle } from './utils/helpers';
import { searchChannels } from './api/channels';
import { createNoiseController } from './components/NoiseCanvasController';
import { useWakeLock } from './hooks/useWakeLock';
import PlayerStage from './components/PlayerStage';
import HUD from './components/HUD';
import SearchModal from './components/SearchModal';
import Overlays from './components/Overlays';


/* ─────────────────────────────────────────────────────
   MAIN APP COMPONENT
───────────────────────────────────────────────────── */
export default function App() {
  /* ── Refs ── */
  const canvasRef = useRef(null);
  const glitchRef = useRef(null);
  const searchInputRef = useRef(null);
  const hudTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const playerRef = useRef(null);
  const noiseRef = useRef(null);
  const currentProgressRef = useRef(0);

  /* ── Mutable state (not triggering re-render) via ref ── */
  const S = useRef({
    query: '',
    sessionSeed: '',
    activeIndex: null,
    pool: [],
    poolPointer: 0,
    switchToken: 0,
    reqId: 0,
    failChainCount: 0,
    channelHistory: {},
  });

  /* ── React state (triggers re-render) ── */
  const [statusText, setStatusText] = useState('NO SIGNAL');
  const [statusVisible, setStatusVisible] = useState(true);
  const [hudFadeOut, setHudFadeOut] = useState(false);
  const [networkFadeOut, setNetworkFadeOut] = useState(false);
  const [networkActive, setNetworkActive] = useState(false);
  const [networkName, setNetworkName] = useState('-');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [channelLabel, setChannelLabel] = useState('CH 00');
  const [volume, setVolume] = useState(70);
  const [toastMsg, setToastMsg] = useState('');
  const [toastShow, setToastShow] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const [glitchBg, setGlitchBg] = useState('');
  const [isPoweredOff, setIsPoweredOff] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [hasUnmuted, setHasUnmuted] = useState(false);
  const hasUnmutedRef = useRef(false);
  const [history, setHistory] = useState(() =>
    JSON.parse(localStorage.getItem('ytTV_history') || '[]').slice(0, 5)
  );
  const [subscriptions, setSubscriptions] = useState(() =>
    JSON.parse(localStorage.getItem('ytTV_subs') || '[]')
  );
  const [helpVisible, setHelpVisible] = useState(false);
  const [currentEmbedUrl, setCurrentEmbedUrl] = useState('');

  /* Keep latest subscriptions in ref for non-render callbacks */
  const subsRef = useRef(subscriptions);
  useEffect(() => { subsRef.current = subscriptions; }, [subscriptions]);



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
    const ch = s.activeIndex == null ? '00' : String(s.activeIndex + 1).padStart(2, '0');
    setChannelLabel(`CH ${ch}`);
  }, []);

  /* ── Subscription UI sync ── */
  const syncSubscriptionUI = useCallback(() => {
    const s = S.current;
    if (!s.query) {
      setNetworkActive(false);
      return;
    }
    setNetworkName(s.query.toUpperCase());
    setNetworkActive(true);
    const isSub = subsRef.current.some(
      (x) => x.toLowerCase() === s.query.trim().toLowerCase()
    );
    setIsSubscribed(isSub);
  }, []);

  /* ── Glitch flash ── */
  const flashGlitch = useCallback(() => {
    setGlitchActive(false);
    // Force reflow via ref
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

  /* ── Generate random offset for video playback ── */
  function generateRandomOffset(item) {
    const duration = item.dur || 300;
    return duration > 60 ? Math.floor(Math.random() * (duration * 0.7)) : 0;
  }

  /* ── Switch channel ── */
  const switchTo = useCallback(
    async (index, dir = 'forward', isVideoEnd = false) => {
      const s = S.current;
      void dir;
      if (!s.pool.length) {
        setStatus('NO SIGNAL');
        return;
      }

      // Save current position
      if (
        playerRef.current &&
        playerRef.current.tagName === 'VIDEO' &&
        s.activeIndex !== null &&
        s.pool[s.activeIndex]
      ) {
        try {
          const isPlaying = !playerRef.current.paused && !playerRef.current.ended;
          if (isPlaying) {
            const currentVideo = s.pool[s.activeIndex];
            s.channelHistory[currentVideo.id] = {
              savedTime: playerRef.current.currentTime || 0,
              leftAt: Date.now(),
            };
          }
        } catch (err) {
          console.warn('[TV] Safely bypassed history tracking allocation:', err);
        }
      }

      if (index < 0)
        index = (s.pool.length + (index % s.pool.length)) % s.pool.length;
      else index = index % s.pool.length;

      s.switchToken++;
      const tok = s.switchToken;

      flashGlitch();
      setStatus('TUNING');

      const delayTime = s.failChainCount > 2 ? 800 : 250;
      await new Promise((r) => setTimeout(r, delayTime));
      if (tok !== s.switchToken) return;

      const item = s.pool[index];

      let startTime = 0;
      if (!isVideoEnd) {
        if (s.channelHistory[item.id]) {
          const hist = s.channelHistory[item.id];
          const elapsedSeconds = (Date.now() - hist.leftAt) / 1000;
          startTime = Math.floor(hist.savedTime + elapsedSeconds);
          if (item.dur && startTime >= item.dur) {
            startTime = startTime % item.dur;
          }
        } else {
          startTime = generateRandomOffset(item);
        }
      }

      s.activeIndex = index;
      syncLabels();

      if (item.embedUrl) {
        // For VidAPI iframe player
        let finalEmbedUrl = item.embedUrl;
        if (startTime > 0) {
          try {
            const urlObj = new URL(finalEmbedUrl);
            urlObj.searchParams.set('resumeAt', startTime);
            finalEmbedUrl = urlObj.toString();
          } catch (e) {
            console.warn('[TV] Failed to parse embed URL for resume time:', e);
          }
        }
        setCurrentEmbedUrl(finalEmbedUrl);

        // Auto-clear static noise/tuning after a short delay for iframe embeds,
        // so that even if the postMessage event is missed or blocked by the sandbox,
        // the screen still clears and reveals the video player!
        setTimeout(() => {
          if (s.switchToken === tok) {
            clearStatusFn();
          }
        }, 1800);
      } else {
        setCurrentEmbedUrl('');
        if (playerRef.current && playerRef.current.tagName === 'VIDEO') {
          playerRef.current.src = item.url;
          playerRef.current.currentTime = startTime;
          playerRef.current.volume = volume / 100;
          playerRef.current.play().catch((err) => {
            console.warn('[TV] Auto-play block/interruption:', err);
          });
        }
      }
    },
    [flashGlitch, setStatus, syncLabels, volume, clearStatusFn]
  );

  /* ── Unmute Detection ── */
  useEffect(() => {
    const handleBlur = () => {
      // Small timeout to allow document.activeElement to update to the iframe
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
    if (s.activeIndex == null || !s.pool.length) return;
    s.failChainCount++;

    if (s.failChainCount > s.pool.length) {
      showToast('SIGNAL LOSS DETECTED - SEARCH AGAIN');
      s.failChainCount = 0;
      setStatus('NO SIGNAL');
      return;
    }

    console.warn(
      `[TV] Restricted video bypass. Auto-tuning past index: ${s.activeIndex}`
    );
    switchTo(s.activeIndex + 1, 'forward');
  }, [showToast, setStatus, switchTo]);

  // HTML5 Video Handlers
  const handlePlay = useCallback(() => {
    S.current.failChainCount = 0;
    clearStatusFn();
  }, [clearStatusFn]);

  const handleEnded = useCallback(() => {
    const s = S.current;
    if (s.activeIndex == null) return;
    switchTo(s.activeIndex + 1, 'forward', true);
  }, [switchTo]);

  const handleError = useCallback(() => {
    handleChannelFailure();
  }, [handleChannelFailure]);

  // Handle local video playback if currentEmbedUrl is empty
  useEffect(() => {
    const s = S.current;
    if (!currentEmbedUrl && s.pool[s.activeIndex] && playerRef.current && playerRef.current.tagName === 'VIDEO') {
      const item = s.pool[s.activeIndex];
      playerRef.current.src = item.url;
      playerRef.current.volume = volume / 100;
      playerRef.current.play().catch((err) => {
        console.warn('[TV] Local video autoplay block:', err);
      });
    }
  }, [currentEmbedUrl, volume]);

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
          // The user paused the video (e.g. using spacebar)
          // Force it to resume by reloading the iframe at the current timestamp!
          const s = S.current;
          if (s.activeIndex != null && s.pool[s.activeIndex]) {
            if (currentProgressRef.current) {
              s.channelHistory[s.pool[s.activeIndex].id] = {
                savedTime: currentProgressRef.current,
                leftAt: Date.now()
              };
            }
            setTimeout(() => {
              switchTo(s.activeIndex, 'forward');
            }, 100);
          }
        }
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handlePlay, handleEnded, switchTo]);



  /* ── Build session from search results ── */
  const buildSession = useCallback(
    (query, pool) => {
      const s = S.current;
      s.query = query;
      s.sessionSeed = `${query}::${Date.now()}`;
      s.activeIndex = 0;
      s.pool = seededShuffle(pool, s.sessionSeed);
      s.poolPointer = 0;
      s.failChainCount = 0;
      s.channelHistory = {};
      syncLabels();
      syncSubscriptionUI();
    },
    [syncLabels, syncSubscriptionUI]
  );

  /* ── Save search to history ── */
  const saveHistory = useCallback((q) => {
    if (!q || !q.trim()) return;
    setHistory((prev) => {
      const updated = [q, ...prev.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 5);
      localStorage.setItem('ytTV_history', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleSearchRef = useRef(null);

  /* ── Handle search ── */
  const handleSearch = useCallback(
    async (q, isRetry = false) => {
      const query = q.trim().replace(/\s+/g, ' ');

      // Close search
      setSearchOpen(false);
      resetHudIdle();
      setStatus(isRetry ? 'RETRYING' : 'SCANNING');

      const s = S.current;
      s.switchToken++;
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.src = '';
      }

      s.reqId++;
      const reqId = s.reqId;

      try {
        const pool = await searchChannels(query);
        if (reqId !== s.reqId) return;

        if (!pool || pool.length === 0) {
          if (!isRetry) {
            showToast('CONNECTION FAILED - RETRYING...');
            setTimeout(() => handleSearchRef.current?.(q, true), 1500);
          } else {
            setStatus('NO SIGNAL');
            showToast('SIGNAL LOST. TRY ANOTHER SEARCH.');
          }
          return;
        }

        buildSession(query, pool);
        saveHistory(query);
        showToast(`${pool.length} CHANNELS ONLINE`);
        switchTo(0, 'forward');
      } catch {
        if (reqId !== s.reqId) return;
        if (!isRetry) {
          showToast('CONNECTION FAILED - RETRYING...');
          setTimeout(() => handleSearchRef.current?.(q, true), 1500);
        } else {
          setStatus('NO SIGNAL');
          showToast('TRANS-LINK TIMED OUT');
        }
      }
    },
    [setStatus, showToast, buildSession, saveHistory, switchTo, resetHudIdle]
  );

  useEffect(() => {
    handleSearchRef.current = handleSearch;
  }, [handleSearch]);

  // Load the initial comedy channel on mount
  useEffect(() => {
    handleSearch("");
  }, [handleSearch]);

  /* ── Volume change handler ── */
  const handleVolumeChange = useCallback((e) => {
    const v = Number(e.target.value);
    setVolume(v);
    if (playerRef.current && playerRef.current.tagName === 'VIDEO') {
      playerRef.current.volume = v / 100;
      playerRef.current.muted = (v === 0);
    }
  }, []);

  /* ── Open / Close search ── */
  const openSearchFn = useCallback(
    (q = '') => {
      setSearchOpen(true);
      setHudFadeOut(false);
      setNetworkFadeOut(false);
      clearTimeout(hudTimerRef.current);
      if (q) setSearchValue(q);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    },
    []
  );
  const closeSearchFn = useCallback(() => {
    setSearchOpen(false);
    resetHudIdle();
  }, [resetHudIdle]);

  /* ── Toggle subscription ── */
  const toggleSubscription = useCallback(() => {
    const s = S.current;
    if (!s.query) return;
    const normalized = s.query.trim();

    setSubscriptions((prev) => {
      const idx = prev.findIndex(
        (x) => x.toLowerCase() === normalized.toLowerCase()
      );
      let updated;
      if (idx > -1) {
        updated = prev.filter((_, i) => i !== idx);
        showToast('REMOVED FROM SAVED NETWORKS');
      } else {
        updated = [normalized, ...prev];
        showToast('ADDED TO SAVED NETWORKS');
      }
      localStorage.setItem('ytTV_subs', JSON.stringify(updated));
      const isSub = updated.some(
        (x) => x.toLowerCase() === s.query.trim().toLowerCase()
      );
      setIsSubscribed(isSub);
      return updated;
    });
  }, [showToast]);

  /* ── Delete subscription ── */
  const deleteSubscription = useCallback(
    (q) => {
      setSubscriptions((prev) => {
        const updated = prev.filter((x) => x !== q);
        localStorage.setItem('ytTV_subs', JSON.stringify(updated));
        if (S.current.query.toLowerCase() === q.toLowerCase()) {
          const isSub = updated.some(
            (x) => x.toLowerCase() === S.current.query.trim().toLowerCase()
          );
          setIsSubscribed(isSub);
        }
        return updated;
      });
    },
    []
  );

  /* ── Search form submit ── */
  const handleSearchSubmit = useCallback(
    (e) => {
      e.preventDefault();
      handleSearch(searchValue);
    },
    [searchValue, handleSearch]
  );

  /* ── Fullscreen toggle ── */
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.().catch(() => { });
    } else {
      await document.exitFullscreen?.().catch(() => { });
    }
  }, []);

  /* ── Theme cycling ── */
  const themes = useRef(['', 'theme-green', 'theme-amber', 'theme-bw']);
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
        // If status layer is visible, restart noise
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
      if (searchOpen) {
        if (e.key === 'Escape') closeSearchFn();
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
          if (playerRef.current.muted) {
            playerRef.current.muted = false;
            setVolume(Math.round(playerRef.current.volume * 100));
          } else {
            playerRef.current.muted = true;
            setVolume(0);
          }
        }
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        cycleTheme();
      } else if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setOverlayEnabled((prev) => !prev);
      } else if (e.key === '/' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        openSearchFn(s.query);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!s.query) return openSearchFn();
        switchTo((s.activeIndex ?? -1) + 1, 'forward');
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!s.query) return openSearchFn();
        switchTo((s.activeIndex ?? 0) - 1, 'back');
      } else if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        if (s.query) switchTo(Number(e.key) - 1, 'forward');
      } else if (e.key === '0') {
        e.preventDefault();
        if (s.query) switchTo(9, 'forward');
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [searchOpen, closeSearchFn, openSearchFn, switchTo, cycleTheme]);

  /* ── Derived values ── */
  const hasBothSections = history.length > 0 && subscriptions.length > 0;

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
        networkName={networkName}
        isSubscribed={isSubscribed}
        toggleSubscription={toggleSubscription}
        toastShow={toastShow}
        toastMsg={toastMsg}
        togglePower={togglePower}
      />

      <HUD
        hudFadeOut={hudFadeOut}
        volume={volume}
        channelLabel={channelLabel}
        openSearchFn={openSearchFn}
        handleVolumeChange={handleVolumeChange}
        switchTo={switchTo}
        toggleFullscreen={toggleFullscreen}
        query={S.current.query}
        activeIndex={S.current.activeIndex}
      />

      <SearchModal
        searchOpen={searchOpen}
        closeSearchFn={closeSearchFn}
        searchInputRef={searchInputRef}
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        handleSearchSubmit={handleSearchSubmit}
        history={history}
        handleSearch={handleSearch}
        subscriptions={subscriptions}
        deleteSubscription={deleteSubscription}
        helpVisible={helpVisible}
        setHelpVisible={setHelpVisible}
        hasBothSections={hasBothSections}
      />
    </div>
  );
}
