import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import SearchBar from '../components/SearchBar';
import NowPlaying from '../components/NowPlaying';
import QRModal from '../components/QRModal';
import LyricsDisplay from '../components/LyricsDisplay';

export default function HostView() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [joinUrl, setJoinUrl] = useState('');
  const [song, setSong] = useState(null);
  const [lyrics, setLyrics] = useState(null);
  const [plainLyrics, setPlainLyrics] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [guestCount, setGuestCount] = useState(0);
  const [loadingSong, setLoadingSong] = useState(false);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const lyricsEmitCount = useRef(0);
  const audioRef = useRef(null);

  // Load audio and seek to correct position when URL changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const handleLoaded = () => {
      audio.currentTime = elapsed / 1000;
      if (playing) {
        audio.play().catch(() => {});
      }
    };

    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.load();

    return () => audio.removeEventListener('loadedmetadata', handleLoaded);
  }, [audioUrl]);

  // Play/pause audio with playback state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (playing) {
      audio.currentTime = elapsed / 1000;
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [playing]);

  // Sync audio position on seek
  useEffect(() => {
    if (!audioRef.current || !audioUrl || elapsed == null) return;
    const elapsedSec = elapsed / 1000;
    if (Math.abs(audioRef.current.currentTime - elapsedSec) > 0.5) {
      audioRef.current.currentTime = elapsedSec;
    }
  }, [elapsed]);

  // Create room on mount
  useEffect(() => {
    fetch('/api/room', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        setRoomId(data.roomId);
        setQrDataUrl(data.qrDataUrl);
        setJoinUrl(data.url);

        socket.emit('host:createRoom', { roomId: data.roomId }, (res) => {
          setQrDataUrl(res.qrDataUrl);
          setJoinUrl(res.url);
        });
      });
  }, []);

  // Socket listeners
  useEffect(() => {
    const onTick = ({ elapsed: e }) => setElapsed(e);
    const onPlaybackUpdate = ({ playing: p, elapsed: e }) => {
      setPlaying(p);
      setElapsed(e);
    };
    const onSongChanged = ({ song: s, lyrics: l, plainLyrics: pl }) => {
      setSong(s);
      setLyrics(l);
      setPlainLyrics(pl);
      setElapsed(0);
      setPlaying(false);
      setLoadingSong(false);
      // First emission has null lyrics (loading); second emission is the result
      if (l === null && pl === null && lyricsEmitCount.current === 0) {
        setLyricsLoading(true);
        lyricsEmitCount.current = 1;
      } else {
        setLyricsLoading(false);
        lyricsEmitCount.current = 0;
      }
    };
    const onAudioReady = ({ audioUrl: url }) => {
      // Append timestamp to bust browser cache when song changes
      const sep = url.includes('?') ? '&' : '?';
      setAudioUrl(`${url}${sep}t=${Date.now()}`);
    };
    const onAudioError = () => setAudioUrl(null);
    const onGuestCount = ({ count }) => setGuestCount(count);

    socket.on('timer:tick', onTick);
    socket.on('playback:update', onPlaybackUpdate);
    socket.on('song:changed', onSongChanged);
    socket.on('audio:ready', onAudioReady);
    socket.on('audio:error', onAudioError);
    socket.on('room:guestCount', onGuestCount);

    return () => {
      socket.off('timer:tick', onTick);
      socket.off('playback:update', onPlaybackUpdate);
      socket.off('song:changed', onSongChanged);
      socket.off('audio:ready', onAudioReady);
      socket.off('audio:error', onAudioError);
      socket.off('room:guestCount', onGuestCount);
    };
  }, []);

  const handleSelectSong = useCallback(
    (songData) => {
      if (!roomId) return;
      setAudioUrl(null);
      setLoadingSong(true);
      socket.emit('host:selectSong', {
        roomId,
        trackId: songData.trackId,
        title: songData.title,
        artist: songData.artist,
        artworkUrl: songData.artworkUrl,
        previewUrl: songData.previewUrl,
        durationMs: songData.durationMs,
        source: songData.source,
      });
    },
    [roomId]
  );

  const handlePlay = () => socket.emit('host:play', { roomId });
  const handlePause = () => socket.emit('host:pause', { roomId });
  const handleRestart = () => socket.emit('host:restart', { roomId });
  const handleSeek = (ms) => socket.emit('host:seek', { roomId, elapsed: ms });
  const handleCloseRoom = () => {
    if (roomId) socket.emit('host:closeRoom', { roomId });
    navigate('/');
  };

  return (
    <div className="host-view">
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

      <header className="app-header">
        <div className="app-header__left">
          <div className="app-header__logo-row">
            <button className="btn-back" onClick={handleCloseRoom} title="Close room & go back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="app-logo">
              <span className="app-logo__accent">Lyric</span>
              <span className="app-logo__text">sync</span>
            </h1>
          </div>
          <div className="app-header__search">
            <SearchBar onSelect={handleSelectSong} />
          </div>
        </div>
        {roomId && (
          <div className="app-header__qr">
            <QRModal qrDataUrl={qrDataUrl} joinUrl={joinUrl} guestCount={guestCount} />
          </div>
        )}
      </header>

      {loadingSong && (
        <div className="loading-state">
          <div className="loading-state__inner">
            <div className="loading-spinner" />
            <p className="loading-text">Loading song...</p>
          </div>
        </div>
      )}

      {song && !loadingSong && (
        <div className="main-section">
          <div className="lyrics-section">
            <div className="lyrics-card card">
              <LyricsDisplay lyrics={lyrics} plainLyrics={plainLyrics} loading={lyricsLoading} />
            </div>
          </div>
          <div className="now-playing-section">
            <div className="now-playing-card card dot-grid">
              <NowPlaying song={song} elapsed={elapsed} lyrics={lyrics} onSeek={handleSeek} playing={playing} onPlay={handlePlay} onPause={handlePause} onStop={handleRestart} />
            </div>
          </div>
        </div>
      )}

      {!song && !loadingSong && (
        <div className="empty-state">
          <div className="empty-state__inner">
            <div className="empty-state__icon card">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <p className="empty-state__text">Search for a song to get started</p>
          </div>
        </div>
      )}
    </div>
  );
}
