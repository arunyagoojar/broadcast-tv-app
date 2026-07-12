import { useEffect, useRef, useState } from 'react';
import logos from '../constants/logos.json';
import channelPosters from '../constants/channelPosters.json';

// IMDb IDs for specific TV shows so we can use their TMDB clearlogos
const CHANNEL_LOGO_IMDB = {
  'The Office (24/7)': 'tt0386676',
  'Friends (24/7)': 'tt0108778',
  'Everybody Loves Raymond': 'tt0115167',
  'The Big Bang Theory': 'tt0898266',
  'Impractical Jokers': 'tt2100976',
  'Family Guy': 'tt0182576',
  'The Simpsons': 'tt0096697',
  'Mr. Bean': 'tt0096657',
  'Brooklyn Nine-Nine': 'tt2467372',
  'Parks and Recreation': 'tt1266020',
  'Modern Family': 'tt1442437',
  'How I Met Your Mother': 'tt0460649',
  'Seinfeld': 'tt0098904',
  'Malcolm in the Middle': 'tt0212671',
  'Community': 'tt1439629',
  'Two and a Half Men': 'tt0369179',
  'Fresh Prince of Bel-Air': 'tt0098800',
  'Louie': 'tt1492966',
  'Key & Peele': 'tt1981558',
  'Saturday Night Live': 'tt0072562',
  'Whose Line Is It Anyway?': 'tt2919910',
  "Monty Python's Flying Circus": 'tt0063929',
  "Chappelle's Show": 'tt0353049',
  'I Think You Should Leave with Tim Robinson': 'tt10050772',
  'Tom & Jerry': 'tt3559124',
  'Looney Tunes': 'tt1726839',
  'Scooby-Doo': 'tt0063950',
  'Popeye': 'tt0145628',
  'Futurama': 'tt0149460',
  "Bob's Burgers": 'tt1561755',
  'King of the Hill': 'tt0118375',
  'Adventure Time': 'tt1305826',
  'Courage the Cowardly Dog': 'tt0220880',
  'Pokemon': 'tt0168366',
  'Dragon Ball': 'tt0121220',
  'Invincible': 'tt6741278',
  'The Boys': 'tt1190634',
  'Watchmen': 'tt7049682',
  'Planet Earth': 'tt0795176',
  'Blue Planet': 'tt0296310',
  'Prehistoric Planet': 'tt10324164',
  'Frozen Planet': 'tt2092588',
  'Cosmos': 'tt2395695',
  'NOVA': 'tt0206501',
  'Modern Marvels': 'tt0199248',
  'Universe': 'tt1051155',
  'MythBusters': 'tt0383126',
  'Kitchen Nightmares': 'tt0983514',
  "Hell's Kitchen": 'tt0437005',
  'Top Gear': 'tt1628033',
};

// Map channel name → horizontal logo image url (for franchise channels)
const FRANCHISE_LOGOS = {
  'Marvel (Live Action)': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Marvel_Logo.svg/1200px-Marvel_Logo.svg.png',
  'Marvel Animation': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Marvel_Logo.svg/1200px-Marvel_Logo.svg.png',
  'DC (Live Action)': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/DC_Comics_logo.svg/1200px-DC_Comics_logo.svg.png',
  'DC Animation': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/DC_Comics_logo.svg/1200px-DC_Comics_logo.svg.png',
};

// Category icon SVGs (premium, themed icons)
const CATEGORY_ICONS = {
  Movies: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    </svg>
  ),
  'TV Shows': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="15" rx="2" />
      <polyline points="17 2 12 7 7 2" />
    </svg>
  ),
  'Sketch & Stand': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ),
  Animation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <line x1="9" y1="9" x2="9.01" y2="9"/>
      <line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>
  ),
  Heroes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Documentaries: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  Networks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
      <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
      <circle cx="12" cy="20" r="1" fill="currentColor"/>
    </svg>
  ),
};

// Streaming service logos (horizontal)
const STREAMING_LOGOS = {
  'Netflix': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Netflix_2015_logo.svg/800px-Netflix_2015_logo.svg.png',
  'HBO': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/HBO_logo.svg/800px-HBO_logo.svg.png',
  'Disney+': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Disney%2B_logo.svg/800px-Disney%2B_logo.svg.png',
  'Prime Video': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo.svg/800px-Amazon_Prime_Video_logo.svg.png',
  'Apple TV+': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Apple_TV_Plus_Logo.svg/800px-Apple_TV_Plus_Logo.svg.png',
  'Hulu': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Hulu_Logo.svg/800px-Hulu_Logo.svg.png',
  'Paramount+': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Paramount_Plus_logo.svg/800px-Paramount_Plus_logo.svg.png',
  'Peacock': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/NBCUniversal_Peacock_Logo.svg/800px-NBCUniversal_Peacock_Logo.svg.png',
};

