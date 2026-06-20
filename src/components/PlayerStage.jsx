export default function PlayerStage({ playerRef, onPlay, onEnded, onError, embedUrl, hasUnmuted }) {
  return (
    <div className="player-stage">
      <div id="player-wrap">
        <div id="player-container">
          {embedUrl ? (
            <iframe
              id="player"
              ref={playerRef}
              src={embedUrl}
              width="100%"
              height="100%"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; encrypted-media"
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          ) : (
            <video
              id="player"
              ref={playerRef}
              playsInline
              autoPlay
              onPlay={onPlay}
              onEnded={onEnded}
              onError={onError}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
        </div>
        {/* Shield blocks interactions ONLY after audio is unmuted */}
        <div className="player-shield" style={{ pointerEvents: hasUnmuted ? 'auto' : 'none' }}></div>
      </div>
    </div>
  );
}
