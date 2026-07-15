import db from '../constants/database.json';
import logos from '../constants/logos.json';

const TITLE_CACHE_KEY = 'broadcastTV_titleSearchCache';
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
  'louis c k 2017': { id: 'tt6736782', title: 'Louis C.K. 2017', type: 'movie' },
  'mr bean': { id: 'tt0096657', title: 'Mr. Bean', type: 'tv' },
  'brooklyn nine nine': { id: 'tt2467372', title: 'Brooklyn Nine-Nine', type: 'tv' },
  'parks and recreation': { id: 'tt1266020', title: 'Parks and Recreation', type: 'tv' },
  'modern family': { id: 'tt1442437', title: 'Modern Family', type: 'tv' },
  'how i met your mother': { id: 'tt0460649', title: 'How I Met Your Mother', type: 'tv' },
  'seinfeld': { id: 'tt0098904', title: 'Seinfeld', type: 'tv' },
  'malcolm in the middle': { id: 'tt0212671', title: 'Malcolm in the Middle', type: 'tv' },
  'community': { id: 'tt1439629', title: 'Community', type: 'tv' },
  'two and a half men': { id: 'tt0369179', title: 'Two and a Half Men', type: 'tv' },
  'fresh prince of bel air': { id: 'tt0098800', title: 'Fresh Prince of Bel-Air', type: 'tv' },
  'key peele': { id: 'tt1981558', title: 'Key & Peele', type: 'tv' },
  'saturday night live': { id: 'tt0072562', title: 'Saturday Night Live', type: 'tv' },
  'whose line is it anyway': { id: 'tt2919910', title: 'Whose Line Is It Anyway?', type: 'tv' },
  'monty python s flying circus': { id: 'tt0063929', title: "Monty Python's Flying Circus", type: 'tv' },
  'chappelle s show': { id: 'tt0353049', title: "Chappelle's Show", type: 'tv' },
  'i think you should leave with tim robinson': { id: 'tt10050772', title: 'I Think You Should Leave with Tim Robinson', type: 'tv' },
  'tom jerry': { id: 'tt3559124', title: 'Tom & Jerry', type: 'tv' },
  'looney tunes': { id: 'tt1726839', title: 'Looney Tunes', type: 'tv' },
  'scooby doo': { id: 'tt0063950', title: 'Scooby-Doo', type: 'tv' },
  'popeye': { id: 'tt0145628', title: 'Popeye', type: 'tv' },
  'futurama': { id: 'tt0149460', title: 'Futurama', type: 'tv' },
  'bob s burgers': { id: 'tt1561755', title: "Bob's Burgers", type: 'tv' },
  'king of the hill': { id: 'tt0118375', title: 'King of the Hill', type: 'tv' },
  'adventure time': { id: 'tt1305826', title: 'Adventure Time', type: 'tv' },
  'courage the cowardly dog': { id: 'tt0220880', title: 'Courage the Cowardly Dog', type: 'tv' },
  'pokemon': { id: 'tt0168366', title: 'Pokemon', type: 'tv' },
  'dragon ball': { id: 'tt0121220', title: 'Dragon Ball', type: 'tv' },
  'invincible': { id: 'tt6741278', title: 'Invincible', type: 'tv' },
  'boys': { id: 'tt1190634', title: 'The Boys', type: 'tv' },
  'watchmen': { id: 'tt7049682', title: 'Watchmen', type: 'tv' },
  'planet earth': { id: 'tt0795176', title: 'Planet Earth', type: 'tv' },
  'blue planet': { id: 'tt0296310', title: 'Blue Planet', type: 'tv' },
  'prehistoric planet': { id: 'tt10324164', title: 'Prehistoric Planet', type: 'tv' },
  'frozen planet': { id: 'tt2092588', title: 'Frozen Planet', type: 'tv' },
  'cosmos': { id: 'tt2395695', title: 'Cosmos', type: 'tv' },
  'nova': { id: 'tt0206501', title: 'NOVA', type: 'tv' },
  'modern marvels': { id: 'tt0199248', title: 'Modern Marvels', type: 'tv' },
  'universe': { id: 'tt1051155', title: 'Universe', type: 'tv' },
  'mythbusters': { id: 'tt0383126', title: 'MythBusters', type: 'tv' },
  'kitchen nightmares': { id: 'tt0983514', title: 'Kitchen Nightmares', type: 'tv' },
  'hell s kitchen': { id: 'tt0437005', title: "Hell's Kitchen", type: 'tv' },
  'top gear': { id: 'tt1628033', title: 'Top Gear', type: 'tv' },
  'dave chappelle sticks stones': { id: 'tt10810424', title: 'Dave Chappelle: Sticks & Stones', type: 'movie' },
  'dave chappelle the closer': { id: 'tt15523010', title: 'Dave Chappelle: The Closer', type: 'movie' },
  'dave chappelle equanimity': { id: 'tt7806998', title: 'Dave Chappelle: Equanimity', type: 'movie' },
  'dave chappelle the age of spin': { id: 'tt6648926', title: 'Dave Chappelle: The Age of Spin', type: 'movie' },
  'dave chappelle deep in the heart of texas': { id: 'tt6649108', title: 'Dave Chappelle: Deep in the Heart of Texas', type: 'movie' },
  'bill burr paper tiger': { id: 'tt10847306', title: 'Bill Burr: Paper Tiger', type: 'movie' },
  'bill burr walk your way out': { id: 'tt6184894', title: 'Bill Burr: Walk Your Way Out', type: 'movie' },
  'bill burr i m sorry you feel that way': { id: 'tt3823690', title: "Bill Burr: I'm Sorry You Feel That Way", type: 'movie' },
  'bill burr let it go': { id: 'tt1717578', title: 'Bill Burr: Let It Go', type: 'movie' },
  'ricky gervais humanity': { id: 'tt7830574', title: 'Ricky Gervais: Humanity', type: 'movie' },
  'ricky gervais supernature': { id: 'tt19885626', title: 'Ricky Gervais: SuperNature', type: 'movie' },
  'ricky gervais armageddon': { id: 'tt30088797', title: 'Ricky Gervais: Armageddon', type: 'movie' },
  'jim gaffigan mr universe': { id: 'tt2273321', title: 'Jim Gaffigan: Mr. Universe', type: 'movie' },
  'jim gaffigan obsessed': { id: 'tt3481550', title: 'Jim Gaffigan: Obsessed', type: 'movie' },
  'jim gaffigan cinco': { id: 'tt6090102', title: 'Jim Gaffigan: Cinco', type: 'movie' },
  'jim gaffigan quality time': { id: 'tt9657544', title: 'Jim Gaffigan: Quality Time', type: 'movie' },
  'gabriel iglesias i m sorry for what i said when i was hungry': { id: 'tt6302122', title: "Gabriel Iglesias: I'm Sorry for What I Said When I Was Hungry", type: 'movie' },
  'gabriel iglesias one show fits all': { id: 'tt9426212', title: 'Gabriel Iglesias: One Show Fits All', type: 'movie' },
  'gabriel iglesias stadium fluffy': { id: 'tt21639094', title: 'Gabriel Iglesias: Stadium Fluffy', type: 'movie' },
  'kevin hart laugh at my pain': { id: 'tt1999192', title: 'Kevin Hart: Laugh at My Pain', type: 'movie' },
  'kevin hart let me explain': { id: 'tt2609912', title: 'Kevin Hart: Let Me Explain', type: 'movie' },
  'kevin hart what now': { id: 'tt4669186', title: 'Kevin Hart: What Now?', type: 'movie' },
  'kevin hart irresponsible': { id: 'tt10009796', title: 'Kevin Hart: Irresponsible', type: 'movie' },
  'jo koy live from seattle': { id: 'tt6720442', title: 'Jo Koy: Live from Seattle', type: 'movie' },
  'jo koy comin in hot': { id: 'tt10377036', title: "Jo Koy: Comin' in Hot", type: 'movie' },
  'jo koy in his elements': { id: 'tt12357266', title: 'Jo Koy: In His Elements', type: 'movie' },
  'russell peters almost famous': { id: 'tt5946232', title: 'Russell Peters: Almost Famous', type: 'movie' },
  'russell peters notorious': { id: 'tt3295244', title: 'Russell Peters: Notorious', type: 'movie' },
  'russell peters red white and brown': { id: 'tt1369567', title: 'Russell Peters: Red, White and Brown', type: 'movie' },
  'john mulaney kid gorgeous at radio city': { id: 'tt8271714', title: 'John Mulaney: Kid Gorgeous at Radio City', type: 'movie' },
  'john mulaney the comeback kid': { id: 'tt5069564', title: 'John Mulaney: The Comeback Kid', type: 'movie' },
  'john mulaney new in town': { id: 'tt2246779', title: 'John Mulaney: New in Town', type: 'movie' },
  'john mulaney baby j': { id: 'tt27141610', title: 'John Mulaney: Baby J', type: 'movie' },
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
    const episodeDurations = {};
    for (const ep of episodes) {
      if (ep.season && ep.number) {
        maxEpisodes[ep.season] = Math.max(maxEpisodes[ep.season] || 0, ep.number);
        episodeTitles[`${ep.season}-${ep.number}`] = ep.name;
        const runtimeMinutes = Number(ep.runtime || showData.averageRuntime || showData.runtime);
        if (Number.isFinite(runtimeMinutes) && runtimeMinutes > 0) {
          episodeDurations[`${ep.season}-${ep.number}`] = runtimeMinutes * 60;
        }
      }
    }
    
    const validSeasons = Object.keys(maxEpisodes).map(Number).sort((a,b) => a - b);
    if (validSeasons.length === 0) return null;
    
    const result = { seasons: validSeasons, maxEpisodes, episodeTitles, episodeDurations, logoUrl };
    
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

