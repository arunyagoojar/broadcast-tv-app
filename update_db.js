import fs from 'fs';

const dbPath = './src/constants/database.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Curated list of most popular Hindi movies that are highly likely to exist and play well
const popularHindiTitles = [
  "Dangal", "Baahubali: The Beginning", "Baahubali 2: The Conclusion", 
  "K.G.F: Chapter 1", "K.G.F: Chapter 2", "Pathaan", "Jawan", "RRR", 
  "3 Idiots", "PK", "Bajrangi Bhaijaan", "Sultan", "Sanju", "Padmaavat", 
  "Chennai Express", "Tiger Zinda Hai", "War", "Kabir Singh", "Gadar 2", 
  "Hera Pheri", "Phir Hera Pheri", "Golmaal: Fun Unlimited", "Golmaal 3", 
  "Golmaal Again", "Dhamaal", "Welcome", "Munna Bhai M.B.B.S.", "Lage Raho Munna Bhai", 
  "Andaz Apna Apna", "Bhagam Bhag", "Chup Chup Ke", "Hungama", "Garam Masala",
  "Sholay", "Dilwale Dulhania Le Jayenge", "Kabhi Khushi Kabhie Gham", "Zindagi Na Milegi Dobara"
];

// Combine movies from 14 and 15
const allHindiMovies = [];
if (db["14"]) allHindiMovies.push(...db["14"]);
if (db["15"]) allHindiMovies.push(...db["15"]);

// Filter to only the curated popular list to guarantee high playability
const curatedMovies = [];
for (const title of popularHindiTitles) {
  const found = allHindiMovies.find(m => m.title.toLowerCase().includes(title.toLowerCase()));
  if (found && !curatedMovies.find(m => m.id === found.id)) {
    curatedMovies.push(found);
  }
}

// Update the database
db["14"] = curatedMovies;
delete db["15"];

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log(`Updated database.json. Channel 14 now has ${curatedMovies.length} highly curated movies. Channel 15 deleted.`);
