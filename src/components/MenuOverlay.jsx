import { useEffect, useRef } from 'react';

export default function MenuOverlay({ isOpen, page, onClose, channelPage, settingsPage }) {
  const panelRef = useRef(null);
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (isOpen && !panelRef.current?.contains(event.target) && !event.target.closest('.hud-btn-menu-toggle')) onClose();
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, onClose]);
  return <div className={`left-menu-container ${isOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={page === 'settings' ? 'TV settings' : 'Channel browser'} aria-hidden={!isOpen} inert={!isOpen}>
    <div className="left-menu-perspective">
      <div className="left-menu" ref={panelRef}>
        <div className={`menu-panel-page ${page === 'channels' ? 'active' : ''}`} data-panel-page={page === 'channels' ? 'active' : 'inactive'} inert={page !== 'channels'}>{channelPage}</div>
        <div className={`menu-panel-page ${page === 'settings' ? 'active' : ''}`} data-panel-page={page === 'settings' ? 'active' : 'inactive'} inert={page !== 'settings'}>{settingsPage}</div>
      </div>
    </div>
  </div>;
}
