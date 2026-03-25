import { useState, useRef, useEffect } from 'react';

export default function SearchBar({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = (term) => {
    if (!term.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    fetch(`/api/search?term=${encodeURIComponent(term)}`)
      .then((r) => r.json())
      .then((data) => {
        setResults(data.results || []);
        setOpen(true);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 400);
  };

  const handleFocus = () => {
    if (query.trim() && results.length > 0) {
      setOpen(true);
    } else if (query.trim()) {
      search(query);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(timerRef.current);
      search(query);
    }
  };

  const handleSelect = (song) => {
    setQuery(`${song.title} — ${song.artist}`);
    setOpen(false);
    onSelect(song);
  };

  return (
    <div ref={wrapperRef} className="search-bar">
      <div className="search-input-wrap card">
        <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder="Search for a song..."
          className="search-input"
        />
      </div>

      {(loading || (open && results.length > 0)) && (
        <div className="search-dropdown card">
          {loading && (
            <div className="search-loading">
              <div className="search-loading__spinner" />
              <span className="search-loading__text">Searching...</span>
            </div>
          )}
          {!loading && results.map((song) => (
            <button key={song.trackId} onClick={() => handleSelect(song)} className="search-result">
              {song.artworkUrl && (
                <img src={song.artworkUrl} alt="" className="search-result__artwork" />
              )}
              <div className="search-result__info">
                <p className="search-result__title">{song.title}</p>
                <p className="search-result__artist">{song.artist}</p>
              </div>
              <span className={`lyrics-badge ${song.hasLyrics ? 'lyrics-badge--yes' : 'lyrics-badge--no'}`}>
                {song.hasLyrics ? 'Lyrics' : 'No lyrics'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
