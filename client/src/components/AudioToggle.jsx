import { useRef, useState, useEffect } from 'react';

export default function AudioToggle({ audioUrl, playing, elapsed }) {
  const audioRef = useRef(null);
  const [musicOn, setMusicOn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!audioUrl) {
      setReady(false);
      setMusicOn(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
      return;
    }
    setReady(true);
  }, [audioUrl]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (musicOn && playing) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [musicOn, playing]);

  useEffect(() => {
    if (!audioRef.current || !musicOn || elapsed == null) return;
    const elapsedSec = elapsed / 1000;
    if (Math.abs(audioRef.current.currentTime - elapsedSec) > 2) {
      audioRef.current.currentTime = elapsedSec;
    }
  }, [elapsed, musicOn]);

  const toggle = () => setMusicOn((v) => !v);

  if (!ready) return null;

  return (
    <>
      <audio ref={audioRef} src={audioUrl} preload="auto" />
      <button onClick={toggle} className={`audio-toggle ${musicOn ? 'audio-toggle--on' : 'audio-toggle--off'}`}>
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {musicOn ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          ) : (
            <>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
            </>
          )}
        </svg>
      </button>
    </>
  );
}
