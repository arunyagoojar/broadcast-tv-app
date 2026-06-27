import db from '../constants/database.json';

const TITLE_CACHE_KEY = 'broadcastTV_titleSearchCache';
const TITLE_CACHE_TTL = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 10;

const localItems = Object.values(db).flat();
const KNOWN_TITLES = {
  'everybody loves raymond': { id: 'tt0115167', title: 'Everybody Loves Raymond', type: 'tv' },
  'the big bang theory': { id: 'tt0898266', title: 'The Big Bang Theory', type: 'tv' },
  'the vampire diaries': { id: 'tt1405406', title: 'The Vampire Diaries', type: 'tv' },
  'family guy': { id: 'tt0182576', title: 'Family Guy', type: 'tv' },
  'the simpsons': { id: 'tt0096697', title: 'The Simpsons', type: 'tv' },
  'impractical jokers': { id: 'tt2100976', title: 'Impractical Jokers', type: 'tv' },
  'louie': { id: 'tt1492966', title: 'Louie', type: 'tv' },
  'lucky louie': { id: 'tt0462128', title: 'Lucky Louie', type: 'tv' },
  'louis c k hilarious': { id: 'tt1421373', title: 'Louis C.K.: Hilarious', type: 'movie' },
  'louis c k live at the beacon theater': { id: 'tt2112999', title: 'Louis C.K.: Live at the Beacon Theater', type: 'movie' },
  'louis c k oh my god': { id: 'tt2510998', title: 'Louis C.K.: Oh My God', type: 'movie' },
  'louis c k shameless': { id: 'tt0927619', title: 'Louis C.K.: Shameless', type: 'movie' },
  'louis c k chewed up': { id: 'tt1190722', title: 'Louis C.K.: Chewed Up', type: 'movie' },
  'andaz apna apna': { id: 'tt0109117', title: 'Andaz Apna Apna', type: 'movie' },
  'hera pheri': { id: 'tt0242519', title: 'Hera Pheri', type: 'movie' },
  'gol maal': { id: 'tt0079221', title: 'Gol Maal', type: 'movie' },
  'chupke chupke': { id: 'tt0072783', title: 'Chupke Chupke', type: 'movie' },
  'jaane bhi do yaaro': { id: 'tt0085743', title: 'Jaane Bhi Do Yaaro', type: 'movie' },
  'padosan': { id: 'tt0063404', title: 'Padosan', type: 'movie' },
  'chashme buddoor': { id: 'tt0085321', title: 'Chashme Buddoor', type: 'movie' },
  'angoor': { id: 'tt0083564', title: 'Angoor', type: 'movie' },
  'dilwale dulhania le jayenge': { id: 'tt0112870', title: 'Dilwale Dulhania Le Jayenge', type: 'movie' },
  'sholay': { id: 'tt0073707', title: 'Sholay', type: 'movie' },
  'mughal e azam': { id: 'tt0054098', title: 'Mughal-E-Azam', type: 'movie' },
  'mother india': { id: 'tt0050188', title: 'Mother India', type: 'movie' },
  'anand': { id: 'tt0066763', title: 'Anand', type: 'movie' },
  'deewaar': { id: 'tt0072860', title: 'Deewaar', type: 'movie' },
  'amar akbar anthony': { id: 'tt0075669', title: 'Amar Akbar Anthony', type: 'movie' },
  'guide': { id: 'tt0059246', title: 'Guide', type: 'movie' },
  'pyaasa': { id: 'tt0050870', title: 'Pyaasa', type: 'movie' },
  'kabhi kabhie': { id: 'tt0074730', title: 'Kabhi Kabhie', type: 'movie' },
  'malgudi days': { id: 'tt0249595', title: 'Malgudi Days', type: 'tv' },
  'dekh bhai dekh': { id: 'tt0158417', title: 'Dekh Bhai Dekh', type: 'tv' },
  'shrimaan shrimati': { id: 'tt0398564', title: 'Shrimaan Shrimati', type: 'tv' },
  'hum paanch': { id: 'tt0249283', title: 'Hum Paanch', type: 'tv' },
  'office office': { id: 'tt0398533', title: 'Office Office', type: 'tv' },
  'fauji': { id: 'tt0363353', title: 'Fauji', type: 'tv' },
  'byomkesh bakshi': { id: 'tt0157217', title: 'Byomkesh Bakshi', type: 'tv' },
  'flop show': { id: 'tt0327329', title: 'Flop Show', type: 'tv' },
};

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
  const knownTitle = KNOWN_TITLES[normalizeTitle(title)];
  if (knownTitle) return knownTitle;

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

  return playable;
}
