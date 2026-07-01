import { useMemo, useState, useRef, useEffect } from 'react';
import { PlatformLogo } from '../constants/logos';

const SHORTCUTS = [
  ['ARROWS', 'CHANNELS'],
  ['S / /', 'EXPLORE'],
  ['C', 'THEME'],
  ['O', 'OVERLAY'],
  ['F', 'FULLSCREEN'],
];

function themeLabel(theme) {
  return theme ? theme.replace('theme-', '').toUpperCase() : 'CLASSIC';
}

export default function ChannelModal({
  isOpen,
  onClose,
  onSelect,
  channels,
  settings,
  updateSetting,
  themes,
}) {
  const groups = useMemo(() => channels.reduce((acc, channel) => {
    const group = channel.group || 'CHANNELS';
    if (!acc[group]) acc[group] = [];
    acc[group].push(channel);
    return acc;
  }, {}), [channels]);

  const groupNames = Object.keys(groups);
  const [activeGroup, setActiveGroup] = useState(groupNames[0] || '');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const visibleGroup = groups[activeGroup] ? activeGroup : groupNames[0];
  const currentThemeIndex = Math.max(0, themes.indexOf(settings.theme));
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const panelRef = useRef(null);
  const previousHeight = useRef('auto');

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [visibleGroup, channels]);

  useEffect(() => {
    if (panelRef.current && isOpen) {
      const currentHeight = panelRef.current.offsetHeight;
      if (previousHeight.current !== 'auto' && previousHeight.current !== currentHeight) {
        panelRef.current.style.height = `${previousHeight.current}px`;
        panelRef.current.style.transition = 'none';
        
        void panelRef.current.offsetHeight; // Force reflow
        
        panelRef.current.style.transition = 'height 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)';
        panelRef.current.style.height = `${currentHeight}px`;
        
        setTimeout(() => {
          if (panelRef.current) {
            panelRef.current.style.height = 'auto';
            panelRef.current.style.transition = 'none';
          }
        }, 350);
      }
      previousHeight.current = currentHeight;
    } else {
      previousHeight.current = 'auto';
    }
  }, [visibleGroup, channels, isOpen]);

  const scrollGridBy = (offset) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      setTimeout(checkScroll, 350);
    }
  };

  const cycleTheme = () => {
    updateSetting('theme', themes[(currentThemeIndex + 1) % themes.length]);
  };

  return (
    <div className={`search-modal ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className="search-panel explore-panel" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <div>
            <div className="search-title">EXPLORE</div>
            <div className="explore-subtitle">{visibleGroup}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="search-close-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
            <button className="search-close-btn" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="explore-groups">
          {groupNames.map((group) => (
            <button
              key={group}
              className={`explore-group-btn${group === visibleGroup ? ' active' : ''}`}
              onClick={() => setActiveGroup(group)}
            >
              {group}
            </button>
          ))}
        </div>

        <div className="explore-carousel-wrap">
          <button 
            className={`carousel-arrow left ${!canScrollLeft ? 'hidden' : ''}`}
            onClick={() => scrollGridBy(-400)}
            aria-label="Scroll left"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          
          <div className="explore-channel-grid" key={visibleGroup} ref={scrollRef} onScroll={checkScroll}>
            {(groups[visibleGroup] || []).map((ch, index) => {
              const displayName = ch.name.replace(' (24/7)', '');
              return (
                <button
                  key={ch.id}
                  className={`explore-channel-btn ${ch.group === 'STREAMING PLATFORMS' ? 'streaming-btn' : ''}`}
                  data-platform={ch.group === 'STREAMING PLATFORMS' ? displayName : undefined}
                  onClick={() => onSelect(ch.id)}
                >
                  {ch.group !== 'STREAMING PLATFORMS' && (
                    <span className="explore-channel-num">{String(index + 1).padStart(2, '0')}</span>
                  )}
                  <span className="explore-channel-copy">
                    <span className="explore-channel-name">
                      {ch.group === 'STREAMING PLATFORMS' ? (
                        <PlatformLogo name={displayName} className="platform-logo-img" />
                      ) : (
                        displayName
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <button 
            className={`carousel-arrow right ${!canScrollRight ? 'hidden' : ''}`}
            onClick={() => scrollGridBy(400)}
            aria-label="Scroll right"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>



        <div className={`settings-overlay ${settingsOpen ? 'open' : ''}`} onClick={() => setSettingsOpen(false)}>
          <div className="settings-popup" onClick={(e) => e.stopPropagation()}>
            <div className="settings-popup-header">
              <span className="settings-popup-title">TV SETTINGS</span>
              <button className="settings-popup-close" onClick={() => setSettingsOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="explore-settings">
              <label className="setting-row">
                <span>OVERLAY</span>
                <input
                  type="range"
                  min="0.2"
                  max="1"
                  step="0.02"
                  value={settings.overlayOpacity}
                  onChange={(event) => updateSetting('overlayOpacity', Number(event.target.value))}
                />
              </label>

              <div className="settings-grid compact">
                <button
                  className={`setting-toggle${settings.scanlines ? ' active' : ''}`}
                  onClick={() => updateSetting('scanlines', !settings.scanlines)}
                >
                  SCANLINES
                </button>
                <button
                  className={`setting-toggle${settings.vignette ? ' active' : ''}`}
                  onClick={() => updateSetting('vignette', !settings.vignette)}
                >
                  VIGNETTE
                </button>
                <button className="setting-toggle active" onClick={cycleTheme}>
                  {themeLabel(settings.theme)}
                </button>
              </div>

              <div style={{ marginTop: '4px' }}>
                <div className="section-label">KEYBOARD SHORTCUTS</div>
                <div className="shortcut-strip">
                  {SHORTCUTS.map(([key, label]) => (
                    <span key={key}><b>{key}</b> {label}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
