# Broadcast TV App 📺

A modern, immersive web application that simulates a classic television broadcast experience. Instead of endlessly scrolling through on-demand menus, users can simply "tune in" to continuous, curated channels (like Action, Comedy, Netflix Originals, or HBO Max) that are algorithmically scheduled and always running—just like real TV.

## 🌟 Brief Introduction

The Broadcast TV App brings the lean-back experience of traditional television to the modern streaming era. It features a sleek, glassmorphic UI, an authentic on-screen display (OSD) HUD, and dynamic channel grids. When a user selects a channel, they drop right into the middle of a continuous marathon of shows or movies, complete with static overlay noise and retro channel-switching animations.

## ⚙️ How the Solution Works

At its core, the app operates as a **virtual programming scheduler**. It doesn't host video files. Instead:
1. It loads a static, pre-compiled database of movies and TV shows assigned to specific channels.
2. It uses a custom scheduling algorithm to generate a 24/7 timeline of programming for every channel.
3. Based on the user's local real-world time, it determines exactly what show/movie and what specific episode should be playing *right now*.
4. It dynamically searches and plays the corresponding content using the YouTube iFrame API, seamlessly syncing the video to the calculated broadcast timestamp.

## 🔌 APIs We Are Using

The project relies on a combination of metadata APIs and streaming APIs:

- **IMDb Suggestion API** (`v3.sg.media-imdb.com`): Used during the database build step to quickly resolve string titles (e.g., "Breaking Bad") into canonical `tt` IDs and classify them accurately as either a `movie` or `tvSeries`.
- **TVMaze API** (`api.tvmaze.com`): Used to fetch the internal structure of TV shows. It determines exactly how many seasons a show has, and the maximum number of episodes in each specific season.
- **YouTube iFrame Player API** (via `react-youtube`): Used as the actual video rendering engine. The app dynamically passes search queries (e.g., "The Sopranos S02E04") to the player to simulate the broadcast.

## 🔇 Tackling Challenges: Autoplay & Mute/Unmute

Modern web browsers enforce strict **Autoplay Policies**, meaning video cannot automatically play with sound unless the user has explicitly interacted with the webpage. 

To create a seamless "turn on the TV" experience without the browser blocking playback:
1. **Muted Autoplay:** The YouTube iFrame is initialized with `player.mute()`. Browsers always allow muted video to autoplay.
2. **First-Click Interception:** The app listens for the user's very first click anywhere on the interface (such as opening the Explore menu or clicking the screen). 
3. **Seamless Unmute:** Upon that first interaction, the app immediately calls `player.unMute()`. This perfectly satisfies the browser's interaction requirement while feeling completely natural to the user.

## 📡 Creating the Channels

Channels are defined in a static configuration file (`src/constants/channels.js`). They are categorized into distinct groups:
- **Core:** Standard genres (Action, Comedy, Drama).
- **Moods:** Thematic channels (Nostalgia, Romance, Musicals, Marvel, DC).
- **Streaming Platforms:** Network-specific channels featuring exact SVG brand logos and colors (Netflix, HBO, Disney+, Prime Video, Apple TV+, Hulu, Paramount+, Peacock).

Each channel is assigned a curated array of string titles representing the shows and movies that belong on that network.

## 🗄️ Fetching & Storing Shows and Movies

To avoid rate-limiting and ensure lightning-fast load times, the app uses a **Static Pre-fetching Architecture**:

1. **`fetch_db.js` (The Scraper):** A Node.js utility script reads the raw titles from the channel configuration.
2. **Metadata Enrichment:** For every title, it hits the IMDb API to get the ID/Type. If it's a TV show, it subsequently hits the TVMaze API to map out its entire season and episode architecture.
3. **`database.json` (The Storage):** The script writes all this rich, nested metadata into `src/constants/database.json`.
4. **Runtime Access:** The React application imports `database.json` directly. This means the app has an instantaneous, local database of thousands of episodes and movies without ever needing to make slow network requests on initial load.

*(Note: If a dynamically requested title is missing from the JSON, `src/api/channels.js` features a fallback mechanism to fetch the metadata on-the-fly and cache it in the browser's `localStorage`.)*

## ⏱️ The Scheduling Algorithm

The heart of the broadcast simulation is the `generateConsecutiveEpisodes` algorithm:

- **Shuffling & Interleaving:** It takes the channel's local database and shuffles it. It seamlessly interleaves singular movie blocks with multi-episode TV show blocks.
- **Anti-Monotony Grouping:** To prevent a channel from playing 10 episodes of the same show in a row, the algorithm limits TV show blocks to **1 to 3 consecutive episodes** at a time.
- **State Tracking:** The scheduler keeps a running memory of exactly where it left off for every TV show. If it plays *Season 1, Episodes 1-3* of a show, the next time that show appears in the shuffled marathon, it will intelligently pick up at *Season 1, Episode 4*, carrying over into the next season automatically when necessary. 
- **Live Syncing:** The generated schedule is mapped against the current `Date.now()`, ensuring that if you tune away and tune back an hour later, the programming has progressed exactly as it would on real television.
