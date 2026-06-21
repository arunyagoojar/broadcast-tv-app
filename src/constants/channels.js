export const CHANNELS = [
  { id: 0, name: 'Recents', group: 'CORE GENRES' },
  { id: 1, name: 'Blockbuster Action', group: 'CORE GENRES' },
  { id: 2, name: 'Sci-Fi & Fantasy Epics', group: 'CORE GENRES' },
  { id: 3, name: 'Comedy Hits', group: 'CORE GENRES' },
  { id: 4, name: 'The Office (24/7)', group: 'CORE GENRES' },
  { id: 5, name: 'Friends (24/7)', group: 'CORE GENRES' },
  { id: 6, name: 'Premium Drama', group: 'CORE GENRES' },
  { id: 7, name: 'Horror & Thriller', group: 'CORE GENRES' },
  { id: 8, name: 'Animation Giants', group: 'CORE GENRES' },
  { id: 9, name: 'Adult Animation', group: 'CORE GENRES' },
  { id: 10, name: 'Musicals', group: 'SPECIAL & MOOD' },
  { id: 11, name: 'Superhero Cinema', group: 'CORE GENRES' },
  { id: 12, name: 'Crime & Mystery', group: 'CORE GENRES' },
  { id: 13, name: 'Nostalgia', group: 'SPECIAL & MOOD' },
  { id: 14, name: 'Hindi Cinema', group: 'HINDI' },
  { id: 16, name: 'Romance', group: 'SPECIAL & MOOD' }
];

export function getChannelById(id) {
  return CHANNELS.find(ch => ch.id === id);
}
