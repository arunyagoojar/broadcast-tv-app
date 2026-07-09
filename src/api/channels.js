import db from '../constants/database.json';
import logos from '../constants/logos.json';

const TITLE_CACHE_KEY = 'broadcastTV_titleSearchCache';
const TVMAZE_CACHE_KEY = 'broadcastTV_tvmazeCacheV2';
const TITLE_CACHE_TTL = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 20;
// Per-channel played title tracking for exhausted-pool reset
const channelPlayedSets = {};

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
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

async function fetchTvMazeData(imdbId) {
  const cache = readCache();
  const tvmazeCache = cache.tvmaze || {};
  const cached = tvmazeCache[imdbId];
  if (cached && (Date.now() - cached.savedAt < TITLE_CACHE_TTL)) {
    return cached.data;
  }


  try {
    const lookupRes = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${imdbId}`);
    if (!lookupRes.ok) return null;
    const showData = await lookupRes.json();
    const tvmazeId = showData.id;
    
    const epRes = await fetch(`https://api.tvmaze.com/shows/${tvmazeId}/episodes`);
    if (!epRes.ok) return null;
    const episodes = await epRes.json();

    let logoUrl = null;
    if (showData.name === "The Office") {
      logoUrl = 'https://static.tvmaze.com/uploads/images/original_untouched/624/1562240.jpg';
    }
    
    const maxEpisodes = {};
    const episodeTitles = {};
    for (const ep of episodes) {
      if (ep.season && ep.number) {
        maxEpisodes[ep.season] = Math.max(maxEpisodes[ep.season] || 0, ep.number);
        episodeTitles[`${ep.season}-${ep.number}`] = ep.name;
      }
    }
    
    const validSeasons = Object.keys(maxEpisodes).map(Number).sort((a,b) => a - b);
    if (validSeasons.length === 0) return null;
    
    const result = { seasons: validSeasons, maxEpisodes, episodeTitles, logoUrl };
    
    tvmazeCache[imdbId] = { savedAt: Date.now(), data: result };
    cache.tvmaze = tvmazeCache;
    writeCache(cache);

    return result;
  } catch (err) {
    if (import.meta.env.DEV) console.warn(`[TV] TVMaze fetch failed for ${imdbId}`, err);
    return null;
  }
}
const TMDB_API_KEY = '1c29feb59f90480282165ab1fdee190f';

async function fetchTmdbLogo(imdbId) {
  if (!imdbId) return null;
  try {
    const findRes = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${TMDB_API_KEY}`);
    const findData = await findRes.json();
    
    let tmdbId, type;
    if (findData.movie_results && findData.movie_results.length > 0) {
      tmdbId = findData.movie_results[0].id;
      type = 'movie';
    } else if (findData.tv_results && findData.tv_results.length > 0) {
      tmdbId = findData.tv_results[0].id;
      type = 'tv';
    }
    
    if (!tmdbId) return null;
    
    const imgRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/images?api_key=${TMDB_API_KEY}&include_image_language=en,null`);
    const imgData = await imgRes.json();
    
    if (imgData.logos && imgData.logos.length > 0) {
      imgData.logos.sort((a, b) => b.vote_average - a.vote_average);
      const bestLogo = imgData.logos.find(l => l.iso_639_1 === 'en') || imgData.logos[0];
      if (bestLogo && bestLogo.file_path) {
        return `https://image.tmdb.org/t/p/w500${bestLogo.file_path}`;
      }
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn(`[TV] TMDB logo fetch failed for ${imdbId}`, err);
  }
  return null;
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
  let resolvedItem = null;

  const knownTitle = KNOWN_TITLES[normalizeTitle(title)];
  if (knownTitle) {
    resolvedItem = { ...knownTitle };
  } else {
    try {
      resolvedItem = await searchTitle(title);
    } catch (error) {
      if (import.meta.env.DEV) console.warn(`[TV] title API failed for "${title}":`, error);
    }
  }

  const fallback = findLocalTitle(title, channelId);
  const activeItem = resolvedItem || fallback;

  if (activeItem) {
    if (activeItem.type === 'tv') {
      const tvData = await fetchTvMazeData(activeItem.id);
      if (tvData) {
        activeItem.seasons = tvData.seasons;
        activeItem.maxEpisodes = tvData.maxEpisodes;
        activeItem.episodeTitles = tvData.episodeTitles;
        activeItem.logoUrl = tvData.logoUrl;
      }
    }

    // Use pre-fetched TMDB logos or fetch them dynamically
    if (logos[activeItem.id]) {
      activeItem.logoUrl = logos[activeItem.id];
    } else if (activeItem.type === 'movie' || !activeItem.logoUrl) {
      const dynamicLogo = await fetchTmdbLogo(activeItem.id);
      if (dynamicLogo) {
        activeItem.logoUrl = dynamicLogo;
      }
    }
    
    // Local DB overrides for seasons/maxEpisodes
    const localDbItem = localItems.find(i => i.id === activeItem.id) || fallback;
    if (localDbItem && localDbItem.seasons) {
      activeItem.seasons = localDbItem.seasons;
      activeItem.maxEpisodes = localDbItem.maxEpisodes;
    }
    return activeItem;
  }

  return null;
}