async function fetchTmdbMetadata(imdbId) {
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
    
    const [imgRes, detailsRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/images?api_key=${TMDB_API_KEY}&include_image_language=en,null`),
      fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`),
    ]);
    const imgData = imgRes.ok ? await imgRes.json() : {};
    const details = detailsRes.ok ? await detailsRes.json() : {};
    let logoUrl = null;
    
    if (imgData.logos && imgData.logos.length > 0) {
      imgData.logos.sort((a, b) => b.vote_average - a.vote_average);
      const bestLogo = imgData.logos.find(l => l.iso_639_1 === 'en') || imgData.logos[0];
      if (bestLogo && bestLogo.file_path) {
        logoUrl = `https://image.tmdb.org/t/p/w500${bestLogo.file_path}`;
      }
    }

    const runtimeMinutes = type === 'movie'
      ? Number(details.runtime)
      : Number(details.episode_run_time?.[0]);
    return {
      logoUrl,
      duration: Number.isFinite(runtimeMinutes) && runtimeMinutes > 0
        ? runtimeMinutes * 60
        : null,
    };
  } catch (err) {
    if (import.meta.env.DEV) console.warn(`[TV] TMDB metadata fetch failed for ${imdbId}`, err);
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
        activeItem.episodeDurations = tvData.episodeDurations;
        activeItem.logoUrl = tvData.logoUrl;
      }
    }

    // Use pre-fetched TMDB logos and fetch runtime metadata when needed.
    if (logos[activeItem.id]) {
      activeItem.logoUrl = logos[activeItem.id];
    }
    if (activeItem.type === 'movie' || !activeItem.logoUrl) {
      const metadata = await fetchTmdbMetadata(activeItem.id);
      if (metadata?.logoUrl && !activeItem.logoUrl) activeItem.logoUrl = metadata.logoUrl;
      if (metadata?.duration) activeItem.duration = metadata.duration;
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
    id: isTv ? `${item.id}-s${season}e${episode}` : `${item.id}-movie`,
    seriesId: isTv ? item.id : null,
    season: isTv ? season : null,
    episode: isTv ? episode : null,
    title: item.title,
    epTitle: isTv ? epTitle : '',
    logoUrl: item.logoUrl || logos[item.id] || null,
    embedUrl: `${base}?autoplay=1&hd=1&quality=1080p`,
    dur: isTv
      ? Number(item.episodeDurations?.[epKey]) || 0
      : Number(item.duration) || 0,
    durationTrusted: isTv
      ? Number(item.episodeDurations?.[epKey]) > 0
      : Number(item.duration) > 0,
  };
}

