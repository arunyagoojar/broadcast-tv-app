import { useEffect, useRef, useState } from 'react';
import ChannelIcon from './ChannelIcon';
import { NEW_SHOW_CHANNELS } from '../constants/catalogAdditions';

// Category icon SVGs (premium, themed icons)
const CATEGORY_ICONS = {
  'Recently Watched': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 3 3 9 9 9" />
      <polyline points="12 7 12 12 15 14" />
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
      'Sony Superheroes',
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

for (const channel of NEW_SHOW_CHANNELS) {
  const category = CATEGORIES.find((entry) => entry.name === (channel.group === 'ANIMATION' ? 'Animation' : 'TV Shows'));
  if (!category.channels.includes(channel.name)) category.channels.push(channel.name);
}

export default function LeftMenu({
  isOpen,
  channels,
  activeChannelId,
  onSelect,
  openSettings,
  recentChannelIds,
  sleepTimerMinutes,
  sleepTimerDuration,
  onSetSleepTimer,
  onCancelSleepTimer,
}) {
  const categoryResetTimer = useRef(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [displayCategory, setDisplayCategory] = useState(null);
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);
  const [visitedCategories, setVisitedCategories] = useState([]);

  const recentChannels = (recentChannelIds || [])
    .map((id) => channels.find((channel) => channel.id === id))
    .filter(Boolean);
  const menuCategories = recentChannels.length
    ? [{ name: 'Recently Watched', channels: recentChannels.map((channel) => channel.name) }, ...CATEGORIES]
    : CATEGORIES;

  // Reset category view when menu closes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setActiveCategory(null);
        setDisplayCategory(null);
        setSleepMenuOpen(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleShuffle = () => {
    if (channels && channels.length > 0) {
      const playable = channels.filter((channel) => channel.id !== 0);
      const randomIndex = Math.floor(Math.random() * playable.length);
      if (playable.length) onSelect(playable[randomIndex].id);
    }
  };

  const handleCategoryClick = (category) => {
    clearTimeout(categoryResetTimer.current);
    setVisitedCategories((current) => current.includes(category.name) ? current : [...current, category.name]);
    setDisplayCategory(category);
    requestAnimationFrame(() => {
      setActiveCategory(category);
    });
  };

  const handleBackClick = () => {
    setActiveCategory(null);
    categoryResetTimer.current = setTimeout(() => {
      setDisplayCategory(null);
    }, 300);
  };

  useEffect(() => () => clearTimeout(categoryResetTimer.current), []);

  const getChannelByName = (name) => {
    return channels.find(c => c.name === name) || channels.find(c => c.name.startsWith(name));
  };

  return (
    <div className="menu-content-page">
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
              data-menu-page={activeCategory ? 'inactive' : 'active'}
              data-menu-level="categories"
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
                {menuCategories.map((category) => (
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
              data-menu-page={activeCategory ? 'active' : 'inactive'}
              data-menu-level="channels"
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
              {menuCategories.filter((category) => visitedCategories.includes(category.name)).map((category) => (
                <div key={category.name} hidden={displayCategory?.name !== category.name}>
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
                    {category.name}
                  </div>
                  
                  <div className="left-menu-list">
                    {category.channels.map(channelName => {
                      const channel = getChannelByName(channelName);
                      if (!channel) return null;
                      
                      const isActive = channel.id === activeChannelId;

                      return (
                        <button
                          key={channel.id}
                          className={`left-menu-item ${isActive ? 'active' : ''}`}
                          onClick={() => onSelect(channel.id)}
                        >
                          <div className="channel-icon channel-icon-art" style={{ flexShrink: 0 }}>
                            <ChannelIcon channel={channel} />
                          </div>
                          <span className="channel-name">{channel.name.replace(' (24/7)', '')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

          </div>

          <div className="left-menu-footer">
            <button className="left-menu-item" onClick={openSettings}>
              <div className="channel-icon" style={{ background: 'transparent' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </div>
              <span className="channel-name">Settings</span>
            </button>
            <div className="sleep-timer-wrap">
              <button
                className={`sleep-timer-trigger${sleepTimerMinutes ? ' active' : ''}${sleepMenuOpen ? ' open' : ''}`}
                aria-label={sleepTimerMinutes ? `Sleep timer, ${sleepTimerMinutes} minutes remaining` : 'Sleep timer'}
                aria-expanded={sleepMenuOpen}
                onClick={() => setSleepMenuOpen((open) => !open)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 16 14" />
                </svg>
                {sleepTimerMinutes && <span key={sleepTimerMinutes}>{sleepTimerMinutes}</span>}
              </button>
              {sleepMenuOpen && (
                <div className="sleep-timer-menu" role="menu" aria-label="Sleep timer duration">
                  {[30, 60, 90, 120].map((minutes) => (
                    <button
                      key={minutes}
                      role="menuitem"
                      className={sleepTimerDuration === minutes ? 'active' : ''}
                      onClick={() => {
                        onSetSleepTimer(minutes);
                        setSleepMenuOpen(false);
                      }}
                    >
                      {minutes} MIN
                    </button>
                  ))}
                  {sleepTimerMinutes && (
                    <button
                      type="button"
                      role="menuitem"
                      className="sleep-timer-remove"
                      onClick={() => {
                        onCancelSleepTimer();
                        setSleepMenuOpen(false);
                      }}
                    >
                      REMOVE TIMER
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
    </div>
  );
}
