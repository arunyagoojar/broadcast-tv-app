import { useEffect, useRef, useState } from 'react';
import logos from '../constants/logos.json';

// IMDb IDs for specific TV shows so we can use their TMDB clearlogos
const CHANNEL_LOGO_IMDB = {
  'The Office (24/7)': 'tt0386676',
  'Friends (24/7)': 'tt0108778',
  'Everybody Loves Raymond': 'tt0115167',
  'The Big Bang Theory': 'tt0898266',
  'Game of Thrones': 'tt0944947',
  'The Vampire Diaries': 'tt1405406',
  'Impractical Jokers': 'tt2100976',
  'Louis C.K.': 'tt1492966',   // Louie
  'Family Guy': 'tt0182576',
  'The Simpsons': 'tt0096697',
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
  Featured: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
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
  Animation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5"/>
      <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5"/>
    </svg>
  ),
  'Heroes & Universes': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Hindi: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  'Streaming Services': (
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
    name: 'Featured',
    channels: ['Recents']
  },
  {
    name: 'Movies',
    channels: [
      'Blockbuster Action',
      'Sci-Fi & Fantasy Epics',
      'Premium Drama',
      'Horror & Thriller',
      'Crime & Mystery',
      'Romance',
      'Musicals',
      'Nostalgia',
      'Superhero Cinema'
    ]
  },
  {
    name: 'TV Shows',
    channels: [
      'The Office (24/7)',
      'Friends (24/7)',
      'Everybody Loves Raymond',
      'The Big Bang Theory',
      'Game of Thrones',
      'The Vampire Diaries',
      'Impractical Jokers',
      'Louis C.K.'
    ]
  },
  {
    name: 'Animation',
    channels: [
      'Animation Giants',
      'Adult Animation',
      'Family Guy',
      'The Simpsons',
      'Marvel Animation',
      'DC Animation'
    ]
  },
  {
    name: 'Heroes & Universes',
    channels: [
      'Marvel (Live Action)',
      'DC (Live Action)',
      'Marvel Animation',
      'DC Animation'
    ]
  },
  {
    name: 'Hindi',
    channels: [
      'Hindi Comedy',
      'Hindi OG Movies',
      'Hindi Nostalgia'
    ]
  },
  {
    name: 'Streaming Services',
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
    return channels.find(c => c.name === name || c.name.startsWith(name));
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
