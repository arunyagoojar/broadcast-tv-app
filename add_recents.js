import fs from 'fs';
import https from 'https';

const dbPath = './src/constants/database.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const recentTitles = [
  "Dune: Part Two", "Oppenheimer", "Barbie", "Deadpool & Wolverine", 
  "Inside Out 2", "Furiosa: A Mad Max Saga", "The Fall Guy", "Civil War", 
  "Monkey Man", "Godzilla Minus One", "Spider-Man: Across the Spider-Verse", 
  "Mission: Impossible - Dead Reckoning", "John Wick: Chapter 4", 
  "The Super Mario Bros. Movie", "Guardians of the Galaxy Vol. 3", 
  "Avatar: The Way of Water", "Top Gun: Maverick", "The Batman", 
  "Everything Everywhere All at Once", "Challengers", "Kingdom of the Planet of the Apes", 
  "A Quiet Place: Day One", "Twisters", "Alien: Romulus", "Beetlejuice Beetlejuice"
];

async function fetchImdbId(title) {
  return new Promise((resolve) => {
    const query = encodeURIComponent(title.toLowerCase());
    const firstChar = query.charAt(0).toLowerCase();
    const url = `https://v3.sg.media-imdb.com/suggestion/x/${firstChar}/${query}.json`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed.d && parsed.d.length > 0) {
            for (const item of parsed.d) {
              if (item.id && item.id.startsWith("tt")) {
                const isTv = item.qid === "tvSeries" || item.qid === "tvMiniSeries";
                resolve({
                  id: item.id,
                  title: item.l,
                  type: isTv ? 'tv' : 'movie'
                });
                return;
              }
            }
          }
        } catch (e) {
          console.error(`Error parsing JSON for ${title}:`, e.message);
        }
        resolve(null);
      });
    }).on('error', (err) => {
      console.error(`Request error for ${title}:`, err.message);
      resolve(null);
    });
  });
}

async function run() {
  const channel0Content = [];
  console.log("Fetching IMDB IDs for Recents...");
  
  for (const title of recentTitles) {
    const result = await fetchImdbId(title);
    if (result) {
      channel0Content.push(result);
    }
    // Small delay to prevent rate limiting
    await new Promise(r => setTimeout(r, 200));
  }
  
  db["0"] = channel0Content;
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  console.log(`Updated database.json with ${channel0Content.length} Recent movies!`);
}

run();
