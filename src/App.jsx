import { useRef, useState, useEffect, useCallback } from 'react';

import { createNoiseController } from './components/NoiseCanvasController';
import { useWakeLock } from './hooks/useWakeLock';
import PlayerStage from './components/PlayerStage';
import HUD from './components/HUD';
import SettingsMenu from './components/SettingsMenu';
import LeftMenu from './components/LeftMenu';
import Overlays from './components/Overlays';

import { CHANNELS } from './constants/channels';
import { fetchChannelContent } from './api/channels';

const SETTINGS_KEY = 'broadcastTV_settings';
const CHANNEL_STATES_KEY = 'broadcastTV_channelStates_v10';
const THEMES = ['', 'theme-green', 'theme-amber', 'theme-bw', 'theme-blue', 'theme-purple', 'theme-red', 'theme-cyan'];
const MIN_REPORTED_DURATION_SECONDS = 300;
const MAX_REPORTED_DURATION_SECONDS = 12 * 60 * 60;
const COMPLETION_LOAD_GRACE_MS = 3000;
const TRUSTED_END_EPSILON_SECONDS = 0.5;
const TRUSTED_TIMELINE_CATCHUP_SECONDS = 1;
const DEFAULT_SETTINGS = {
  overlayOpacity: 0.88,
  scanlines: true,
  vignette: true,
  theme: '',
  muted: true,
  logoMode: true,
  aspectRatio: '16-9',
};

function loadSettingsSnapshot() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { settings: DEFAULT_SETTINGS, hasSavedSettings: false };
    return {
      settings: { ...DEFAULT_SETTINGS, ...JSON.parse(raw) },
      hasSavedSettings: true,
    };
  } catch {
    return { settings: DEFAULT_SETTINGS, hasSavedSettings: false };
  }
}

function getRandomStartOffset(item) {
  if (item.dur >= 5400) {
    return Math.floor(Math.random() * (1500 - 900 + 1) + 900);
  }
  return Math.floor(Math.random() * (600 - 180 + 1) + 180);
}

