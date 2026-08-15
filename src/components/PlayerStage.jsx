export default function PlayerStage({
  playerRef,
  playerKey,
  onPlay,
  onEnded,
  onError,
  onLoad,
  embedUrl,
  isMuted,
  playerReady,
  onShieldClick,
}) {
  return (
    <div className="player-stage">
      <div id="player-wrap">
        <div id="player-container">
          {embedUrl ? (
            <iframe
              key={playerKey}
              id="player"
              ref={playerRef}
              src={embedUrl}
              title="Broadcast TV player"
              width="100%"
              height="100%"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; encrypted-media"
              onLoad={onLoad}
              onError={onError}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          ) : (
            <video
              key={playerKey}
              id="player"
              ref={playerRef}
              playsInline
              autoPlay
              muted={isMuted}
              onPlay={onPlay}
              onEnded={onEnded}
              onError={onError}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
        </div>
        <div className={`player-loading-cover${playerReady ? ' hidden' : ''}`} aria-hidden="true" />
        {/* Always intercept player input: first click unlocks audio, later clicks are inert. */}
        <div className="player-shield" onClick={onShieldClick}></div>
      </div>
    </div>
  );
}
