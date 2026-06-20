export const CHANNELS = [
  { id: 1, name: 'Blockbuster Action', group: 'CORE GENRES', keywords: ['Avengers', 'Mission Impossible', 'Fast and Furious', 'James Bond', 'Transformers'] },
  { id: 2, name: 'Sci-Fi & Fantasy Epics', group: 'CORE GENRES', keywords: ['Star Wars', 'Harry Potter', 'Lord of the Rings', 'Matrix', 'Dune'] },
  { id: 3, name: 'Comedy Hits', group: 'CORE GENRES', keywords: ['The Hangover', 'Superbad', 'Dumb and Dumber', 'Step Brothers', 'Grown Ups'] },
  { id: 4, name: 'The Office (24/7)', group: 'CORE GENRES', imdbIds: ['tt0386676'], keywords: [] },
  { id: 5, name: 'Friends (24/7)', group: 'CORE GENRES', imdbIds: ['tt0108778'], keywords: [] },
  { id: 6, name: 'Premium Drama', group: 'CORE GENRES', keywords: ['Breaking Bad tv', 'Game of Thrones tv', 'Stranger Things', 'Better Call Saul tv', 'The Boys tv'] },
  { id: 7, name: 'Horror & Thriller', group: 'CORE GENRES', keywords: ['The Conjuring', 'Saw', 'Halloween', 'Scream', 'Insidious'] },
  { id: 8, name: 'Animation Giants', group: 'CORE GENRES', keywords: ['Toy Story', 'Shrek', 'Despicable Me', 'Frozen', 'Finding Nemo'] },
  { id: 9, name: 'Adult Animation', group: 'CORE GENRES', keywords: ['Rick and Morty', 'South Park', 'Family Guy', 'Simpsons', 'Futurama'] },
  { id: 10, name: 'Musicals', group: 'SPECIAL & MOOD', keywords: ['The Greatest Showman', 'La La Land', 'Mamma Mia', 'Les Miserables', 'High School Musical'] },
  { id: 11, name: 'Superhero Cinema', group: 'CORE GENRES', keywords: ['Batman', 'Spider-Man', 'Superman', 'X-Men', 'Iron Man'] },
  { id: 12, name: 'Crime & Mystery', group: 'CORE GENRES', keywords: ['Sherlock', 'Knives Out', 'Prison Break', 'Peaky Blinders', 'Mindhunter'] },
  { id: 13, name: 'Nostalgia / Throwback', group: 'SPECIAL & MOOD', keywords: ['Jurassic Park', 'Back to the Future', 'Indiana Jones', 'Ghostbusters', 'Terminator'] },
  { id: 14, name: 'Hindi Blockbusters', group: 'HINDI', keywords: ['Dangal', 'Baahubali', 'KGF', 'Pathaan', 'Jawan'] },
  { id: 15, name: 'Hindi Classic Comedy', group: 'HINDI', keywords: ['Hera Pheri', 'Golmaal', 'Dhamaal', 'Welcome', 'Munna Bhai'] },
  { id: 16, name: 'Romance & Date Night', group: 'SPECIAL & MOOD', keywords: ['The Notebook', 'Titanic', 'Twilight', 'Crazy Rich Asians', 'Notting Hill'] }
];

export function getChannelById(id) {
  return CHANNELS.find(ch => ch.id === id);
}

export function getRandomKeyword(channel) {
  const words = channel.keywords;
  return words[Math.floor(Math.random() * words.length)];
}
