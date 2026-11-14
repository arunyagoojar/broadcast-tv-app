const paths = {
  tv: ['M5 3l7 4 7-4', 'M3 7h18v14H3z', 'M8 17h8'],
  film: ['M3 7h18v14H3z', 'M3 11h18', 'M7 7l3-4M14 7l3-4'],
  laugh: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', 'M7 9l1-1 1 1M15 9l1-1 1 1', 'M7 13h10a5 5 0 0 1-10 0z'],
  compass: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', 'M16 8l-2 6-6 2 2-6z'],
  heart: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z'],
  orbit: ['M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0', 'M18.4 5.6c3.5 3.5 3.5 9.3 0 12.8s-9.3 3.5-12.8 0', 'M20 4C12-1-1 12 4 20S25 9 20 4z'],
  ghost: ['M4 21V10a8 8 0 0 1 16 0v11l-4-3-4 3-4-3z', 'M9 9v2M15 9v2'],
  search: ['M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0', 'M15 15l6 6'],
  shield: ['M12 3l8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6z', 'M9 12l2 2 4-4'],
  music: ['M9 18V5l12-2v13', 'M9 5v4l12-2', 'M9 18c0 2-6 4-6 1s6-4 6-1M21 16c0 2-6 4-6 1s6-4 6-1'],
  sparkle: ['M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z'],
  clock: ['M3 11a9 9 0 1 1 2 7', 'M3 3v8h8', 'M12 7v5l3 2'],
  family: ['M14 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M3 21v-3a6 6 0 0 1 12 0v3', 'M17 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3'],
  bolt: ['M13 2L4 14h7l-1 8 10-12h-7z'],
  mic: ['M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0z', 'M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8'],
  nature: ['M20 3C8 2 2 8 5 15s15 4 15-12z', 'M4 21L16 8'],
  waves: ['M2 6c3-4 5 4 8 0s5 4 8 0 4 0 4 0M2 12c3-4 5 4 8 0s5 4 8 0 4 0 4 0M2 18c3-4 5 4 8 0s5 4 8 0 4 0 4 0'],
  history: ['M3 9l9-6 9 6z', 'M5 9v11M10 9v11M14 9v11M19 9v11M2 21h20'],
  build: ['M3 21V8h8v13M11 21V3h10v18M6 11h2M6 15h2M15 7h2M15 11h2M15 15h2M1 21h22'],
  food: ['M8 11a4 4 0 1 1 0-8 5 5 0 0 1 8 0 4 4 0 1 1 0 8v9H8z', 'M8 16h8'],
  car: ['M3 11l2-6h14l2 6v9h-3v-3H6v3H3z', 'M3 11h18M7 14h1M16 14h1'],
  broadcast: ['M12 11v10M8 21h8', 'M9 7a4 4 0 0 1 6 0M6 4a8 8 0 0 1 12 0', 'M13 10a1 1 0 1 1-2 0 1 1 0 0 1 2 0'],
};

const genres = {
  Action: 'bolt', Adventure: 'compass', Comedy: 'laugh', Romance: 'heart',
  'Horror & Thriller': 'ghost', Crime: 'search', 'Sci-Fi': 'orbit', Fantasy: 'sparkle',
  Musicals: 'music', Nostalgia: 'clock', Family: 'family', Mystery: 'search',
  'Superhero Cinema': 'shield', 'Hindi Comedy': 'laugh', 'Hindi OG Movies': 'film',
  'Hindi Nostalgia': 'tv', 'Blue Planet': 'waves', 'Frozen Planet': 'nature',
  'History Channel': 'history', 'BBC History': 'history', 'Mega Builds': 'build',
  'Modern Marvels': 'build', 'Crime Documentaries': 'search', Cosmos: 'orbit',
  Universe: 'orbit', NASA: 'orbit', 'Kitchen Nightmares': 'food', "Hell's Kitchen": 'food',
  'Top Gear': 'car',
};

export default function ChannelIcon({ channel }) {
  const group = channel.group;
  const icon = genres[channel.name] || (
    group === 'MOVIES' ? 'film' : group === 'HEROES' ? 'shield'
      : group === 'SKETCH & STAND' ? 'mic' : group === 'ANIMATION' ? 'sparkle'
        : group === 'DOCUMENTARIES' ? 'nature' : group === 'NETWORKS' ? 'broadcast' : 'tv'
  );
  return <svg className="channel-fallback-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths[icon].map((path, index) => <path key={index} d={path} />)}
  </svg>;
}