function generateConsecutiveEpisodes(tvShow, { count = 3, afterItem = null } = {}) {
  const episodes = [];
  const hasSeasonData = Boolean(tvShow.seasons?.length && tvShow.maxEpisodes);
  const initialSeason = hasSeasonData
    ? tvShow.seasons[Math.floor(Math.random() * tvShow.seasons.length)]
    : Math.floor(Math.random() * 3) + 1;
  const maxEp = hasSeasonData ? (tvShow.maxEpisodes[initialSeason] || 1) : 10;
  
  const continuing = afterItem?.seriesId === tvShow.id && Number(afterItem.season) > 0 && Number(afterItem.episode) > 0;
  let currentEp = continuing ? Number(afterItem.episode) + 1 : Math.floor(Math.random() * maxEp) + 1;
  let currentSeason = continuing ? Number(afterItem.season) : initialSeason;
  
  for (let i = 0; i < count; i++) {
    const currentSeasonMax = tvShow.maxEpisodes ? (tvShow.maxEpisodes[currentSeason] || 1) : 10;
    
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

export async function fetchChannelContent(channel, { afterItem = null } = {}) {
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

  if (tvShows.length === 1 && movies.length === 0 && allTitles.length === 1) {
    return generateConsecutiveEpisodes(tvShows[0], { count: 40, afterItem });
  }
  
  if (isMixed) {
    let tvIndex = 0;
    let movieIndex = 0;
    
    while (tvIndex < tvShows.length || movieIndex < movies.length) {
      if (movieIndex < movies.length) {
        playable.push(buildPlayableItem(movies[movieIndex++]));
      }

      if (tvIndex < tvShows.length) {
        playable.push(...generateConsecutiveEpisodes(tvShows[tvIndex++], { count: 3 }));
      }
    }
  } else if (tvShows.length > 0) {
    for (const tvShow of validResolved) {
      playable.push(...generateConsecutiveEpisodes(tvShow, { count: 3 }));
    }
  } else {
    for (const item of validResolved) {
      playable.push(buildPlayableItem(item));
    }
  }

  return playable;
}
