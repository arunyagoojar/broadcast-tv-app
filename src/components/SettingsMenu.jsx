import { useEffect, useRef, useState } from 'react';

const SHORTCUTS = [
  ['ARROWS', 'CHANNELS'],
  ['C', 'THEME'],
  ['F', 'FULLSCREEN'],
  ['S or /', 'SETTINGS'],
];

const GAMEPAD_CONTROLS = [
  ['dpad', 'D-PAD', 'Up/down highlight options'],
  ['stick', 'LEFT STICK', 'Up/down highlight options'],
  ['a', 'A', 'Select or enter'],
  ['b', 'B', 'Back or close'],
  ['x', 'X', 'Toggle fullscreen'],
  ['y', 'Y', 'Refresh current channel'],
  ['menu', 'MENU', 'Open or close channel menu'],
];

function GamepadGlyph({ type }) {
  if (type === 'dpad') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M11 4h10v7h7v10h-7v7H11v-7H4V11h7z" />
      </svg>
    );
  }
  if (type === 'menu') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="5" y="8" width="22" height="16" rx="8" />
        <path d="M12 14h8M12 18h8" />
      </svg>
    );
  }
  if (type === 'stick') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="13" r="7" />
        <path d="M12 20v5h8v-5" />
      </svg>
    );
  }
  return <span aria-hidden="true">{type.toUpperCase()}</span>;
}

function themeLabel(theme) {
  return theme ? theme.replace('theme-', '').toUpperCase() : 'CLASSIC';
}

export default function SettingsMenu({
  isOpen,
  onClose,
  onBackToMenu,
  settings,
  updateSetting,
  themes,
}) {
  const menuRef = useRef(null);
  const [settingsPage, setSettingsPage] = useState('main');
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
          
          <div className="left-menu-header settings-header">
            <div className="settings-title-group">
              <button
                className="settings-icon-btn"
                onClick={settingsPage === 'controls' ? () => setSettingsPage('main') : onBackToMenu}
                aria-label={settingsPage === 'controls' ? 'Back to TV settings' : 'Back to main menu'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="channel-name settings-title">
                {settingsPage === 'controls' ? 'Controls' : 'TV Settings'}
              </span>
            </div>
            <div className="settings-header-actions">
              {settingsPage === 'main' && (
                <button
                  className="settings-icon-btn"
                  onClick={() => setSettingsPage('controls')}
                  aria-label="Open controls"
                >?</button>
              )}
              <button className="settings-icon-btn" onClick={onClose} aria-label="Close settings">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="left-menu-content">

            {settingsPage === 'main' ? (
              <div className="settings-main-page">

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
                  <span className="setting-indicator" />
                </button>
                <button
                  className={`left-menu-item ${!logoMode ? 'active' : ''}`}
                  onClick={() => updateSetting('logoMode', false)}
                  style={{ justifyContent: 'space-between' }}
                >
                  <span className="channel-name">Text Only</span>
                  <span className="setting-indicator" />
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
                        <div className="setting-description">{sub}</div>
                      </div>
                      <span className="setting-indicator" />
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
                  <span className="setting-indicator" />
                </button>
                <button
                  className={`left-menu-item ${settings.vignette ? 'active' : ''}`}
                  onClick={() => updateSetting('vignette', !settings.vignette)}
                  style={{ justifyContent: 'space-between' }}
                >
                  <span className="channel-name">Vignette</span>
                  <span className="setting-indicator" />
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

            <div style={{ marginBottom: '24px' }}>
              <div className="left-menu-group-label" style={{ marginBottom: '8px' }}>UP NEXT</div>
              <div className="left-menu-list">
                {[
                  { value: 'with-hud', label: 'With HUD', sub: 'Visible whenever the HUD is shown' },
                  { value: 'occasional', label: 'Occasionally', sub: '10 seconds every 10 minutes' },
                ].map(({ value, label, sub }) => {
                  const active = (settings.upNextMode || 'with-hud') === value;
                  return (
                    <button
                      key={value}
                      className={`left-menu-item ${active ? 'active' : ''}`}
                      onClick={() => updateSetting('upNextMode', value)}
                      style={{ justifyContent: 'space-between' }}
                    >
                      <div>
                        <span className="channel-name">{label}</span>
                        <div className="setting-description">{sub}</div>
                      </div>
                      <span className="setting-indicator" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="left-menu-group-label" style={{ marginBottom: '8px' }}>HELP</div>
              <div className="left-menu-list">
                <button
                  className="left-menu-item"
                  onClick={() => setSettingsPage('controls')}
                  style={{ justifyContent: 'space-between' }}
                >
                  <span className="channel-name">Controls</span>
                  <svg className="settings-row-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>

              </div>
            ) : (
              <div className="controls-page">
                <p className="controls-intro">Navigate the TV without exposing playback controls.</p>
                <div className="left-menu-group-label">KEYBOARD</div>
                <div className="controls-list compact">
                  {SHORTCUTS.map(([key, label]) => (
                    <div className="control-row" key={key}>
                      <kbd>{key}</kbd>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>

                <div className="left-menu-group-label gamepad-heading">GAMEPAD</div>
                <div className="controls-list">
                  {GAMEPAD_CONTROLS.map(([type, key, label]) => (
                    <div className="control-row gamepad" key={type}>
                      <div className="gamepad-glyph"><GamepadGlyph type={type} /></div>
                      <strong>{key}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
