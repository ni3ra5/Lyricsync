import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';
import NowPlaying from '../components/NowPlaying';
import LyricsDisplay from '../components/LyricsDisplay';
import QRModal from '../components/QRModal';

export default function GuestView() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState(null);
  const [lyrics, setLyrics] = useState(null);
  const [plainLyrics, setPlainLyrics] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [joinUrl, setJoinUrl] = useState('');

  useEffect(() => {
    fetch(`/api/room/${roomId}/qr`)
      .then((r) => r.json())
      .then((data) => { setQrDataUrl(data.qrDataUrl); setJoinUrl(data.url); })
      .catch(() => {});
    socket.emit('guest:join', { roomId });

    const onRoomState = ({ song: s, lyrics: l, plainLyrics: pl, elapsed: e, playing: p }) => {
      setSong(s);
      setLyrics(l);
      setPlainLyrics(pl);
      setElapsed(e);
      setPlaying(p);
      setError(null);
    };

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
    };
    const onError = ({ message }) => setError(message);
    const onConnect = () => {
      setConnected(true);
      socket.emit('guest:join', { roomId });
    };
    const onDisconnect = () => setConnected(false);
    const onRoomClosed = () => setError('Room was closed by the host');

    socket.on('room:state', onRoomState);
    socket.on('timer:tick', onTick);
    socket.on('playback:update', onPlaybackUpdate);
    socket.on('song:changed', onSongChanged);
    socket.on('room:error', onError);
    socket.on('room:closed', onRoomClosed);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('room:state', onRoomState);
      socket.off('timer:tick', onTick);
      socket.off('playback:update', onPlaybackUpdate);
      socket.off('song:changed', onSongChanged);
      socket.off('room:error', onError);
      socket.off('room:closed', onRoomClosed);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [roomId]);

  const handleLeave = () => {
    socket.emit('guest:leaveRoom', { roomId });
    navigate('/');
  };

  if (error) {
    return (
      <div className="error-view">
        <div className="error-view__inner">
          <h1 className="error-view__title">Room Not Found</h1>
          <p className="error-view__message">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="guest-view">
      <header className="app-header">
        <button className="btn-back" onClick={handleLeave} title="Leave room">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="app-logo" style={{ flex: 1 }}>
          <span className="app-logo__accent">Lyric</span>
          <span className="app-logo__text">sync</span>
        </h1>
        <div className="connection-status">
          <span className={`connection-dot ${connected ? 'connection-dot--live' : 'connection-dot--disconnected'}`} />
          <span className="connection-label">{connected ? 'Live' : 'Reconnecting'}</span>
        </div>
        {qrDataUrl && (
          <div className="app-header__qr">
            <QRModal qrDataUrl={qrDataUrl} joinUrl={joinUrl} guestCount={0} />
          </div>
        )}
      </header>

      {song ? (
        <div className="main-section">
          <div className="lyrics-section">
            <div className="lyrics-card card">
              <LyricsDisplay lyrics={lyrics} plainLyrics={plainLyrics} />
            </div>
          </div>
          <div className="now-playing-section">
            <div className="now-playing-card card dot-grid">
              <NowPlaying song={song} elapsed={elapsed} lyrics={lyrics} playing={playing} />
            </div>
          </div>
        </div>
      ) : (
        <div className="guest-waiting">
          <div className="guest-waiting__inner">
            <div className="guest-waiting__icon card">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="guest-waiting__text">Waiting for host...</p>
          </div>
        </div>
      )}
    </div>
  );
}
