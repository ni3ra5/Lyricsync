import { useState, useEffect, useCallback } from 'react';

export default function useLyricSync(lyrics, elapsed) {
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!lyrics || lyrics.length === 0 || elapsed == null) {
      setActiveIndex(-1);
      return;
    }

    let idx = -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (elapsed >= lyrics[i].time) {
        idx = i;
        break;
      }
    }
    setActiveIndex(idx);
  }, [lyrics, elapsed]);

  const getProgress = useCallback(() => {
    if (!lyrics || activeIndex < 0 || activeIndex >= lyrics.length) return 0;
    const currentTime = lyrics[activeIndex].time;
    const nextTime = activeIndex < lyrics.length - 1
      ? lyrics[activeIndex + 1].time
      : currentTime + 5000;
    const duration = nextTime - currentTime;
    if (duration <= 0) return 1;
    return Math.min(1, (elapsed - currentTime) / duration);
  }, [lyrics, activeIndex, elapsed]);

  return { activeIndex, getProgress };
}
