import { useRef, useState, useEffect, useCallback } from 'react';

import { createNoiseController } from './components/NoiseCanvasController';
import { useWakeLock } from './hooks/useWakeLock';
import { useGamepadNavigation } from './hooks/useGamepadNavigation';
import PlayerStage from './components/PlayerStage';
import HUD from './components/HUD';
import SettingsMenu from './components/SettingsMenu';
import LeftMenu from './components/LeftMenu';
import MenuOverlay from './components/MenuOverlay';
import Overlays from './components/Overlays';

import { CHANNELS } from './constants/channels';
import localLogos from './constants/logos.json';
import { fetchChannelContent } from './api/channels';
import {
  isCompletionStatus,
  isPlayingStatus,
  normalizeDurationSeconds,
  readPlayerEventPayload,
  readProgressDurationSeconds,
  readProgressSeconds,
} from './utils/playerEvents';
import { moveFreshItemFirst } from './utils/playlist';
import { getRandomStartOffset, hasPlaybackAdvanced } from './utils/playback';
import { getTimelineSnapshot, getActivePlaybackSnapshot, syncReportedDuration, alignTimelineToProgress } from './utils/timeline';

const SETTINGS_KEY = 'broadcastTV_settings';
const SETTINGS_SCHEMA_VERSION = 2;
const CHANNEL_STATES_KEY = 'broadcastTV_channelStates_v11';
const RECENT_CHANNELS_KEY = 'broadcastTV_recentChannels';
const THEMES = ['', 'theme-green', 'theme-amber', 'theme-bw', 'theme-blue', 'theme-purple', 'theme-red', 'theme-cyan'];
const COMPLETION_LOAD_GRACE_MS = 3000;
const TRUSTED_END_EPSILON_SECONDS = 0.5;
const DEFAULT_SETTINGS = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  scanlines: true,
  vignette: true,
  theme: '',
  muted: true,
  logoMode: true,
  aspectRatio: '16-9',
  upNextMode: 'with-hud',
};

function loadSettingsSnapshot() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { settings: DEFAULT_SETTINGS, hasSavedSettings: false };
    const savedSettings = JSON.parse(raw);
    const needsUpNextDefaultMigration = Number(savedSettings.schemaVersion || 0) < SETTINGS_SCHEMA_VERSION;
    return {
      settings: {
        ...DEFAULT_SETTINGS,
        ...savedSettings,
        ...(needsUpNextDefaultMigration
          ? { schemaVersion: SETTINGS_SCHEMA_VERSION, upNextMode: 'with-hud' }
          : {}),
      },
      hasSavedSettings: true,
    };
  } catch {
    return { settings: DEFAULT_SETTINGS, hasSavedSettings: false };
  }
}

function getRandomPlayableChannelIndex() {
  const playableIndexes = CHANNELS
    .map((channel, index) => ({ channel, index }))
    .filter(({ channel }) => channel.id !== 0)
    .map(({ index }) => index);
  return playableIndexes[Math.floor(Math.random() * playableIndexes.length)] ?? 1;
}

function getPlayableLogoUrl(item) {
  if (!item) return null;
  const id = item.seriesId || String(item.id || '').split('-')[0];
  return localLogos[id] || (item.logoUrl?.startsWith('/artwork/') ? item.logoUrl : null);
}

function loadRecentChannelIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_CHANNELS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => Number.isFinite(Number(id))).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function loadChannelStatesSnapshot() {
  try {
    const raw = localStorage.getItem(CHANNEL_STATES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const isOldNoSignalFallback = (item) => {
      return (
        item?.title?.startsWith?.('No Signal') ||
        item?.id?.startsWith?.('fallback-')
      );
    };
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([id, state]) => {
          if (!state || typeof state !== 'object') return null;
          const playlistSource = Array.isArray(state.playlist)
            ? state.playlist
            : state.lockedItem
              ? [state.lockedItem]
              : [];
          const playlist = playlistSource
            .filter((item) => !isOldNoSignalFallback(item))
            .filter((item) => item && typeof item === 'object' && item.embedUrl)
            .map((item) => ({
              ...item,
              ...(Number(item.dur) > 0 ? {} : {
                dur: item.seriesId || item.embedUrl.includes('/tv/') ? 1800 : 7200,
                durationTrusted: false,
              }),
              logoUrl: getPlayableLogoUrl(item),
            }));
          if (!playlist.length) return null;
          return [id, {
            playlist,
            startedAt: Number.isFinite(Number(state.startedAt)) ? Number(state.startedAt) : Date.now(),
            recentPlayableKeys: Array.isArray(state.recentPlayableKeys)
              ? state.recentPlayableKeys.slice(0, 8)
              : [],
          }];
        })
        .filter(Boolean)
    );
  } catch {
    return {};
  }
}

