async function fetchLyrics(artist, title) {
  // 1. LRCLIB exact match (best: has synced lyrics)
  try {
    const params = new URLSearchParams({
      artist_name: artist,
      track_name: title,
    });
    const res = await fetch(`https://lrclib.net/api/get?${params}`);
    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics) {
        return {
          lyrics: parseLRC(data.syncedLyrics),
          plainLyrics: data.plainLyrics || null,
        };
      }
      if (data.plainLyrics) {
        return { lyrics: null, plainLyrics: data.plainLyrics };
      }
    }
  } catch (err) {
    console.error('LRCLIB exact error:', err.message);
  }

  // 2. LRCLIB fuzzy search
  try {
    const sRes = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${title}`)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (sRes.ok) {
      const results = await sRes.json();
      if (results.length > 0) {
        const best = results[0];
        if (best.syncedLyrics) {
          return {
            lyrics: parseLRC(best.syncedLyrics),
            plainLyrics: best.plainLyrics || null,
          };
        }
        if (best.plainLyrics) {
          return { lyrics: null, plainLyrics: best.plainLyrics };
        }
      }
    }
  } catch (err) {
    console.error('LRCLIB search error:', err.message);
  }

  // 3. JioSaavn (good for Hindi/Bollywood songs)
  try {
    const lyrics = await fetchFromJioSaavn(artist, title);
    if (lyrics) {
      return { lyrics: null, plainLyrics: lyrics };
    }
  } catch (err) {
    console.error('JioSaavn error:', err.message);
  }

  // 4. lyrics.ovh fallback
  try {
    const ovhRes = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (ovhRes.ok) {
      const ovhData = await ovhRes.json();
      if (ovhData.lyrics) {
        return { lyrics: null, plainLyrics: ovhData.lyrics.trim() };
      }
    }
  } catch (err) {
    console.error('lyrics.ovh error:', err.message);
  }

  return { lyrics: null, plainLyrics: null };
}

async function fetchFromJioSaavn(artist, title) {
  // Search for the song
  const query = `${title} ${artist}`;
  const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&p=1&q=${encodeURIComponent(query)}&_format=json&_marker=0&ctx=wap6dot0&n=5`;

  const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
  if (!searchRes.ok) return null;

  const searchData = await searchRes.json();
  const songs = searchData.results;
  if (!songs || songs.length === 0) return null;

  // Find a song that has lyrics
  for (const song of songs) {
    if (song.has_lyrics === 'true' || song.has_lyrics === true) {
      const lyricsUrl = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&lyrics_id=${song.id}&ctx=wap6dot0&_format=json&_marker=0`;
      const lyricsRes = await fetch(lyricsUrl, { signal: AbortSignal.timeout(5000) });
      if (!lyricsRes.ok) continue;

      const lyricsData = await lyricsRes.json();
      if (lyricsData.lyrics) {
        // JioSaavn returns lyrics with <br> tags
        return lyricsData.lyrics.replace(/<br\s*\/?>/gi, '\n').trim();
      }
    }
  }

  return null;
}

function parseLRC(lrcString) {
  const lines = lrcString.split('\n');
  const result = [];

  for (const line of lines) {
    const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      let ms = parseInt(match[3], 10);
      if (match[3].length === 2) ms *= 10;
      const time = minutes * 60000 + seconds * 1000 + ms;
      const text = match[4].trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

module.exports = { fetchLyrics, parseLRC };
