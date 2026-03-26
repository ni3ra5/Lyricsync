import { useRef } from 'react';

export default function LyricsDisplay({ lyrics, plainLyrics, loading }) {
  const scrollRef = useRef(null);

  if (loading) {
    return (
      <div className="lyrics-empty">
        <div className="loading-spinner" />
        <p className="lyrics-empty__text">Fetching lyrics...</p>
      </div>
    );
  }

  if (!lyrics && !plainLyrics) {
    return (
      <div className="lyrics-empty">
        <p className="lyrics-empty__text">No lyrics available</p>
      </div>
    );
  }

  if (!lyrics && plainLyrics) {
    return (
      <div ref={scrollRef} className="lyrics-scroll">
        {plainLyrics.split('\n').map((line, i) => (
          <p key={i} className="lyrics-line--plain">{line || '\u00A0'}</p>
        ))}
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="lyrics-scroll">
      {lyrics.map((line, i) => (
        <p key={i} className="lyrics-line">{line.text}</p>
      ))}
    </div>
  );
}