const CATEGORIES = [
  {
    name: 'Movies',
    channels: [
      'Action',
      'Adventure',
      'Comedy',
      'Romance',
      'Horror & Thriller',
      'Crime',
      'Sci-Fi',
      'Fantasy',
      'Musicals',
      'Nostalgia',
      'Family',
      'Mystery',
      'Superhero Cinema',
      'Hindi Comedy',
      'Hindi OG Movies',
      'Hindi Nostalgia'
    ]
  },
  {
    name: 'TV Shows',
    channels: [
      'Friends (24/7)',
      'The Office (24/7)',
      'Everybody Loves Raymond',
      'The Big Bang Theory',
      'Impractical Jokers',
      'Mr. Bean',
      'Brooklyn Nine-Nine',
      'Parks and Recreation',
      'Modern Family',
      'How I Met Your Mother',
      'Seinfeld',
      'Malcolm in the Middle',
      'Community',
      'Two and a Half Men',
      'Fresh Prince of Bel-Air',
      'Louie'
    ]
  },
  {
    name: 'Sketch & Stand',
    channels: [
      'Stand-Up',
      'Key & Peele',
      'Saturday Night Live',
      'Whose Line Is It Anyway?',
      "Monty Python's Flying Circus",
      "Chappelle's Show",
      'I Think You Should Leave with Tim Robinson'
    ]
  },
  {
    name: 'Animation',
    channels: [
      'Animation Giants',
      'Family Guy',
      'The Simpsons',
      'Tom & Jerry',
      'Looney Tunes',
      'Scooby-Doo',
      'Popeye',
      'Futurama',
      "Bob's Burgers",
      'King of the Hill',
      'Adventure Time',
      'Courage the Cowardly Dog',
      'Pokemon',
      'Dragon Ball'
    ]
  },
  {
    name: 'Heroes',
    channels: [
      'Marvel (Live Action)',
      'DC (Live Action)',
      'Marvel Animation',
      'DC Animation',
      'Invincible',
      'The Boys',
      'Watchmen'
    ]
  },
  {
    name: 'Documentaries',
    channels: [
      'Planet Earth',
      'Blue Planet',
      'Prehistoric Planet',
      'Frozen Planet',
      'Cosmos',
      'NOVA',
      'History Channel',
      'BBC History',
      'Mega Builds',
      'Modern Marvels',
      'Crime Documentaries',
      'Universe',
      'NASA',
      'MythBusters',
      'Kitchen Nightmares',
      "Hell's Kitchen",
      'Top Gear'
    ]
  },
  {
    name: 'Networks',
    channels: [
      'Netflix',
      'HBO',
      'Disney+',
      'Prime Video',
      'Apple TV+',
      'Hulu',
      'Paramount+',
      'Peacock'
    ]
  }
];

function getChannelLogoUrl(channelName) {
  // Check franchise logos first (Marvel, DC)
  if (FRANCHISE_LOGOS[channelName]) return FRANCHISE_LOGOS[channelName];
  // Check streaming logos
  if (STREAMING_LOGOS[channelName]) return STREAMING_LOGOS[channelName];
  // Check TV show TMDB logos
  const imdbId = CHANNEL_LOGO_IMDB[channelName];
  if (imdbId && logos[imdbId]) return logos[imdbId];
  return null;
}

