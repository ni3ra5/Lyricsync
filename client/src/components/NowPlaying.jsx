export default function NowPlaying({ song, elapsed, lyrics, onSeek, playing, onPlay, onPause, onStop }) {
  if (!song) return null;

  const totalMs = song.durationMs
    || (lyrics && lyrics.length > 0 ? lyrics[lyrics.length - 1].time + 5000 : 0);

  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = totalMs > 0 ? Math.min(1, (elapsed || 0) / totalMs) : 0;

  return (
    <div className="now-playing">
      {song.artworkUrl && (
        <div className="now-playing__artwork-wrap">
          <div className="now-playing__artwork-glow" />
          <img src={song.artworkUrl} alt={song.title} className="now-playing__artwork" />
        </div>
      )}
      <div className="now-playing__info">
        <h2 className="now-playing__title">{song.title}</h2>
        <p className="now-playing__artist">{song.artist}</p>
        {totalMs > 0 && (playing || elapsed > 0) && (
          <div className="now-playing__progress-row">
            <div
              className="progress-bar"
              onClick={(e) => {
                if (!onSeek) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                onSeek(Math.round(ratio * totalMs));
              }}
            >
              <div className="progress-bar__fill glow-bar" style={{ width: `${progress * 100}%` }} />
            </div>
            <span className="progress-time">
              {formatTime(elapsed || 0)} / {formatTime(totalMs)}
            </span>
          </div>
        )}
      </div>

      {onPlay && (
        <div className="now-playing__controls">
          {playing ? (
            <button onClick={onPause} className="btn-play">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            </button>
          ) : (
            <button onClick={onPlay} className="btn-play">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}
          <button onClick={onStop} className="btn-stop" title="Stop">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
