# Broadcast TV App 📺

A modern, immersive web application that simulates a classic television broadcast experience. Instead of endlessly scrolling through on-demand menus, users can simply "tune in" to continuous, curated channels (like Action, Comedy, Netflix Originals, or HBO Max) that are algorithmically scheduled and always running—just like real TV.

## 🌟 Brief Introduction

The Broadcast TV App brings the lean-back experience of traditional television to the modern streaming era. It features a sleek, glassmorphic UI, an authentic on-screen display (OSD) HUD, and dynamic channel grids. When a user selects a channel, they drop right into the middle of a continuous marathon of shows or movies, complete with static overlay noise and retro channel-switching animations.

## ⚙️ How the Solution Works

At its core, the app operates as a **virtual programming scheduler**. It doesn't host video files. Instead:
1. It loads a static, pre-compiled database of movies and TV shows assigned to specific channels.
2. It uses a custom scheduling algorithm to generate a 24/7 timeline of programming for every channel.
3. Based on the user's local real-world time, it determines exactly what show/movie and what specific episode should be playing *right now*.
4. It plays the corresponding content through the vaplayer/VidAPI embed player and uses documented player events to keep the simulated broadcast timeline in sync.

## 🔌 APIs We Are Using

The project relies on a combination of metadata APIs and streaming APIs:

- **Local precompiled catalog** (`src/constants/database.json`): The authoritative source for exact IMDb IDs, content types, seasons, episode counts, and selected runtimes. The production build splits it into lazy per-channel catalog chunks so selecting one channel does not download every channel's records.
- **Local exact-title index** (`src/constants/catalogIndex.json`): Resolves curated titles against records already present in the project. Runtime title-search APIs are not used.
- **TVMaze API** (`api.tvmaze.com`): Enriches TV season, episode, title, and runtime information when it is not already cached.
- **TMDB API** (`api.themoviedb.org`): Supplies missing runtime and clear-logo metadata. Results are cached locally and requests are concurrency-limited.
- **vaplayer/VidAPI** (`vaplayer.ru`): Provides the embedded movie and episode player, resume timestamps, and playback progress/completion events.

## 🔇 Tackling Challenges: Autoplay & Mute/Unmute

Modern web browsers enforce strict **Autoplay Policies**, meaning video cannot automatically play with sound unless the user has explicitly interacted with the webpage. 

To create a seamless "turn on the TV" experience without the browser blocking playback:
1. **Muted Autoplay:** The player starts in an autoplay-compatible muted state.
2. **Explicit audio request:** Clicking the video shield requests sound while preserving autoplay for subsequent channel changes.
3. **Provider fallback:** The current provider wrapper does not expose a documented parent-to-player audio-control interface. The app retains the existing iframe reload fallback, resuming at the last reported position or the channel timeline when progress is not yet available. In-place unmuting requires provider support.

## Local artwork and menu assets

Menu icons are inline SVGs, so they need no image requests. Show logos are served from `public/artwork`, and the broadcast caption font is served from `public/fonts`; the app never fetches artwork or fonts from an external CDN.

`npm run artwork:cache` refreshes the bundled artwork from `scripts/artwork-sources.json`. This is a maintenance command, not a browser runtime operation. Keep the source manifest and font license with the assets.

## Playback reliability

- A new channel schedule or refresh starts at a random point between **8% and 56%** of a known runtime. Unknown runtimes use conservative random offsets (30–180 seconds for movies, 30–90 seconds for episodes). Returning to a channel follows its continuing timeline.
- Metadata enrichment has a four-second budget. If a service is unavailable, local records still tune with an explicitly estimated runtime.
- Fine, dark loading grain remains until the provider reports advancing playback progress. A startup watchdog recovers stalled embeds.
- Series channels loop after the final episode. Schedule occurrences are tracked separately when a movie repeats.
- Channel browsing and Settings share one persistent overlay panel.

## 📡 Creating the Channels

Channels are defined in a static configuration file (`src/constants/channels.js`). They are categorized into distinct groups:
- **Core:** Standard genres (Action, Comedy, Drama).
- **Moods:** Thematic channels (Nostalgia, Romance, Musicals, Marvel, DC).
- **Streaming Platforms:** Network-specific channels featuring exact SVG brand logos and colors (Netflix, HBO, Disney+, Prime Video, Apple TV+, Hulu, Paramount+, Peacock).
- **Hero Franchises:** Separate Marvel, DC, Sony Superheroes, and animation-focused channels with deliberately curated catalogs.

Each channel is assigned a curated array of string titles representing the shows and movies that belong on that network.

## 🗄️ Fetching & Storing Shows and Movies

To avoid rate-limiting and ensure lightning-fast load times, the app uses a **Static Pre-fetching Architecture**:

1. **`fetch_db.js` (The Scraper):** A Node.js utility script reads the raw titles from the channel configuration.
2. **Metadata Enrichment:** For every title, it hits the IMDb API to get the ID/Type. If it's a TV show, it subsequently hits the TVMaze API to map out its entire season and episode architecture.
3. **`database.json` (The Storage):** The script writes all this rich, nested metadata into `src/constants/database.json`.
4. **Runtime Access:** The React application lazy-loads the selected channel's generated catalog chunk. Exact local metadata remains primary without placing the complete database in the initial application bundle.

After editing `database.json`, run `npm run catalog:sync` to regenerate the lazy per-channel files. The test suite verifies that the generated files still exactly match the authoritative database.

*(Note: If a dynamically requested title is missing from the JSON, `src/api/channels.js` features a fallback mechanism to fetch the metadata on-the-fly and cache it in the browser's `localStorage`.)*

## ⏱️ The Scheduling Algorithm

The heart of the broadcast simulation is the `generateConsecutiveEpisodes` algorithm:

- **Shuffling & Interleaving:** It takes the channel's local database and shuffles it. It seamlessly interleaves singular movie blocks with multi-episode TV show blocks.
- **Anti-Monotony Grouping:** To prevent a channel from playing 10 episodes of the same show in a row, the algorithm limits TV show blocks to **1 to 3 consecutive episodes** at a time.
- **State Tracking:** The scheduler keeps a running memory of exactly where it left off for every TV show. If it plays *Season 1, Episodes 1-3* of a show, the next time that show appears in the shuffled marathon, it will intelligently pick up at *Season 1, Episode 4*, carrying over into the next season automatically when necessary. 
- **Live Syncing:** The generated schedule is mapped against the current `Date.now()`, ensuring that if you tune away and tune back an hour later, the programming has progressed exactly as it would on real television.