function loadChannelStatesSnapshot() {
  try {
    const raw = localStorage.getItem(CHANNEL_STATES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const isOldNoSignalFallback = (item) => {
      return (
        item?.title?.startsWith?.('No Signal') ||
        item?.id?.startsWith?.('fallback-') ||
        item?.embedUrl?.includes?.('tt0468569')
      );
    };
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([id, state]) => {
          const playlistSource = Array.isArray(state.playlist)
            ? state.playlist
            : state.lockedItem
              ? [state.lockedItem]
              : [];
          const playlist = playlistSource.filter((item) => !isOldNoSignalFallback(item));
          if (!playlist.length) return null;
          return [id, {
            playlist,
            startedAt: Number.isFinite(Number(state.startedAt)) ? Number(state.startedAt) : Date.now(),
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
      Object.entries(channelStates).map(([id, state]) => [
        id,
        {
          startedAt: state.startedAt,
          playlist: Array.isArray(state.playlist) ? state.playlist.slice(0, 40) : [],
        },
      ])
    );
    localStorage.setItem(CHANNEL_STATES_KEY, JSON.stringify(serializable));
  } catch (error) {
    console.warn('[TV] Channel timeline save failed:', error);
  }
}

function getTimelineSnapshot(state) {
  if (!state?.playlist?.length) {
    return {
      currentItem: null,
      resumeAt: 0,
      elapsed: 0,
      accumulatedBefore: 0,
      totalDuration: 0,
    };
  }

  const elapsed = Math.max(0, (Date.now() - state.startedAt) / 1000);
  let accumulated = 0;

  for (let i = 0; i < state.playlist.length; i++) {
    const item = state.playlist[i];
    const dur = Number(item.dur) || 0;
    if (dur <= 0) continue;
    if (elapsed < accumulated + dur) {
      return {
        currentItem: item,
        resumeAt: elapsed - accumulated,
        elapsed,
        accumulatedBefore: accumulated,
        itemIndex: i,
        totalDuration: accumulated + dur,
      };
    }
    accumulated += dur;
  }

  return {
    currentItem: null,
    resumeAt: Math.max(0, elapsed - accumulated),
    elapsed,
    accumulatedBefore: accumulated,
    itemIndex: -1,
    totalDuration: accumulated,
  };
}

function getActivePlaybackSnapshot(state, activePlayback) {
  if (!activePlayback?.itemId || !state?.playlist?.length) {
    return getTimelineSnapshot(state);
  }

  const elapsed = Math.max(0, (Date.now() - state.startedAt) / 1000);
  let accumulated = 0;

  for (let i = 0; i < state.playlist.length; i++) {
    const item = state.playlist[i];
    const dur = Number(item.dur) || 0;
    if (item.id === activePlayback.itemId) {
      return {
        currentItem: item,
        resumeAt: Math.max(0, elapsed - accumulated),
        elapsed,
        accumulatedBefore: accumulated,
        itemIndex: i,
        totalDuration: accumulated + dur,
      };
    }
    if (dur > 0) accumulated += dur;
  }

  return getTimelineSnapshot(state);
}

function parseSecondsValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d+(?::\d{1,2}){1,2}(?:\.\d+)?$/.test(trimmed)) {
    const parts = trimmed.split(':').map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return null;
    return parts.reduce((total, part) => (total * 60) + part, 0);
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeProgressSeconds(value) {
  if (!Number.isFinite(value) || value < 0) return null;
  return value > MAX_REPORTED_DURATION_SECONDS ? value / 1000 : value;
}

function readProgressSeconds(progress) {
  const directSeconds = parseSecondsValue(progress);
  if (directSeconds !== null) return normalizeProgressSeconds(directSeconds);

  if (!progress || typeof progress !== 'object') return null;
  if (
    Number.isFinite(Number(progress.played)) &&
    Number(progress.played) > 0 &&
    Number(progress.played) <= 1 &&
    normalizeDurationSeconds(progress.duration) !== null
  ) {
    return Number(progress.played) * normalizeDurationSeconds(progress.duration);
  }

  const candidates = [
    progress.currentTime,
    progress.current_time,
    progress.current,
    progress.position,
    progress.seconds,
    progress.time,
    progress.elapsed,
    progress.currentTimeText,
    progress.current_time_text,
    progress.positionText,
    Number(progress.played) > 1 ? progress.played : undefined,
  ];
  const found = candidates.map(parseSecondsValue).find((value) => value !== null);
  return found === undefined ? null : normalizeProgressSeconds(found);
}

function normalizeDurationSeconds(value) {
  const duration = parseSecondsValue(value);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const seconds = duration > MAX_REPORTED_DURATION_SECONDS
    ? duration / 1000
    : duration;
  if (
    !Number.isFinite(seconds) ||
    seconds < MIN_REPORTED_DURATION_SECONDS ||
    seconds > MAX_REPORTED_DURATION_SECONDS
  ) {
    return null;
  }
  return Math.round(seconds);
}

function readProgressDurationSeconds(progress) {
  if (!progress || typeof progress !== 'object') return null;

  const candidates = [
    progress.duration,
    progress.dur,
    progress.totalDuration,
    progress.total_duration,
    progress.length,
    progress.total,
    progress.totalTime,
    progress.total_time,
    progress.durationText,
    progress.duration_text,
    progress.lengthText,
  ];
  const found = candidates.find((value) => normalizeDurationSeconds(value) !== null);
  return found === undefined ? null : normalizeDurationSeconds(found);
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizePlayerStatus(value) {
  if (value === 0 || value === '0') return 'ended';
  if (value === 1 || value === '1') return 'playing';
  if (value === 2 || value === '2') return 'paused';
  return String(value || '').toLowerCase().trim();
}

function isPlayingStatus(status) {
  return status === 'playing' || status === 'play';
}

function isCompletionStatus(status) {
  return [
    'completed',
    'complete',
    'ended',
    'end',
    'finished',
    'finish',
  ].includes(status);
}

function hasProgressShape(value) {
  if (!value || typeof value !== 'object') return false;
  return [
    'currentTime',
    'current_time',
    'current',
    'position',
    'seconds',
    'time',
    'played',
    'duration',
    'dur',
    'totalDuration',
    'total_duration',
    'length',
  ].some((key) => value[key] !== undefined);
}

function readPlayerEventPayload(message) {
  const parsed = parseMaybeJson(message);
  if (!parsed || typeof parsed !== 'object') return null;

  const candidates = [
    parsed,
    parseMaybeJson(parsed.data),
    parseMaybeJson(parsed.detail),
    parseMaybeJson(parsed.payload),
  ].filter((item) => item && typeof item === 'object');

  for (const candidate of candidates) {
    const progress = candidate.player_progress ?? candidate.progress ?? candidate.currentProgress;
    const eventName = normalizePlayerStatus(candidate.type ?? candidate.event ?? candidate.name);
    const isPlayerEvent = eventName.includes('player') || eventName.includes('playback');
    const eventStatus = isPlayingStatus(eventName) || isCompletionStatus(eventName) ? eventName : undefined;
    const status = candidate.player_status ?? candidate.status ?? candidate.state ?? candidate.playerState ?? eventStatus;

    if (status !== undefined || progress !== undefined || hasProgressShape(candidate)) {
      return {
        player_status: normalizePlayerStatus(status),
        player_progress: progress ?? candidate,
      };
    }

    if (isPlayerEvent && candidate.data && typeof candidate.data === 'object') {
      const nested = readPlayerEventPayload(candidate.data);
      if (nested) return nested;
    }
  }

  return null;
}

function syncReportedDuration(state, snapshot, reportedDuration) {
  const duration = normalizeDurationSeconds(reportedDuration);
  const index = snapshot?.itemIndex;
  if (
    duration === null ||
    !state?.playlist?.length ||
    index == null ||
    index < 0 ||
    index >= state.playlist.length
  ) {
    return false;
  }

  const currentItem = state.playlist[index];
  const currentDuration = Number(currentItem.dur) || 0;
  if (Math.abs(currentDuration - duration) < 2 && currentItem.durationTrusted) return false;

  state.playlist = state.playlist.map((item, itemIndex) => (
    itemIndex === index ? { ...item, dur: duration, durationTrusted: true } : item
  ));
  return true;
}

function getDisplayProgressSeconds(snapshot, activePlayback, playerProgress) {
  const duration = Number(snapshot?.currentItem?.dur) || 0;
  const initialProgress = Number(activePlayback?.resumeAt);
  const progress = Number.isFinite(playerProgress)
    ? playerProgress
    : Number.isFinite(initialProgress)
      ? initialProgress
      : snapshot?.resumeAt;
  const seconds = Number.isFinite(Number(progress)) ? Number(progress) : 0;
  return duration > 0 ? Math.min(Math.max(0, seconds), duration) : Math.max(0, seconds);
}

function formatTime(secs) {
  const s = Math.floor(Math.max(0, secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  if (h > 0) return `${h}:${m}:${sec}`;
  return `${m}:${sec}`;
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

/* ─────────────────────────────────────────────────────
   MAIN APP COMPONENT
───────────────────────────────────────────────────── */
export default function App() {
  /* ── Refs ── */
  const canvasRef = useRef(null);
  const glitchRef = useRef(null);
  const hudTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const promptTimerRef = useRef(null);
  const initialTimerRef = useRef(null);
  const lastPersistRef = useRef(0);
  const playerRef = useRef(null);
  const noiseRef = useRef(null);
  const currentProgressRef = useRef(null);
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
  const [networkFadeOut, setNetworkFadeOut] = useState(false);
  const [networkActive, setNetworkActive] = useState(false);
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentEpTitle, setCurrentEpTitle] = useState('');
  const [currentLogoUrl, setCurrentLogoUrl] = useState(null);
  const [playbackTimeStr, setPlaybackTimeStr] = useState('');

  const [leftMenuOpen, setLeftMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [channelLabel, setChannelLabel] = useState('CH 1');
  const [toastMsg, setToastMsg] = useState('');
  const [toastShow, setToastShow] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const [glitchBg, setGlitchBg] = useState('');
  const [isPoweredOff, setIsPoweredOff] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [settings, setSettings] = useState(settingsSeed.settings);
  const [playPromptVisible, setPlayPromptVisible] = useState(false);
  const [currentEmbedUrl, setCurrentEmbedUrl] = useState('');
  const [playerLoadKey, setPlayerLoadKey] = useState(0);

  /* ── Screen Wake Lock ── */
  useWakeLock();

  useEffect(() => {
    settingsRef.current = settings;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('[TV] Settings save failed:', error);
    }
  }, [settings]);

  useEffect(() => {
    const arClasses = ['ar-16-9', 'ar-4-3', 'ar-21-9', 'ar-full'];
    document.body.classList.remove(...arClasses);
    if (settings.aspectRatio) document.body.classList.add(`ar-${settings.aspectRatio}`);
  }, [settings.aspectRatio]);

  useEffect(() => {
    // Apply theme class, preserving ar-* classes
    const arClass = [...document.body.classList].find(c => c.startsWith('ar-'));
    document.body.className = settings.theme;
    if (arClass) document.body.classList.add(arClass);
  }, [settings.theme]);


  useEffect(() => {
    document.documentElement.style.setProperty('--overlay-opacity', String(settings.overlayOpacity));
  }, [settings.overlayOpacity]);

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
    player.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  }, []);

  const rewriteCurrentEmbedAudio = useCallback((muted) => {
    setCurrentEmbedUrl((currentUrl) => {
      if (!currentUrl) return currentUrl;
      try {
        const urlObj = new URL(currentUrl);
        urlObj.searchParams.set('autoplay', '1');
        urlObj.searchParams.set('muted', muted ? '1' : '0');
        const nextUrl = urlObj.toString();
        return nextUrl === currentUrl ? currentUrl : nextUrl;
      } catch (error) {
        console.warn('[TV] Failed to update iframe audio URL:', error);
        return currentUrl;
      }
    });
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
    const s = S.current;
    const channel = CHANNELS[s.activeChannelIndex];
    const state = channel ? s.channelStates[channel.id] : null;
    const progress = currentProgressRef.current;
    const snapshot = getActivePlaybackSnapshot(state, activePlaybackRef.current);
    if (!snapshot.currentItem || !Number.isFinite(progress) || progress < 0) return;

    const boundedProgress = snapshot.currentItem.dur
      ? Math.min(progress, Math.max(0, snapshot.currentItem.dur - 1))
      : progress;
    state.startedAt = Date.now() - ((snapshot.accumulatedBefore + boundedProgress) * 1000);
    persistChannelStatesSnapshot(s.channelStates);
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
      showToast('AUDIO ENABLED');
    }
  }, [postPlayerCommand, rewriteCurrentEmbedAudio, showToast, updateSetting]);

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
  const switchTo = useCallback(async (index, options = {}) => {
    const s = S.current;
    const refreshItem = options?.refreshItem === true;
    const advanceItem = options?.advanceItem === true || options?.restartItem === true;
    const skipCommit = options?.skipCommit === true;
    if (!skipCommit) commitActiveProgress();

    // Wrap around index for infinite scrolling
    if (index < 0) index = (CHANNELS.length + (index % CHANNELS.length)) % CHANNELS.length;
    else index = index % CHANNELS.length;

    s.switchToken++;
    const tok = s.switchToken;

    flashGlitch();
    setStatus('TUNING');
    setPlayPromptVisible(false);
    clearTimeout(promptTimerRef.current);

    const channel = CHANNELS[index];
    s.activeChannelIndex = index;
    syncLabels();

    // Save to local storage for persistent session
    localStorage.setItem('ytTV_lastChannel', index);

    // Initialize continuous timeline state for this channel if missing
    if (!s.channelStates[channel.id]) {
      s.channelStates[channel.id] = {
        playlist: [],
        startedAt: Date.now(),
      };
    }

    const state = s.channelStates[channel.id];
    let snapshot = getTimelineSnapshot(state);
    let currentItem = snapshot.currentItem;
    let resumeAt = snapshot.resumeAt;
    let completedItem = null;

    if (refreshItem) {
      setStatus('SCANNING');
      const newItems = await fetchChannelContent(channel);
      if (tok !== s.switchToken) return;

      if (newItems?.length) {
        state.playlist = newItems;
        state.startedAt = Date.now() - (getRandomStartOffset(newItems[0]) * 1000);
        snapshot = getTimelineSnapshot(state);
        currentItem = snapshot.currentItem;
        resumeAt = snapshot.resumeAt;
        persistChannelStatesSnapshot(s.channelStates);
      }
    }

    if (advanceItem) {
      const endedSnapshot = getActivePlaybackSnapshot(state, activePlaybackRef.current);
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
      const newItems = await fetchChannelContent(channel);
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

    s.failChainCount = 0;

    if (currentItem.embedUrl) {
      currentProgressRef.current = null;
      activePlaybackRef.current = { channelId: channel.id, itemId: currentItem.id, resumeAt };
      setCurrentTitle(currentItem.title);
      setCurrentEpTitle(currentItem.epTitle || '');
      setCurrentLogoUrl(currentItem.logoUrl || null);
      setPlaybackTimeStr(`${formatTime(resumeAt)} / -${formatTime(Math.max(0, currentItem.dur - resumeAt))}`);
      const finalEmbedUrl = buildPlaybackUrl(currentItem.embedUrl, resumeAt);
      playerLoadStartedAtRef.current = Date.now();
      setPlayerLoadKey((key) => key + 1);
      setCurrentEmbedUrl(finalEmbedUrl);

      promptTimerRef.current = setTimeout(() => {
        if (S.current.switchToken === tok && !isPlaybackMuted()) setPlayPromptVisible(true);
      }, 5500);

      setTimeout(() => {
        if (s.switchToken === tok) clearStatusFn();
      }, 1800);
    }
  }, [buildPlaybackUrl, clearStatusFn, commitActiveProgress, flashGlitch, isPlaybackMuted, setStatus, syncLabels]);

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
    initialTimerRef.current = setTimeout(() => {
      switchTo(startIndex, 'forward');
    }, 100);
    return () => clearTimeout(initialTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Iframe click audio unlock ── */
  useEffect(() => {
    const handleBlur = () => {
      setTimeout(() => {
        if (document.activeElement === playerRef.current) {
          unlockAudio(true);
        }
      }, 0);
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [unlockAudio]);

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
    setPlayPromptVisible(false);
    clearTimeout(promptTimerRef.current);
    clearStatusFn();
  }, [clearStatusFn]);

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

  const retryPlayback = useCallback(() => {
    unlockAudio(true);
    setPlayPromptVisible(false);
    clearTimeout(promptTimerRef.current);
    switchTo(S.current.activeChannelIndex);
  }, [switchTo, unlockAudio]);

  useEffect(() => {
    const player = playerRef.current;
    const muted = isPlaybackMuted();

    if (player?.tagName === 'VIDEO') {
      player.muted = muted;
      if (!isPoweredOff) player.play?.().catch(() => setPlayPromptVisible(true));
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
      const eventPayload = readPlayerEventPayload(e.data);

      if (eventPayload) {
        const { player_status, player_progress } = eventPayload;
        const progressSeconds = readProgressSeconds(player_progress);
        const reportedDuration = readProgressDurationSeconds(player_progress);
        const player = playerRef.current;
        const activePlayback = activePlaybackRef.current;
        const channel = CHANNELS[S.current.activeChannelIndex];
        const hasCompletionStatus = isCompletionStatus(player_status);

        if (
          !player ||
          player.tagName !== 'IFRAME' ||
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
        const durationChanged = syncReportedDuration(state, snapshot, reportedDuration);
        if (durationChanged) {
          snapshot = getActivePlaybackSnapshot(state, activePlaybackRef.current);
          lastPersistRef.current = Date.now();
          persistChannelStatesSnapshot(s.channelStates);
        }

        if (progressSeconds !== null && progressSeconds >= 0) {
          currentProgressRef.current = progressSeconds;
          if (snapshot.currentItem) {
            const boundedProgress = snapshot.currentItem.dur
              ? Math.min(progressSeconds, Math.max(0, snapshot.currentItem.dur - 1))
              : progressSeconds;
            state.startedAt = Date.now() - ((snapshot.accumulatedBefore + boundedProgress) * 1000);
            if (durationChanged || Date.now() - lastPersistRef.current > 5000) {
              lastPersistRef.current = Date.now();
              persistChannelStatesSnapshot(s.channelStates);
            }
            reachedTrustedEnd =
              reportedDuration !== null &&
              progressSeconds >= Math.max(0, reportedDuration - TRUSTED_END_EPSILON_SECONDS);
          }
        }
        if (isPlayingStatus(player_status)) {
          handlePlay();
        } else if (hasCompletionStatus || reachedTrustedEnd) {
          handleEnded();
        }
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handlePlay, handleEnded]);


  /* ── Open / Close Settings Menu ── */
  const openSettingsMenu = useCallback(() => {
    setSettingsMenuOpen(true);
    setLeftMenuOpen(false);
    setHudFadeOut(false);
    setNetworkFadeOut(false);
    clearTimeout(hudTimerRef.current);
  }, []);
  const closeSettingsMenu = useCallback(() => {
    setSettingsMenuOpen(false);
    resetHudIdle();
  }, [resetHudIdle]);

  const toggleLeftMenu = useCallback(() => {
    setLeftMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setHudFadeOut(false);
        setNetworkFadeOut(false);
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
      if (settingsMenuOpen) {
        if (e.key === 'Escape') closeSettingsMenu();
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
      } else if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setOverlayEnabled((prev) => !prev);
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
  }, [settingsMenuOpen, closeSettingsMenu, openSettingsMenu, switchTo, cycleTheme, toggleFullscreen]);

  /* ── Time & Title Tracker ── */
  useEffect(() => {
    const interval = setInterval(() => {
      const s = S.current;
      const channel = CHANNELS[s.activeChannelIndex];
      if (!channel) return;
      const state = s.channelStates[channel.id];
      const activePlayback = activePlaybackRef.current;
      const snapshot = getActivePlaybackSnapshot(state, activePlaybackRef.current);
      const currentItem = snapshot.currentItem;
      if (!currentItem) return;

      const timelineSnapshot = getTimelineSnapshot(state);
      const timelineMovedPastActive =
        !timelineSnapshot.currentItem || timelineSnapshot.currentItem.id !== activePlayback?.itemId;
      if (
        activePlayback?.channelId === channel.id &&
        activePlayback.itemId === currentItem.id &&
        currentItem.durationTrusted &&
        Number(currentItem.dur) > 0 &&
        snapshot.resumeAt >= Number(currentItem.dur) + TRUSTED_TIMELINE_CATCHUP_SECONDS &&
        timelineMovedPastActive
      ) {
        handleEnded();
        return;
      }

      const currentSeconds = getDisplayProgressSeconds(
        snapshot,
        activePlaybackRef.current,
        currentProgressRef.current
      );
      const remainingSeconds = Math.max(0, currentItem.dur - currentSeconds);

      setPlaybackTimeStr(`${formatTime(currentSeconds)} / -${formatTime(remainingSeconds)}`);
      setCurrentTitle(currentItem.title);
      setCurrentEpTitle(currentItem.epTitle || '');
      setCurrentLogoUrl(currentItem.logoUrl || null);
    }, 1000);
    return () => clearInterval(interval);
  }, [handleEnded]);

  useEffect(() => {
    const persistCurrentTimeline = () => {
      commitActiveProgress();
      persistChannelStatesSnapshot(S.current.channelStates);
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
      clearTimeout(promptTimerRef.current);
      clearTimeout(initialTimerRef.current);
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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <PlayerStage
        playerRef={playerRef}
        playerKey={playerLoadKey}
        onPlay={handlePlay}
        onEnded={handleEnded}
        onError={handleError}
        embedUrl={isPoweredOff ? '' : currentEmbedUrl}
        hasUnmuted={audioUnlocked}
        isMuted={effectiveMuted}
        playPromptVisible={playPromptVisible}
        onPromptClick={retryPlayback}
      />

      <Overlays
        canvasRef={canvasRef}
        overlayEnabled={overlayEnabled}
        scanlinesEnabled={settings.scanlines}
        vignetteEnabled={settings.vignette}
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
        audioUnlocked={audioUnlocked}
      />

      <HUD
        hudFadeOut={hudFadeOut && !leftMenuOpen && !settingsMenuOpen}
        channelLabel={channelLabel}
        showTitle={currentTitle}
        epTitle={currentEpTitle}
        logoUrl={settings.logoMode !== false ? currentLogoUrl : null}

        switchToNext={() => switchTo(S.current.activeChannelIndex + 1)}
        switchToPrev={() => switchTo(S.current.activeChannelIndex - 1)}
        toggleFullscreen={toggleFullscreen}
        refreshVideo={skipCurrentVideo}
        leftMenuOpen={leftMenuOpen || settingsMenuOpen}
        toggleLeftMenu={toggleLeftMenu}
      />

      <LeftMenu
        isOpen={leftMenuOpen}
        onClose={() => setLeftMenuOpen(false)}
        channels={CHANNELS}
        activeChannelId={CHANNELS[S.current.activeChannelIndex]?.id}
        onSelect={handleSelectChannel}
        openSettings={openSettingsMenu}
      />

      <SettingsMenu
        isOpen={settingsMenuOpen}
        onClose={closeSettingsMenu}
        settings={settings}
        updateSetting={updateSetting}
        themes={THEMES}
      />
    </div>
    </>
  );
}
