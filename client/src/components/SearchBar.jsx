import { useState, useRef, useEffect } from 'react';

export default function SearchBar({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lyricsStatus, setLyricsStatus] = useState({}); // trackId -> 'checking' | true | false
  const [searchSource, setSearchSource] = useState('itunes'); // 'youtube' | 'itunes'
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const lyricsAbortRef = useRef(null);

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

  const checkLyrics = (songs) => {
    // Abort any previous lyrics checks
    if (lyricsAbortRef.current) lyricsAbortRef.current.abort();
    const controller = new AbortController();
    lyricsAbortRef.current = controller;

    const initial = {};
    songs.forEach((s) => { initial[s.trackId] = 'checking'; });
    setLyricsStatus(initial);

    songs.forEach((song) => {
      fetch(`/api/lyrics-check?artist=${encodeURIComponent(song.artist)}&title=${encodeURIComponent(song.title)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          if (!controller.signal.aborted) {
            setLyricsStatus((prev) => ({ ...prev, [song.trackId]: data.hasLyrics }));
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setLyricsStatus((prev) => ({ ...prev, [song.trackId]: false }));
          }
        });
    });
  };

  const search = (term, source) => {
    const src = source || searchSource;
    if (!term.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    fetch(`/api/search?term=${encodeURIComponent(term)}&source=${src}`)
      .then((r) => r.json())
      .then((data) => {
        const songs = data.results || [];
        setResults(songs);
        setOpen(true);
        if (songs.length > 0) checkLyrics(songs);
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
    onSelect({ ...song, source: song.source || searchSource });
  };

  const toggleSource = () => {
    const newSource = searchSource === 'youtube' ? 'itunes' : 'youtube';
    setSearchSource(newSource);
    if (query.trim()) search(query, newSource);
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
        <button className="search-source-toggle" onClick={toggleSource} title={`Switch to ${searchSource === 'youtube' ? 'iTunes' : 'YouTube'}`}>
          {searchSource === 'youtube' ? (
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.016 5.2v9.386a2.927 2.927 0 01-2.088 2.806 2.927 2.927 0 01-3.2-.85 2.927 2.927 0 01.325-4.126c.676-.547 1.524-.795 2.363-.716V8.118l-5.432 1.2v7.268a2.927 2.927 0 01-2.088 2.806 2.927 2.927 0 01-3.2-.85 2.927 2.927 0 01.325-4.126c.676-.547 1.524-.795 2.363-.716V7.184a1.2 1.2 0 01.932-1.17l6.432-1.476A1.2 1.2 0 0117.016 5.2z"/></svg>
          )}
        </button>
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
              <span className={`lyrics-badge ${lyricsStatus[song.trackId] === 'checking' ? 'lyrics-badge--checking' : lyricsStatus[song.trackId] ? 'lyrics-badge--yes' : 'lyrics-badge--no'}`}>
                {lyricsStatus[song.trackId] === 'checking' ? '...' : lyricsStatus[song.trackId] ? 'Lyrics' : 'No lyrics'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