function persistChannelStatesSnapshot(channelStates) {
  try {
    const serializable = Object.fromEntries(
      Object.entries(channelStates).map(([id, state]) => {
        const playlist = Array.isArray(state.playlist) ? state.playlist : [];
        const snapshot = getTimelineSnapshot(state);
        const windowStart = snapshot.itemIndex >= 0
          ? Math.max(0, snapshot.itemIndex - 5)
          : Math.max(0, playlist.length - 80);
        const removedDuration = playlist
          .slice(0, windowStart)
          .reduce((total, item) => total + (Number(item.dur) || 0), 0);

        return [id, {
          startedAt: state.startedAt + (removedDuration * 1000),
          playlist: playlist.slice(windowStart, windowStart + 80),
          recentPlayableKeys: Array.isArray(state.recentPlayableKeys)
            ? state.recentPlayableKeys.slice(0, 8)
            : [],
        }];
      })
    );
    localStorage.setItem(CHANNEL_STATES_KEY, JSON.stringify(serializable));
  } catch (error) {
    console.warn('[TV] Channel timeline save failed:', error);
  }
}

function getPlayableKey(item) {
  if (!item) return '';
  try {
    const urlObj = new URL(item.embedUrl);
    return `${urlObj.origin}${urlObj.pathname}`;
  } catch {
    return String(item.title || item.id || '').toLowerCase().trim();
  }
}

function isSamePlayableItem(a, b) {
  const aKey = getPlayableKey(a);
  const bKey = getPlayableKey(b);
  return Boolean(aKey && bKey && aKey === bKey);
}

async function fetchContentSafely(channel, options) {
  try {
    return await fetchChannelContent(channel, options);
  } catch (error) {
    if (import.meta.env.DEV && !options.signal?.aborted) console.warn('[TV] Catalog load failed:', error);
    return [];
  }
}

