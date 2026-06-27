import db from '../constants/database.json';

const TITLE_CACHE_KEY = 'broadcastTV_titleSearchCache';
const TITLE_CACHE_TTL = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 10;

const localItems = Object.values(db).flat();

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(TITLE_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(TITLE_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[TV] Title cache write failed:', error);
  }
}

function findLocalTitle(title, channelId) {
  const wanted = normalizeTitle(title);
  const channelMatch = (db[channelId] || []).find((item) => normalizeTitle(item.title) === wanted);
  if (channelMatch) return channelMatch;
  return localItems.find((item) => normalizeTitle(item.title) === wanted);
}

function pickSuggestion(title, suggestions) {
  const wanted = normalizeTitle(title);
  const candidates = suggestions.filter((item) => {
    if (!item?.id?.startsWith('tt') || !item.l) return false;
    const kind = item.qid || item.q || '';
    return /movie|tv|series|tvSeries|tvMiniSeries/i.test(kind);
  });

  return (
    candidates.find((item) => normalizeTitle(item.l) === wanted) ||
    candidates.find((item) => normalizeTitle(item.l).includes(wanted) || wanted.includes(normalizeTitle(item.l))) ||
    candidates[0]
  );
}

async function searchTitle(title) {
  const cacheKey = normalizeTitle(title);
  const cache = readCache();
  const cached = cache[cacheKey];
  const now = Date.now();

  if (cached && now - cached.savedAt < TITLE_CACHE_TTL) {
    if (import.meta.env.DEV) console.log(`[TV] title cache hit: ${title}`);
    return cached.item;
  }

  if (import.meta.env.DEV) console.log(`[TV] title API call: ${title}`);

  const first = encodeURIComponent(cacheKey.charAt(0) || 'x');
  const query = encodeURIComponent(title.trim());
  const response = await fetch(`https://v3.sg.media-imdb.com/suggestion/${first}/${query}.json`);
  if (!response.ok) throw new Error(`IMDb suggestion failed: ${response.status}`);

  const payload = await response.json();
  const suggestion = pickSuggestion(title, payload.d || []);
  if (!suggestion) return null;

  const item = {
    id: suggestion.id,
    title: suggestion.l,
    type: /movie/i.test(suggestion.qid || suggestion.q || '') ? 'movie' : 'tv',
  };

  cache[cacheKey] = { savedAt: now, item };
  writeCache(cache);
  return item;
}

async function resolveTitle(title, channelId) {
  try {
    const apiItem = await searchTitle(title);
    if (apiItem) return apiItem;
  } catch (error) {
    if (import.meta.env.DEV) console.warn(`[TV] title API failed for "${title}":`, error);
  }

  const fallback = findLocalTitle(title, channelId);
  if (fallback && import.meta.env.DEV) console.log(`[TV] local fallback: ${title}`);
  return fallback || null;
}

function buildPlayableItem(item) {
  const isTv = item.type === 'tv';
  const season = isTv ? Math.floor(Math.random() * 3) + 1 : null;
  const episode = isTv ? Math.floor(Math.random() * 10) + 1 : null;
  const base = isTv
    ? `https://vaplayer.ru/embed/tv/${item.id}/${season}/${episode}`
    : `https://vaplayer.ru/embed/movie/${item.id}`;

  return {
    id: `${item.id}-${Math.random().toString(36).slice(2, 9)}`,
    title: isTv ? `${item.title} (S${season}E${episode})` : item.title,
    embedUrl: `${base}?autoplay=1&hd=1&quality=1080p`,
    dur: isTv ? 1320 : 5400,
  };
}

export async function fetchChannelContent(channel) {
  const localChannelData = db[channel.id] || [];
  const titleList = channel.curatedTitles || shuffle(localChannelData).map((item) => item.title);
  const selectedTitles = shuffle(titleList).slice(0, BATCH_SIZE);
  const resolved = await Promise.all(selectedTitles.map((title) => resolveTitle(title, channel.id)));
  const playable = resolved.filter(Boolean).map(buildPlayableItem);

  if (playable.length > 0) return playable;

  return [
    {
      id: `fallback-${Math.random().toString(36).slice(2, 9)}`,
      title: `No Signal (${channel.name})`,
      embedUrl: 'https://vaplayer.ru/embed/movie/tt0468569?autoplay=1&hd=1&quality=1080p',
      dur: 9120,
    },
  ];
}