export default function LeftMenu({ isOpen, onClose, channels, activeChannelId, onSelect, openSettings }) {
  const menuRef = useRef(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [displayCategory, setDisplayCategory] = useState(null);

  // Reset category view when menu closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setActiveCategory(null);
        setDisplayCategory(null);
      }, 300);
    }
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (isOpen && menuRef.current && !menuRef.current.contains(event.target)) {
        if (!event.target.closest('.hud-btn-menu-toggle')) {
          onClose();
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleShuffle = () => {
    if (channels && channels.length > 0) {
      const randomIndex = Math.floor(Math.random() * channels.length);
      onSelect(channels[randomIndex].id);
    }
  };

  const handleCategoryClick = (category) => {
    setDisplayCategory(category);
    requestAnimationFrame(() => {
      setActiveCategory(category);
    });
  };

  const handleBackClick = () => {
    setActiveCategory(null);
    setTimeout(() => {
      setDisplayCategory(null);
    }, 300);
  };

  const getChannelByName = (name) => {
    return channels.find(c => c.name === name) || channels.find(c => c.name.startsWith(name));
  };

  return (
    <div className={`left-menu-container ${isOpen ? 'open' : ''}`}>
      <div className="left-menu-perspective">
        <div className="left-menu" ref={menuRef}>
          <div className="left-menu-header">
            <button className="left-menu-item shuffle-btn" onClick={handleShuffle} style={{ width: '100%', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.1)', marginTop: '8px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px', marginRight: '8px' }}>
                <polyline points="16 3 21 3 21 8" />
                <line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21 16 21 21 16 21" />
                <line x1="15" y1="15" x2="21" y2="21" />
                <line x1="4" y1="4" x2="9" y2="9" />
              </svg>
              <span className="channel-name" style={{ fontWeight: '600' }}>Shuffle Channels</span>
            </button>
          </div>
          
          <div className="left-menu-content" style={{ position: 'relative', overflowX: 'hidden' }}>
            
            {/* Categories View */}
            <div 
              style={{ 
                transition: 'transform 300ms ease, opacity 300ms ease',
                transform: activeCategory ? 'translateX(-100%)' : 'translateX(0)',
                opacity: activeCategory ? 0 : 1,
                position: activeCategory ? 'absolute' : 'relative',
                width: '100%',
                pointerEvents: activeCategory ? 'none' : 'auto'
              }}
            >
              <div className="left-menu-list">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.name}
                    className="left-menu-item"
                    onClick={() => handleCategoryClick(category)}
                  >
                    <div className="channel-icon" style={{ background: 'transparent' }}>
                      {CATEGORY_ICONS[category.name]}
                    </div>
                    <span className="channel-name">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Channels View */}
            <div 
              style={{ 
                transition: 'transform 300ms ease, opacity 300ms ease',
                transform: activeCategory ? 'translateX(0)' : 'translateX(100%)',
                opacity: activeCategory ? 1 : 0,
                position: activeCategory ? 'relative' : 'absolute',
                top: 0,
                width: '100%',
                pointerEvents: activeCategory ? 'auto' : 'none'
              }}
            >
              {displayCategory && (
                <>
                  <button 
                    onClick={handleBackClick}
                    className="left-menu-item"
                    style={{ marginBottom: '16px', padding: '12px 8px', background: 'transparent' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px', marginRight: '8px' }}>
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <span className="channel-name" style={{ fontWeight: '600' }}>Back to Categories</span>
                  </button>
                  
                  <div className="left-menu-group-label" style={{ paddingLeft: '8px', marginBottom: '12px', color: '#fff' }}>
                    {displayCategory.name}
                  </div>
                  
                  <div className="left-menu-list">
                    {displayCategory.channels.map(channelName => {
                      const channel = getChannelByName(channelName);
                      if (!channel) return null;
                      
                      const isActive = channel.id === activeChannelId;
                      const logoUrl = getChannelLogoUrl(channelName);
                      const posterUrl = channelPosters[channelName];

                      return (
                        <button
                          key={channel.id}
                          className={`left-menu-item ${isActive ? 'active' : ''}`}
                          onClick={() => onSelect(channel.id)}
                        >
                          {logoUrl ? (
                            <div className="channel-icon" style={{ background: 'transparent', overflow: 'visible', flexShrink: 0 }}>
                              <img
                                src={logoUrl}
                                alt={channelName}
                                loading="lazy"
                                decoding="async"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'contain',
                                  filter: 'brightness(0) invert(1)',
                                  opacity: isActive ? 1 : 0.75
                                }}
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }}
                              />
                            </div>
                          ) : posterUrl ? (
                            <div className="channel-icon" style={{ background: 'transparent', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                              <img
                                src={posterUrl}
                                alt={channelName}
                                loading="lazy"
                                decoding="async"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  opacity: isActive ? 1 : 0.85
                                }}
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }}
                              />
                              <div className="channel-icon" style={{ display: 'none', position: 'absolute', inset: 0 }}>
                                {channel.name.charAt(0).toUpperCase()}
                              </div>
                            </div>
                          ) : (
                            <div className="channel-icon">
                              {channel.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="channel-name">{channel.name.replace(' (24/7)', '')}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

          </div>

          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button className="left-menu-item" onClick={openSettings} style={{ width: '100%' }}>
              <div className="channel-icon" style={{ background: 'transparent' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </div>
              <span className="channel-name">Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
