import { useEffect, useRef } from 'react';

const SHORTCUTS = [
  ['ARROWS', 'CHANNELS'],
  ['C', 'THEME'],
  ['F', 'FULLSCREEN'],
];

function themeLabel(theme) {
  return theme ? theme.replace('theme-', '').toUpperCase() : 'CLASSIC';
}

export default function SettingsMenu({
  isOpen,
  onClose,
  settings,
  updateSetting,
  themes,
}) {
  const menuRef = useRef(null);
  const currentThemeIndex = Math.max(0, themes.indexOf(settings.theme));

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (isOpen && menuRef.current && !menuRef.current.contains(event.target)) {
        if (!event.target.closest('.left-menu-item')) {
          onClose();
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const cycleTheme = () => {
    updateSetting('theme', themes[(currentThemeIndex + 1) % themes.length]);
  };

  const logoMode = settings.logoMode !== false; // default true = show logo

  return (
    <div className={`left-menu-container ${isOpen ? 'open' : ''}`}>
      <div className="left-menu-perspective">
        <div className="left-menu" ref={menuRef}>
          
          <div className="left-menu-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="channel-name" style={{ fontWeight: '600' }}>TV Settings</span>
            <button className="left-menu-item" onClick={onClose} style={{ padding: '8px', background: 'transparent', width: 'auto' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          
          <div className="left-menu-content">

            {/* TITLE DISPLAY */}
            <div style={{ marginBottom: '24px' }}>
              <div className="left-menu-group-label" style={{ marginBottom: '8px' }}>TITLE DISPLAY</div>
              <div className="left-menu-list">
                <button
                  className={`left-menu-item ${logoMode ? 'active' : ''}`}
                  onClick={() => updateSetting('logoMode', true)}
                  style={{ justifyContent: 'space-between' }}
                >
                  <span className="channel-name">Logo</span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: logoMode ? '#fff' : 'transparent', border: '1px solid rgba(255,255,255,0.4)' }} />
                </button>
                <button
                  className={`left-menu-item ${!logoMode ? 'active' : ''}`}
                  onClick={() => updateSetting('logoMode', false)}
                  style={{ justifyContent: 'space-between' }}
                >
                  <span className="channel-name">Text Only</span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: !logoMode ? '#fff' : 'transparent', border: '1px solid rgba(255,255,255,0.4)' }} />
                </button>
              </div>
            </div>

            {/* ASPECT RATIO */}
            <div style={{ marginBottom: '24px' }}>
              <div className="left-menu-group-label" style={{ marginBottom: '8px' }}>ASPECT RATIO</div>
              <div className="left-menu-list">
                {[
                  { value: '16-9', label: '16 : 9', sub: 'Widescreen (default)' },
                  { value: '4-3',  label: '4 : 3',  sub: 'Classic TV' },
                  { value: '21-9', label: '21 : 9', sub: 'Cinematic' },
                  { value: 'full', label: 'Full',   sub: 'Stretch to fill' },
                ].map(({ value, label, sub }) => {
                  const active = (settings.aspectRatio || '16-9') === value;
                  return (
                    <button
                      key={value}
                      className={`left-menu-item ${active ? 'active' : ''}`}
                      onClick={() => updateSetting('aspectRatio', value)}
                      style={{ justifyContent: 'space-between' }}
                    >
                      <div>
                        <span className="channel-name">{label}</span>
                        <div style={{ fontSize: '9px', opacity: 0.45, marginTop: '2px', letterSpacing: '0.05em' }}>{sub}</div>
                      </div>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: active ? '#fff' : 'transparent', border: '1px solid rgba(255,255,255,0.4)', flexShrink: 0 }} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* APPEARANCE */}
            <div style={{ marginBottom: '24px' }}>
              <div className="left-menu-group-label" style={{ marginBottom: '8px' }}>APPEARANCE</div>
              <div className="left-menu-list">
                <button
                  className={`left-menu-item ${settings.scanlines ? 'active' : ''}`}
                  onClick={() => updateSetting('scanlines', !settings.scanlines)}
                  style={{ justifyContent: 'space-between' }}
                >
                  <span className="channel-name">Scanlines</span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: settings.scanlines ? '#fff' : 'transparent', border: '1px solid rgba(255,255,255,0.4)' }} />
                </button>
                <button
                  className={`left-menu-item ${settings.vignette ? 'active' : ''}`}
                  onClick={() => updateSetting('vignette', !settings.vignette)}
                  style={{ justifyContent: 'space-between' }}
                >
                  <span className="channel-name">Vignette</span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: settings.vignette ? '#fff' : 'transparent', border: '1px solid rgba(255,255,255,0.4)' }} />
                </button>
                <button 
                  className="left-menu-item" 
                  onClick={cycleTheme}
                  style={{ justifyContent: 'space-between' }}
                >
                  <span className="channel-name">Theme</span>
                  <span className="channel-name" style={{ opacity: 0.5 }}>{themeLabel(settings.theme)}</span>
                </button>
              </div>
            </div>

            <div style={{ marginTop: '32px' }}>
              <div className="left-menu-group-label" style={{ marginBottom: '12px' }}>KEYBOARD SHORTCUTS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {SHORTCUTS.map(([key, label]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ 
                      fontWeight: '600', 
                      color: '#fff', 
                      background: 'rgba(255,255,255,0.1)', 
                      padding: '4px 8px', 
                      borderRadius: '6px',
                      fontSize: '12px',
                      letterSpacing: '1px'
                    }}>{key}</span>
                    <span className="left-menu-group-label" style={{ margin: 0 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