/* ─────────────────────────────────────────────────────
   MAIN APP COMPONENT
───────────────────────────────────────────────────── */
export default function App() {
  /* ── Refs ── */
  const canvasRef = useRef(null);
  const glitchRef = useRef(null);
  const hudTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const initialTimerRef = useRef(null);
  const sleepTimerRef = useRef(null);
  const sleepCountdownRef = useRef(null);
  const lastPersistRef = useRef(0);
  const playerRef = useRef(null);
  const contentRequestRef = useRef(null);
  const noiseRef = useRef(null);
  const currentProgressRef = useRef(null);
  const readinessProgressRef = useRef(null);
  const activePlaybackRef = useRef(null);
  const playerLoadStartedAtRef = useRef(0);
  const lastCompletionRef = useRef({ key: '', at: 0 });
  const [settingsSeed] = useState(loadSettingsSnapshot);
  const [channelStatesSeed] = useState(loadChannelStatesSnapshot);
  const settingsRef = useRef(settingsSeed.settings);
  const hasSavedSettingsRef = useRef(settingsSeed.hasSavedSettings);
  const audioUnlockedRef = useRef(false);
  const touchStartRef = useRef(null);

  /* ── Mutable state (not triggering re-render) via ref ── */
  const S = useRef({
    activeChannelIndex: 0,
    channelStates: channelStatesSeed, // { [ch.id]: { playlist, startedAt } }
    switchToken: 0,
    failChainCount: 0,
  });

  /* ── React state (triggers re-render) ── */
  const [statusText, setStatusText] = useState('SCANNING');
  const [statusVisible, setStatusVisible] = useState(true);
  const [hudFadeOut, setHudFadeOut] = useState(false);
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentEpTitle, setCurrentEpTitle] = useState('');
  const [currentLogoUrl, setCurrentLogoUrl] = useState(null);
  const [nextUp, setNextUp] = useState(null);
  const [activeChannelId, setActiveChannelId] = useState(CHANNELS[0]?.id ?? null);

  const [leftMenuOpen, setLeftMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [recentChannelIds, setRecentChannelIds] = useState(loadRecentChannelIds);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(null);
  const [sleepTimerDuration, setSleepTimerDuration] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastShow, setToastShow] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const [glitchBg, setGlitchBg] = useState('');
  const [isPoweredOff, setIsPoweredOff] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [settings, setSettings] = useState(settingsSeed.settings);
  const [playerReady, setPlayerReady] = useState(false);
  const [currentEmbedUrl, setCurrentEmbedUrl] = useState('');
  const [playerLoadKey, setPlayerLoadKey] = useState(0);
  const [activateUpdate, setActivateUpdate] = useState(null);

  /* ── Screen Wake Lock ── */
  useWakeLock(!isPoweredOff);

  useEffect(() => {
    settingsRef.current = settings;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('[TV] Settings save failed:', error);
    }
  }, [settings]);

  useEffect(() => {
    let applyingUpdate = false;
    const handleUpdateReady = (event) => {
      const activate = event.detail?.activate;
      if (typeof activate === 'function') setActivateUpdate(() => activate);
    };
    const handleControllerChange = () => {
      if (applyingUpdate) window.location.reload();
    };
    const applyUpdate = () => {
      applyingUpdate = true;
      activateUpdate?.();
    };

    window.addEventListener('broadcast-tv:update-ready', handleUpdateReady);
    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);
    window.broadcastTvApplyUpdate = applyUpdate;
    return () => {
      window.removeEventListener('broadcast-tv:update-ready', handleUpdateReady);
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
      delete window.broadcastTvApplyUpdate;
    };
  }, [activateUpdate]);

  useEffect(() => {
    const arClasses = ['ar-16-9', 'ar-4-3', 'ar-21-9', 'ar-fit', 'ar-full', 'ar-stretch'];
    document.body.classList.remove(...arClasses);
    if (settings.aspectRatio) document.body.classList.add(`ar-${settings.aspectRatio}`);
  }, [settings.aspectRatio]);

  useEffect(() => {
    const updateStretchScale = () => {
      const baseHeight = window.innerWidth * (9 / 16);
      const scaleY = baseHeight > 0 ? window.innerHeight / baseHeight : 1;
      document.documentElement.style.setProperty('--screen-stretch-y', String(scaleY));
    };
    updateStretchScale();
    window.addEventListener('resize', updateStretchScale);
    window.addEventListener('orientationchange', updateStretchScale);
    return () => {
      window.removeEventListener('resize', updateStretchScale);
      window.removeEventListener('orientationchange', updateStretchScale);
      document.documentElement.style.removeProperty('--screen-stretch-y');
    };
  }, []);

  useEffect(() => {
    // Apply theme class, preserving ar-* classes
    const arClass = [...document.body.classList].find(c => c.startsWith('ar-'));
    document.body.className = settings.theme;
    if (arClass) document.body.classList.add(arClass);
  }, [settings.theme]);


  const updateSetting = useCallback((key, value) => {
    hasSavedSettingsRef.current = true;
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isPlaybackMuted = useCallback(() => {
    return settingsRef.current.muted || !audioUnlockedRef.current;
  }, []);

  const postPlayerCommand = useCallback((func, args = '') => {
    const player = playerRef.current;
    if (!player || player.tagName !== 'IFRAME' || !player.contentWindow) return;
    try {
      player.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), new URL(player.src).origin);
    } catch { /* The embed may have been removed during a channel switch. */ }
  }, []);

  const rewriteCurrentEmbedAudio = useCallback((muted) => {
    const channel = CHANNELS[S.current.activeChannelIndex];
    const state = channel ? S.current.channelStates[channel.id] : null;
    const snapshot = getActivePlaybackSnapshot(state, activePlaybackRef.current);
    const reportedProgress = currentProgressRef.current;
    const resumeAt = Number.isFinite(reportedProgress) && reportedProgress >= 0
      ? reportedProgress
      : Math.max(0, Number(snapshot.resumeAt) || 0);

    const currentUrl = playerRef.current?.tagName === 'IFRAME' ? playerRef.current.src : '';
    if (!currentUrl) return;
    try {
        const urlObj = new URL(currentUrl);
        if (urlObj.searchParams.get('muted') === (muted ? '1' : '0')) return;
        urlObj.searchParams.set('autoplay', '1');
        urlObj.searchParams.set('muted', muted ? '1' : '0');
        urlObj.searchParams.set('resumeAt', String(Math.floor(resumeAt)));
        playerLoadStartedAtRef.current = Date.now();
        readinessProgressRef.current = null;
        setPlayerReady(false);
        noiseRef.current?.start();
        setStatusText('TUNING');
        setStatusVisible(true);
        setCurrentEmbedUrl(urlObj.toString());
      } catch (error) {
        console.warn('[TV] Failed to update iframe audio URL:', error);
      }
  }, []);

  const buildPlaybackUrl = useCallback((embedUrl, resumeAt = 0) => {
    try {
      const urlObj = new URL(embedUrl);
      if (resumeAt > 0) urlObj.searchParams.set('resumeAt', Math.floor(resumeAt));
      urlObj.searchParams.set('autoplay', '1');
      urlObj.searchParams.set('muted', isPlaybackMuted() ? '1' : '0');
      return urlObj.toString();
    } catch (error) {
      console.warn('[TV] Failed to parse embed URL:', error);
      return embedUrl;
    }
  }, [isPlaybackMuted]);

  const commitActiveProgress = useCallback(() => {
    persistChannelStatesSnapshot(S.current.channelStates);
  }, []);

  /* ── Toast helper ── */
  const showToast = useCallback((msg, ms = 2600) => {
    setToastMsg(msg);
    setToastShow(true);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastShow(false), ms);
  }, []);

  const unlockAudio = useCallback((forceUnmute = false) => {
    if (!audioUnlockedRef.current) {
      audioUnlockedRef.current = true;
      setAudioUnlocked(true);
    }

    if (forceUnmute || !hasSavedSettingsRef.current) {
      hasSavedSettingsRef.current = true;
      updateSetting('muted', false);
      postPlayerCommand('unMute');
      rewriteCurrentEmbedAudio(false);
      showToast('AUDIO REQUESTED');
    }
  }, [postPlayerCommand, rewriteCurrentEmbedAudio, showToast, updateSetting]);

  const handlePlayerShieldClick = useCallback(() => {
    if (!audioUnlockedRef.current || settingsRef.current.muted) {
      unlockAudio(true);
    }
  }, [unlockAudio]);

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
    clearTimeout(hudTimerRef.current);
    if (document.querySelector('.search-modal.open')) return;
    hudTimerRef.current = setTimeout(() => {
      setHudFadeOut(true);
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

  const recordRecentChannel = useCallback((channelId) => {
    if (channelId === 0) return;
    setRecentChannelIds((current) => {
      const next = [channelId, ...current.filter((id) => id !== channelId)].slice(0, 8);
      try {
        localStorage.setItem(RECENT_CHANNELS_KEY, JSON.stringify(next));
      } catch (error) {
        console.warn('[TV] Recent channels save failed:', error);
      }
      return next;
    });
  }, []);

  /* ── Switch channel ── */
  const switchTo = useCallback(async (index, options = {}) => {
    const s = S.current;
    const refreshItem = options?.refreshItem === true;
    const advanceItem = options?.advanceItem === true || options?.restartItem === true;
    const skipCommit = options?.skipCommit === true;
    if (!skipCommit) commitActiveProgress();

    // Wrap around index for infinite scrolling
    if (index < 0) index = (CHANNELS.length + (index % CHANNELS.length)) % CHANNELS.length;
    else index = index % CHANNELS.length;
    if (CHANNELS[index]?.id === 0) index = s.activeChannelIndex === 1 ? CHANNELS.length - 1 : 1;

    const previousPlayback = activePlaybackRef.current;
    activePlaybackRef.current = null;
    currentProgressRef.current = null;
    readinessProgressRef.current = null;
    setCurrentEmbedUrl('');
    setNextUp(null);

    s.switchToken++;
    const tok = s.switchToken;
    contentRequestRef.current?.abort();
    const contentController = new AbortController();
    contentRequestRef.current = contentController;

    flashGlitch();
    setStatus('TUNING');
    setPlayerReady(false);

    const channel = CHANNELS[index];
    s.activeChannelIndex = index;
    setActiveChannelId(channel.id);
    recordRecentChannel(channel.id);

    // Save to local storage for persistent session
    try {
      localStorage.setItem('ytTV_lastChannel', index);
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[TV] Last channel save failed:', error);
    }

    // Initialize continuous timeline state for this channel if missing
    if (!s.channelStates[channel.id]) {
      s.channelStates[channel.id] = {
        playlist: [],
        startedAt: Date.now(),
        recentPlayableKeys: [],
      };
    }

    const state = s.channelStates[channel.id];
    let snapshot = getTimelineSnapshot(state);
    let currentItem = snapshot.currentItem;
    let resumeAt = snapshot.resumeAt;
    let completedItem = null;

    if (refreshItem) {
      setStatus('SCANNING');
      const previousItem = currentItem;
      const newItems = await fetchContentSafely(channel, {
        afterItem: previousItem,
        signal: contentController.signal,
      });
      if (tok !== s.switchToken) return;

      if (newItems?.length) {
        const previousKey = getPlayableKey(previousItem);
        state.recentPlayableKeys = [
          previousKey,
          ...(state.recentPlayableKeys || []).filter((key) => key !== previousKey),
        ].filter(Boolean).slice(0, 8);
        state.playlist = moveFreshItemFirst(
          newItems,
          previousItem,
          state.recentPlayableKeys,
          isSamePlayableItem,
          getPlayableKey,
        );
        state.startedAt = Date.now() - (getRandomStartOffset(state.playlist[0]) * 1000);
        snapshot = getTimelineSnapshot(state);
        currentItem = snapshot.currentItem;
        resumeAt = snapshot.resumeAt;
        persistChannelStatesSnapshot(s.channelStates);
      }
    }

    if (advanceItem) {
      const endedSnapshot = getActivePlaybackSnapshot(state, previousPlayback);
      const itemToAdvance = endedSnapshot.currentItem ? endedSnapshot : snapshot;
      if (itemToAdvance.currentItem) {
        completedItem = itemToAdvance.currentItem;
        const nextStart = itemToAdvance.accumulatedBefore + (Number(itemToAdvance.currentItem.dur) || 0);
        state.startedAt = Date.now() - (nextStart * 1000);
        activePlaybackRef.current = null;
        currentProgressRef.current = null;
        snapshot = getTimelineSnapshot(state);
        currentItem = snapshot.currentItem;
        resumeAt = snapshot.resumeAt;
        persistChannelStatesSnapshot(s.channelStates);
      }
    }

    let duplicateSkipCount = 0;
    while (advanceItem && completedItem && currentItem && isSamePlayableItem(currentItem, completedItem) && duplicateSkipCount < 20) {
      duplicateSkipCount++;
      const nextStart = snapshot.accumulatedBefore + (Number(currentItem.dur) || 0);
      state.startedAt = Date.now() - (nextStart * 1000);
      activePlaybackRef.current = null;
      currentProgressRef.current = null;
      snapshot = getTimelineSnapshot(state);
      currentItem = snapshot.currentItem;
      resumeAt = snapshot.resumeAt;
      persistChannelStatesSnapshot(s.channelStates);
    }

    let fetchAttempts = 0;
    while (!currentItem && !refreshItem && fetchAttempts < 8) {
      fetchAttempts++;
      setStatus('SCANNING');
      const afterItem = advanceItem ? completedItem : state.playlist.at(-1);
      const newItems = await fetchContentSafely(channel, {
        afterItem,
        signal: contentController.signal,
      });
      if (tok !== s.switchToken) return;

      if (!newItems?.length) break;

      const playableItems = advanceItem && completedItem
        ? newItems.filter((item) => !isSamePlayableItem(item, completedItem))
        : newItems;
      if (!playableItems.length) continue;

      if (advanceItem && state.playlist.length && snapshot.totalDuration > 0) {
        state.startedAt = Date.now() - (snapshot.totalDuration * 1000);
      }

      if (!state.playlist.length) {
        state.startedAt = Date.now() - ((advanceItem ? 0 : getRandomStartOffset(playableItems[0])) * 1000);
      }
      state.playlist.push(...playableItems);
      snapshot = getTimelineSnapshot(state);
      currentItem = snapshot.currentItem;
      resumeAt = snapshot.resumeAt;
      persistChannelStatesSnapshot(s.channelStates);
    }

    if (!currentItem && !advanceItem && state.playlist.length && snapshot.totalDuration > 0) {
      state.startedAt = Date.now() - ((snapshot.elapsed % snapshot.totalDuration) * 1000);
      snapshot = getTimelineSnapshot(state);
      currentItem = snapshot.currentItem;
      resumeAt = snapshot.resumeAt;
      persistChannelStatesSnapshot(s.channelStates);
    }

    if (!currentItem) {
      s.failChainCount++;
      setStatus('NO SIGNAL');
      return;
    }

    if (currentItem.embedUrl) {
      // Keep only a small amount of past programming in memory as well as storage.
      if (snapshot.itemIndex > 5) {
        const removeCount = snapshot.itemIndex - 5;
        const removedDuration = state.playlist.slice(0, removeCount)
          .reduce((total, item) => total + (Number(item.dur) || 0), 0);
        state.playlist = state.playlist.slice(removeCount);
        state.startedAt += removedDuration * 1000;
        snapshot = getTimelineSnapshot(state);
      }
      currentProgressRef.current = null;
      activePlaybackRef.current = { channelId: channel.id, itemId: currentItem.id, itemIndex: snapshot.itemIndex, resumeAt };
      setCurrentTitle(currentItem.title);
      setCurrentEpTitle(currentItem.epTitle || '');
      setCurrentLogoUrl(getPlayableLogoUrl(currentItem));
      const finalEmbedUrl = buildPlaybackUrl(currentItem.embedUrl, resumeAt);
      playerLoadStartedAtRef.current = Date.now();
      setPlayerLoadKey((key) => key + 1);
      setCurrentEmbedUrl(finalEmbedUrl);

    }
  }, [buildPlaybackUrl, commitActiveProgress, flashGlitch, recordRecentChannel, setStatus]);

  /* ── Initial Load Logic ── */
  useEffect(() => {
    let saved = null;
    try { saved = localStorage.getItem('ytTV_lastChannel'); } catch { /* Storage can be unavailable. */ }
    let startIndex = 0;
    const savedIndex = saved !== null && !isNaN(saved) ? parseInt(saved, 10) : null;
    if (savedIndex !== null && CHANNELS[savedIndex] && CHANNELS[savedIndex].id !== 0) {
      startIndex = savedIndex;
    } else {
      // First-time visitors always start on a real playable channel.
      startIndex = getRandomPlayableChannelIndex();
    }

    // Ensure index is within bounds
    startIndex = Math.max(0, Math.min(startIndex, CHANNELS.length - 1));

    // Slight delay to let noise canvas initialize
    initialTimerRef.current = setTimeout(() => {
      switchTo(startIndex, 'forward');
    }, 100);
    return () => clearTimeout(initialTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Handle channel failure ── */
  const handleChannelFailure = useCallback(() => {
    const s = S.current;
    s.failChainCount++;
    if (s.failChainCount <= 3) {
      showToast('RECOVERING SIGNAL');
      switchTo(s.activeChannelIndex, { refreshItem: true, skipCommit: true });
      return;
    }
    showToast('SWITCHING FROM WEAK SIGNAL');
    s.failChainCount = 0;
    switchTo(s.activeChannelIndex + 1);
  }, [showToast, switchTo]);

  // HTML5 Video Handlers
  const handlePlay = useCallback(() => {
    S.current.failChainCount = 0;
    setPlayerReady(true);
    clearStatusFn();
  }, [clearStatusFn]);

  const handlePlayerLoad = useCallback(() => {
    // An iframe document loading is not evidence that its video is playing.
    playerLoadStartedAtRef.current = Date.now();
  }, []);

  const skipCurrentVideo = useCallback(() => {
    const s = S.current;
    switchTo(s.activeChannelIndex, { refreshItem: true });
  }, [switchTo]);

  const handleEnded = useCallback(() => {
    const s = S.current;
    const now = Date.now();
    if (now - playerLoadStartedAtRef.current < COMPLETION_LOAD_GRACE_MS) return;

    const activePlayback = activePlaybackRef.current;
    const channel = CHANNELS[s.activeChannelIndex];
    if (!activePlayback || !channel || activePlayback.channelId !== channel.id) return;

    const completionKey = activePlayback?.itemId
      ? `${activePlayback.channelId}:${activePlayback.itemId}`
      : `channel:${s.activeChannelIndex}`;

    if (
      lastCompletionRef.current.key === completionKey &&
      now - lastCompletionRef.current.at < COMPLETION_LOAD_GRACE_MS
    ) {
      return;
    }

    lastCompletionRef.current = { key: completionKey, at: now };
    switchTo(s.activeChannelIndex, { advanceItem: true, skipCommit: true });
  }, [switchTo]);

  const handleError = useCallback(() => {
    handleChannelFailure();
  }, [handleChannelFailure]);

  useEffect(() => {
    if (isPoweredOff || !currentEmbedUrl || playerReady) return;
    // Iframe onError does not reliably report media failures inside the embed.
    const token = S.current.switchToken;
    const timeout = setTimeout(() => {
      if (token === S.current.switchToken) handleChannelFailure();
    }, 25_000);
    return () => clearTimeout(timeout);
  }, [currentEmbedUrl, handleChannelFailure, isPoweredOff, playerLoadKey, playerReady]);

  useEffect(() => {
    const player = playerRef.current;
    const muted = isPlaybackMuted();

    if (player?.tagName === 'VIDEO') {
      player.muted = muted;
      if (!isPoweredOff) player.play?.().catch(() => undefined);
    } else if (player?.tagName === 'IFRAME') {
      postPlayerCommand(muted ? 'mute' : 'unMute');
    }
  }, [audioUnlocked, isPlaybackMuted, isPoweredOff, postPlayerCommand, settings.muted]);

  const handleTouchStart = useCallback((event) => {
    const touch = event.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((event) => {
    if (!touchStartRef.current) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) < 46 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return;
    switchTo(S.current.activeChannelIndex + (deltaX < 0 ? 1 : -1));
  }, [switchTo]);

  // Listen for iframe player events via postMessage
  useEffect(() => {
    function handleMessage(e) {
      const player = playerRef.current;
      if (
        !player ||
        player.tagName !== 'IFRAME' ||
        !player.contentWindow ||
        e.source !== player.contentWindow
      ) {
        return;
      }

      try {
        if (e.origin !== new URL(player.src).origin) return;
      } catch {
        return;
      }

      if (e.data?.type === 'MEDIA_NOT_FOUND') {
        handleChannelFailure();
        return;
      }
      const eventPayload = readPlayerEventPayload(e.data);

      if (eventPayload) {
        const { player_status, player_progress, player_duration } = eventPayload;
        const progressSeconds = readProgressSeconds(player_progress);
        const reportedDuration = normalizeDurationSeconds(player_duration)
          ?? readProgressDurationSeconds(player_progress);
        const activePlayback = activePlaybackRef.current;
        const channel = CHANNELS[S.current.activeChannelIndex];
        const hasCompletionStatus = isCompletionStatus(player_status);

        if (
          !activePlayback ||
          !channel ||
          activePlayback.channelId !== channel.id
        ) {
          return;
        }

        let reachedTrustedEnd = false;
        const s = S.current;
        const activeChannel = CHANNELS[s.activeChannelIndex];
        const state = activeChannel ? s.channelStates[activeChannel.id] : null;
        let snapshot = getActivePlaybackSnapshot(state, activePlaybackRef.current);
        if (progressSeconds !== null) alignTimelineToProgress(state, snapshot, progressSeconds);
        const durationChanged = syncReportedDuration(state, snapshot, reportedDuration);
        if (durationChanged) {
          snapshot = getActivePlaybackSnapshot(state, activePlaybackRef.current);
          lastPersistRef.current = Date.now();
          persistChannelStatesSnapshot(s.channelStates);
        }

        if (progressSeconds !== null && progressSeconds >= 0) {
          currentProgressRef.current = progressSeconds;
          if (snapshot.currentItem) {
            if (durationChanged || Date.now() - lastPersistRef.current > 5000) {
              lastPersistRef.current = Date.now();
              persistChannelStatesSnapshot(s.channelStates);
            }
            reachedTrustedEnd =
              reportedDuration !== null &&
              progressSeconds >= Math.max(0, reportedDuration - TRUSTED_END_EPSILON_SECONDS);
          }
        }
        if (isPlayingStatus(player_status) && progressSeconds !== null) {
          if (hasPlaybackAdvanced(readinessProgressRef.current, progressSeconds)) handlePlay();
          readinessProgressRef.current = progressSeconds;
        }
        if (hasCompletionStatus || reachedTrustedEnd) handleEnded();
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handlePlay, handleEnded, handleChannelFailure]);


  /* ── Open / Close Settings Menu ── */
  const openSettingsMenu = useCallback(() => {
    setSettingsMenuOpen(true);
    setLeftMenuOpen(false);
    setHudFadeOut(false);
    clearTimeout(hudTimerRef.current);
  }, []);
  const closeSettingsMenu = useCallback(() => {
    setSettingsMenuOpen(false);
    resetHudIdle();
  }, [resetHudIdle]);
  const backToMainMenu = useCallback(() => {
    setSettingsMenuOpen(false);
    setLeftMenuOpen(true);
    setHudFadeOut(false);
    clearTimeout(hudTimerRef.current);
  }, []);

  const toggleLeftMenu = useCallback(() => {
    setLeftMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setHudFadeOut(false);
        clearTimeout(hudTimerRef.current);
      } else {
        resetHudIdle();
      }
      return next;
    });
  }, [resetHudIdle]);

  const handleSelectChannel = useCallback((id) => {
    const index = CHANNELS.findIndex(ch => ch.id === id);
    if (index !== -1) {
      setLeftMenuOpen(false);
      switchTo(index, 'forward');
    }
  }, [switchTo]);

  /* ── Fullscreen toggle ── */
  useEffect(() => {
    const checkFullscreenSupport = () => {
      const supportsFS = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
      if (supportsFS) document.body.classList.add('supports-fs');
    };
    checkFullscreenSupport();

    const handleFullscreenChange = () => {
      const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (isFS) {
        document.body.classList.add('is-fs');
      } else {
        document.body.classList.remove('is-fs');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.().catch(() => { });
    } else {
      await document.exitFullscreen?.().catch(() => { });
    }
  }, []);

  /* ── Theme cycling ── */
  const cycleTheme = useCallback(() => {
    const currentIndex = THEMES.indexOf(settingsRef.current.theme);
    const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];
    updateSetting('theme', nextTheme);
    showToast(nextTheme ? nextTheme.replace('theme-', '').toUpperCase() : 'CLASSIC', 1200);
  }, [showToast, updateSetting]);

  /* ── Wake from sleep timer ── */
  const wakePower = useCallback(() => {
    setIsPoweredOff(false);
    switchTo(S.current.activeChannelIndex);
  }, [switchTo]);

  const scheduleSleepTimer = useCallback((minutes) => {
    clearTimeout(sleepTimerRef.current);
    clearInterval(sleepCountdownRef.current);
    const endsAt = Date.now() + (minutes * 60 * 1000);
    setSleepTimerDuration(minutes);
    setSleepTimerMinutes(minutes);
    sleepCountdownRef.current = setInterval(() => {
      const remaining = Math.max(1, Math.ceil((endsAt - Date.now()) / 60_000));
      setSleepTimerMinutes(remaining);
    }, 30_000);
    sleepTimerRef.current = setTimeout(() => {
      sleepTimerRef.current = null;
      clearInterval(sleepCountdownRef.current);
      sleepCountdownRef.current = null;
      setSleepTimerMinutes(null);
      setSleepTimerDuration(null);
      S.current.switchToken++;
      contentRequestRef.current?.abort();
      activePlaybackRef.current = null;
      setCurrentEmbedUrl('');
      if (playerRef.current?.tagName === 'VIDEO') playerRef.current.pause();
      setLeftMenuOpen(false);
      setSettingsMenuOpen(false);
      setIsPoweredOff(true);
      if (noiseRef.current) noiseRef.current.stop();
    }, minutes * 60 * 1000);
    showToast(`SLEEP TIMER ${minutes} MIN`, 1800);
  }, [showToast]);

  const cancelSleepTimer = useCallback(() => {
    clearTimeout(sleepTimerRef.current);
    clearInterval(sleepCountdownRef.current);
    sleepTimerRef.current = null;
    sleepCountdownRef.current = null;
    setSleepTimerMinutes(null);
    setSleepTimerDuration(null);
    showToast('SLEEP TIMER REMOVED', 1800);
  }, [showToast]);

  const gamepadNextChannel = useCallback(() => {
    switchTo(S.current.activeChannelIndex + 1);
  }, [switchTo]);

  const gamepadPreviousChannel = useCallback(() => {
    switchTo(S.current.activeChannelIndex - 1);
  }, [switchTo]);

  const closeActiveMenu = useCallback(() => {
    if (settingsMenuOpen) closeSettingsMenu();
    else if (leftMenuOpen) setLeftMenuOpen(false);
  }, [closeSettingsMenu, leftMenuOpen, settingsMenuOpen]);

  const toggleMenuFromController = useCallback(() => {
    if (settingsMenuOpen) closeSettingsMenu();
    else toggleLeftMenu();
  }, [closeSettingsMenu, settingsMenuOpen, toggleLeftMenu]);

  useGamepadNavigation({
    disabled: isPoweredOff,
    menuOpen: leftMenuOpen || settingsMenuOpen,
    onNextChannel: gamepadNextChannel,
    onPreviousChannel: gamepadPreviousChannel,
    onFullscreen: toggleFullscreen,
    onRefresh: skipCurrentVideo,
    onToggleMenu: toggleMenuFromController,
    onBack: closeActiveMenu,
  });

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    function onKeyDown(e) {
      if (isPoweredOff) return;
      if (settingsMenuOpen || leftMenuOpen) {
        return;
      }
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      )
        return;

      const s = S.current;

      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        cycleTheme();
      } else if (e.key === '/' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        openSettingsMenu();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        switchTo(s.activeChannelIndex + 1, 'forward');
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        switchTo(s.activeChannelIndex - 1, 'back');
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isPoweredOff, leftMenuOpen, settingsMenuOpen, openSettingsMenu, switchTo, cycleTheme, toggleFullscreen]);

  /* ── Time & Title Tracker ── */
  useEffect(() => {
    const interval = setInterval(() => {
      const s = S.current;
      const channel = CHANNELS[s.activeChannelIndex];
      if (!channel) return;
      const state = s.channelStates[channel.id];
      if (isPoweredOff || activePlaybackRef.current?.channelId !== channel.id) return;
      const snapshot = getActivePlaybackSnapshot(state, activePlaybackRef.current);
      const currentItem = snapshot.currentItem;
      if (!currentItem) {
        setNextUp(null);
        return;
      }

      setCurrentTitle(currentItem.title);
      setCurrentEpTitle(currentItem.epTitle || '');
      setCurrentLogoUrl(getPlayableLogoUrl(currentItem));
      const nextItem = state?.playlist?.[snapshot.itemIndex + 1] || null;
      const nextValue = nextItem ? {
        id: nextItem.id,
        title: nextItem.title,
        epTitle: nextItem.epTitle || '',
        logoUrl: getPlayableLogoUrl(nextItem),
      } : null;
      setNextUp((current) => {
        if (!current && !nextValue) return current;
        if (
          current?.id === nextValue?.id &&
          current?.title === nextValue?.title &&
          current?.epTitle === nextValue?.epTitle &&
          current?.logoUrl === nextValue?.logoUrl
        ) {
          return current;
        }
        return nextValue;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPoweredOff]);

  useEffect(() => {
    const persistCurrentTimeline = () => {
      commitActiveProgress();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') persistCurrentTimeline();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', persistCurrentTimeline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', persistCurrentTimeline);
      persistCurrentTimeline();
    };
  }, [commitActiveProgress]);

  useEffect(() => {
    return () => {
      clearTimeout(toastTimerRef.current);
      clearTimeout(initialTimerRef.current);
      clearTimeout(sleepTimerRef.current);
      clearInterval(sleepCountdownRef.current);
      contentRequestRef.current?.abort();
    };
  }, []);

  /* ── JSX ── */
  const effectiveMuted = settings.muted || !audioUnlocked;

  return (
    <>
      <div className="landscape-fs-prompt">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '320px' }}>
          <div style={{ marginBottom: '32px', lineHeight: '1.8' }}>
            Please return to fullscreen mode for the best experience.
          </div>
          <button className="tilt-fullscreen-btn" onClick={toggleFullscreen}>
            ENTER FULLSCREEN
          </button>
        </div>
      </div>
      <div className="tilt-prompt">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '320px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
          <div style={{ marginBottom: '32px', lineHeight: '1.8' }}>
            To hide the browser bar, please fullscreen the app before rotating your device.
          </div>
          <button className="tilt-fullscreen-btn" onClick={toggleFullscreen}>
            FULLSCREEN
          </button>
        </div>
      </div>
      <div
        className={`app${isPoweredOff ? ' power-off' : ''}`}
        onTouchStart={isPoweredOff ? undefined : handleTouchStart}
        onTouchEnd={isPoweredOff ? undefined : handleTouchEnd}
      >
        <PlayerStage
        playerRef={playerRef}
        playerKey={playerLoadKey}
        onPlay={handlePlay}
        onEnded={handleEnded}
        onError={handleError}
        onLoad={handlePlayerLoad}
        embedUrl={isPoweredOff ? '' : currentEmbedUrl}
        isMuted={effectiveMuted}
        playerReady={playerReady}
        onShieldClick={handlePlayerShieldClick}
      />

      <Overlays
        canvasRef={canvasRef}
        scanlinesEnabled={settings.scanlines}
        vignetteEnabled={settings.vignette}
        glitchRef={glitchRef}
        glitchActive={glitchActive}
        glitchBg={glitchBg}
        statusVisible={statusVisible}
        statusText={statusText}
        toastShow={toastShow}
        toastMsg={toastMsg}
        audioUnlocked={audioUnlocked}
        updateAvailable={Boolean(activateUpdate)}
        onApplyUpdate={() => window.broadcastTvApplyUpdate?.()}
      />

      <HUD
        hudFadeOut={hudFadeOut && !leftMenuOpen && !settingsMenuOpen}
        showTitle={currentTitle}
        epTitle={currentEpTitle}
        logoUrl={settings.logoMode !== false ? currentLogoUrl : null}
        nextUp={nextUp}
        upNextMode={settings.upNextMode || 'with-hud'}

        switchToNext={() => switchTo(S.current.activeChannelIndex + 1)}
        switchToPrev={() => switchTo(S.current.activeChannelIndex - 1)}
        toggleFullscreen={toggleFullscreen}
        refreshVideo={skipCurrentVideo}
        leftMenuOpen={leftMenuOpen || settingsMenuOpen}
        toggleLeftMenu={toggleLeftMenu}
      />

      <MenuOverlay
        isOpen={leftMenuOpen || settingsMenuOpen}
        page={settingsMenuOpen ? 'settings' : 'channels'}
        onClose={closeActiveMenu}
        channelPage={<LeftMenu
        isOpen={leftMenuOpen || settingsMenuOpen}
        onClose={() => setLeftMenuOpen(false)}
        channels={CHANNELS}
        activeChannelId={activeChannelId}
        onSelect={handleSelectChannel}
        openSettings={openSettingsMenu}
        recentChannelIds={recentChannelIds}
        sleepTimerMinutes={sleepTimerMinutes}
        sleepTimerDuration={sleepTimerDuration}
        onSetSleepTimer={scheduleSleepTimer}
        onCancelSleepTimer={cancelSleepTimer}
      />}
        settingsPage={<SettingsMenu
        key={settingsMenuOpen ? 'settings-open' : 'settings-closed'}
        isOpen={settingsMenuOpen}
        onClose={closeSettingsMenu}
        onBackToMenu={backToMainMenu}
        settings={settings}
        updateSetting={updateSetting}
        themes={THEMES}
      />}
      />
      {isPoweredOff && (
        <div className="power-off-screen">
          <button className="power-on-button" type="button" onClick={wakePower} aria-label="Power on TV">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2v10" />
              <path d="M6.35 5.65a8 8 0 1 0 11.3 0" />
            </svg>
          </button>
        </div>
      )}
    </div>
    </>
  );
}