function buildPlayableItem(item, forcedSeason = null, forcedEpisode = null) {
  const isTv = item.type === 'tv';
  let season = forcedSeason;
  let episode = forcedEpisode;

  if (isTv && (season === null || episode === null)) {
    if (item.seasons && item.seasons.length > 0 && item.maxEpisodes) {
      season = item.seasons[Math.floor(Math.random() * item.seasons.length)];
      const maxEp = item.maxEpisodes[season] || 1;
      episode = Math.floor(Math.random() * maxEp) + 1;
    } else {
      season = Math.floor(Math.random() * 3) + 1;
      episode = Math.floor(Math.random() * 10) + 1;
    }
  }

  const base = isTv
    ? `https://vaplayer.ru/embed/tv/${item.id}/${season}/${episode}`
    : `https://vaplayer.ru/embed/movie/${item.id}`;

  const epKey = `${season}-${episode}`;
  const epTitle = item.episodeTitles && item.episodeTitles[epKey] 
    ? item.episodeTitles[epKey]
    : `(S${season}E${episode})`;

  return {
    id: `${item.id}-${Math.random().toString(36).slice(2, 9)}`,
    title: item.title,
    epTitle: isTv ? epTitle : '',
    logoUrl: item.logoUrl || logos[item.id] || null,
    embedUrl: `${base}?autoplay=1&hd=1&quality=1080p`,
    dur: isTv ? 1320 : 5400,
  };
}

function generateConsecutiveEpisodes(tvShow) {
  const episodes = [];
  let season = null;
  let maxEp = 10;
  
  if (tvShow.seasons && tvShow.seasons.length > 0 && tvShow.maxEpisodes) {
    season = tvShow.seasons[Math.floor(Math.random() * tvShow.seasons.length)];
    maxEp = tvShow.maxEpisodes[season] || 1;
  } else {
    season = Math.floor(Math.random() * 3) + 1;
  }
  
  const numEps = Math.floor(Math.random() * 3) + 1;
  let currentEp = Math.floor(Math.random() * maxEp) + 1;
  let currentSeason = season;
  
  for (let i = 0; i < numEps; i++) {
    let currentSeasonMax = tvShow.maxEpisodes ? (tvShow.maxEpisodes[currentSeason] || 1) : 10;
    
    if (currentEp > currentSeasonMax) {
      if (tvShow.seasons) {
        const idx = tvShow.seasons.indexOf(currentSeason);
        if (idx !== -1 && idx < tvShow.seasons.length - 1) {
          currentSeason = tvShow.seasons[idx + 1];
          currentEp = 1;
        } else {
          break; // No more seasons available
        }
      } else {
        currentSeason++;
        currentEp = 1;
        if (currentSeason > 3) break; // fallback boundary
      }
    }
    
    episodes.push(buildPlayableItem(tvShow, currentSeason, currentEp));
    currentEp++;
  }
  return episodes;
}

export async function fetchChannelContent(channel) {
  const localChannelData = db[channel.id] || [];
  const allTitles = channel.curatedTitles || shuffle(localChannelData).map((item) => item.title);

  // Exhausted-pool reset: track which titles have been played per channel
  if (!channelPlayedSets[channel.id]) channelPlayedSets[channel.id] = new Set();
  const played = channelPlayedSets[channel.id];

  let pool = allTitles.filter(t => !played.has(t));
  // If the pool is exhausted (or nearly so), reset and reshuffle the whole catalog
  if (pool.length < BATCH_SIZE) {
    channelPlayedSets[channel.id] = new Set();
    pool = [...allTitles];
  }

  const selectedTitles = shuffle(pool).slice(0, BATCH_SIZE);
  // Mark selected titles as played
  selectedTitles.forEach(t => channelPlayedSets[channel.id].add(t));

  const resolved = await Promise.all(selectedTitles.map((title) => resolveTitle(title, channel.id)));
  
  const validResolved = resolved.filter(Boolean);
  
  const movies = validResolved.filter(i => i.type === 'movie');
  const tvShows = validResolved.filter(i => i.type === 'tv');
  
  const isMixed = movies.length > 0 && tvShows.length > 0;
  
  const playable = [];
  
  if (isMixed) {
    let tvIndex = 0;
    let movieIndex = 0;
    
    while (tvIndex < tvShows.length || movieIndex < movies.length) {
      if (tvIndex < tvShows.length) {
        playable.push(...generateConsecutiveEpisodes(tvShows[tvIndex++]));
      }
      
      if (movieIndex < movies.length) {
        playable.push(buildPlayableItem(movies[movieIndex++]));
      }
    }
  } else if (tvShows.length > 0) {
    for (const tvShow of validResolved) {
      playable.push(...generateConsecutiveEpisodes(tvShow));
    }
  } else {
    for (const item of validResolved) {
      playable.push(buildPlayableItem(item));
    }
  }

  return playable;
}
