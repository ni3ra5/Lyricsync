# Lyrics Sources

MusicSync fetches lyrics using a waterfall strategy — each source is tried in order until lyrics are found.

## 1. LRCLIB (Primary)

- **URL:** https://lrclib.net
- **Auth:** None required
- **Endpoints used:**
  - Exact match: `GET /api/get?artist_name={artist}&track_name={title}`
  - Fuzzy search: `GET /api/search?q={query}`
- **Returns:** Synced lyrics (LRC timestamps) + plain lyrics
- **Coverage:** Good for English, Hindi, Bangla (native script), and most languages
- **Why primary:** Only free source that provides time-synced lyrics

## 2. JioSaavn (Fallback — Hindi/Bollywood)

- **URL:** https://www.jiosaavn.com/api.php (unofficial)
- **Auth:** None required
- **Endpoints used:**
  - Search: `?__call=search.getResults&q={query}&_format=json`
  - Lyrics: `?__call=lyrics.getLyrics&lyrics_id={songId}&_format=json`
- **Returns:** Plain lyrics only (romanized, `<br>` separated)
- **Coverage:** Strong for Hindi/Bollywood, weak for Bangla
- **Note:** Unofficial API — may change without notice

## 3. lyrics.ovh (Last resort)

- **URL:** https://api.lyrics.ovh
- **Auth:** None required
- **Endpoint:** `GET /v1/{artist}/{title}`
- **Returns:** Plain lyrics only
- **Coverage:** Decent for English and popular Hindi songs, poor for Bangla
- **Limitations:** No search (requires exact artist + title), no synced lyrics

## Timeout Policy

All fallback requests use a 5-second timeout (`AbortSignal.timeout(5000)`) to avoid blocking song selection.

## Search Results Badge

The search endpoint checks lyrics availability using LRCLIB exact match + fuzzy search to show a "Lyrics" / "No lyrics" badge per song.
