const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createRoom, getRoom, deleteRoom, startTimer, pauseTimer, restartTimer, getCurrentElapsed } = require('./rooms');
const { fetchLyrics } = require('./lyrics');
const { fetchAudioUrl, setupAudioRoute, ytDlpPath } = require('./audio');
const { generateQRData, generateRoomId } = require('./utils');

const app = express();
const server = http.createServer(app);
const PORT = process.env.SERVER_PORT || process.env.PORT || 3002;

const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(express.json());

// --- API Routes ---

// Search songs — supports YouTube and iTunes via ?source= param
app.get('/api/search', async (req, res) => {
  const { term, source } = req.query;
  if (!term) return res.json({ results: [] });

  try {
    if (source === 'itunes') {
      // iTunes search
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=10`
      );
      const data = await response.json();
      const results = data.results.map((r) => ({
        trackId: String(r.trackId),
        title: r.trackName,
        artist: r.artistName,
        album: r.collectionName,
        artworkUrl: r.artworkUrl100?.replace('100x100', '300x300'),
        previewUrl: r.previewUrl || null,
        durationMs: r.trackTimeMillis || 0,
        source: 'itunes',
      }));
      return res.json({ results });
    }

    // YouTube search (default)
    const { exec } = require('child_process');
    const ytDlp = ytDlpPath;
    const searchQuery = term.replace(/"/g, '\\"');
    const cmd = `"${ytDlp}" --flat-playlist --dump-json "ytsearch10:${searchQuery}"`;

    const output = await new Promise((resolve, reject) => {
      exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
        if (error) return reject(error);
        resolve(stdout);
      });
    });

    const results = output.trim().split('\n').filter(Boolean).map((line) => {
      try {
        const v = JSON.parse(line);
        let title = v.title || '';
        let artist = v.channel || v.uploader || '';
        const dashMatch = title.match(/^(.+?)\s*[-–—]\s*(.+)$/);
        if (dashMatch) {
          artist = dashMatch[1].trim();
          title = dashMatch[2].trim();
        }
        title = title.split(/\s*\|\s*/)[0].trim();
        title = title.replace(/\s*\(?(official\s*(music\s*)?video|official\s*audio|lyric\s*video|lyrics|audio|hd|hq|mv)\)?/gi, '').trim();
        return {
          trackId: v.id,
          title,
          artist,
          album: '',
          artworkUrl: v.thumbnails?.[v.thumbnails.length - 1]?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
          previewUrl: null,
          durationMs: (v.duration || 0) * 1000,
          source: 'youtube',
        };
      } catch { return null; }
    }).filter(Boolean);

    res.json({ results });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Check lyrics availability for a single song (all sources)
app.get('/api/lyrics-check', async (req, res) => {
  const { artist, title } = req.query;
  if (!artist || !title) return res.json({ hasLyrics: false });

  try {
    const checks = [
      // LRCLIB exact match
      fetch(`https://lrclib.net/api/get?${new URLSearchParams({ artist_name: artist, track_name: title })}`, { signal: AbortSignal.timeout(6000) })
        .then(r => r.ok ? r.json() : null)
        .then(data => !!(data && (data.syncedLyrics || data.plainLyrics)))
        .catch(() => false),
      // LRCLIB fuzzy search
      fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${title}`)}`, { signal: AbortSignal.timeout(6000) })
        .then(r => r.ok ? r.json() : [])
        .then(data => data.length > 0 && !!(data[0].syncedLyrics || data[0].plainLyrics))
        .catch(() => false),
      // JioSaavn
      fetch(`https://www.jiosaavn.com/api.php?__call=search.getResults&p=1&q=${encodeURIComponent(`${title} ${artist}`)}&_format=json&_marker=0&ctx=wap6dot0&n=5`, { signal: AbortSignal.timeout(6000) })
        .then(r => r.ok ? r.json() : null)
        .then(data => !!(data && data.results && data.results.some(s => s.has_lyrics === 'true' || s.has_lyrics === true)))
        .catch(() => false),
      // lyrics.ovh
      fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`, { signal: AbortSignal.timeout(6000) })
        .then(r => r.ok ? r.json() : null)
        .then(data => !!(data && data.lyrics))
        .catch(() => false),
    ];
    const found = await Promise.any(checks.map(c => c.then(v => { if (v) return true; throw new Error(); })))
      .catch(() => false);
    res.json({ hasLyrics: found });
  } catch {
    res.json({ hasLyrics: false });
  }
});

// Create room
app.post('/api/room', async (req, res) => {
  const roomId = generateRoomId();
  const qr = await generateQRData(roomId, PORT);
  res.json({ roomId, ...qr });
});

// Get QR data for a room
app.get('/api/room/:roomId/qr', async (req, res) => {
  const qr = await generateQRData(req.params.roomId, PORT);
  res.json(qr);
});

// QR code for homepage URL (so mobile can open it)
app.get('/api/homeqr', async (req, res) => {
  const QRCode = require('qrcode');
  const { getLocalIP } = require('./utils');
  let url;
  if (process.env.RENDER_EXTERNAL_URL) {
    url = process.env.RENDER_EXTERNAL_URL;
  } else {
    const ip = getLocalIP();
    url = `http://${ip}:${PORT}`;
  }
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 200, margin: 1,
    color: { dark: '#F5F5F5', light: '#00000000' },
  });
  res.json({ url, qrDataUrl });
});

// Debug: list rooms with audio status
app.get('/api/debug/rooms', (req, res) => {
  const { rooms } = require('./rooms');
  const info = Object.entries(rooms).map(([id, r]) => ({
    id,
    song: r.song?.title,
    hasAudioUrl: !!r.audioUrl,
    audioUrlPrefix: r.audioUrl?.substring(0, 80),
  }));
  res.json(info);
});

// Audio streaming route
setupAudioRoute(app);

// Serve static client build in production, redirect to Vite in dev
const clientDist = path.join(__dirname, '../client/dist');
const fs = require('fs');
const isDev = !fs.existsSync(path.join(clientDist, 'index.html'));

if (!isDev) {
  app.use(express.static(clientDist));
}

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/audio') || req.path.startsWith('/socket.io')) return;
  if (isDev) {
    res.redirect(`http://${req.hostname}:5174${req.originalUrl}`);
  } else {
    res.sendFile(path.join(clientDist, 'index.html'));
  }
});

// --- Socket.io ---
const socketRoomMap = new Map(); // socketId -> roomId (for guest disconnect tracking)

function emitGuestCount(roomId) {
  const room = getRoom(roomId);
  if (room) {
    io.to(roomId).emit('room:guestCount', { count: room.guests.size });
  }
}

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('host:createRoom', async (data, callback) => {
    const roomId = data.roomId;
    const room = createRoom(roomId, socket.id);
    socket.join(roomId);
    const qr = await generateQRData(roomId, PORT);
    callback({ roomId, ...qr });
  });

  socket.on('host:selectSong', async ({ roomId, trackId, title, artist, artworkUrl, previewUrl, durationMs, source }) => {
    const room = getRoom(roomId);
    if (!room) return;

    // Reset playback
    restartTimer(roomId);

    room.song = { title, artist, artworkUrl, trackId, durationMs: durationMs || 0 };
    room.lyrics = null;
    room.plainLyrics = null;
    room.audioUrl = null;
    room.previewUrl = previewUrl;

    // Broadcast song change immediately so guests see the new song right away
    io.to(roomId).emit('song:changed', {
      song: room.song,
      lyrics: null,
      plainLyrics: null,
    });

    // Fetch lyrics in background with timeout, then update clients
    try {
      const lyricsPromise = fetchLyrics(artist, title);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Lyrics fetch timeout')), 15000));
      const { lyrics, plainLyrics } = await Promise.race([lyricsPromise, timeoutPromise]);
      room.lyrics = lyrics;
      room.plainLyrics = plainLyrics;
    } catch (err) {
      console.error('Lyrics fetch failed:', err.message);
    }
    // Always emit update so client clears the loading state
    io.to(roomId).emit('song:changed', {
      song: room.song,
      lyrics: room.lyrics,
      plainLyrics: room.plainLyrics,
    });

    // Fetch full song via yt-dlp
    const audioQuery = source === 'itunes' ? `${title} ${artist} official audio` : trackId;
    fetchAudioUrl(audioQuery, source)
      .then((url) => {
        room.audioUrl = url;
        io.to(roomId).emit('audio:ready', { audioUrl: `/audio/${roomId}?t=${Date.now()}` });
      })
      .catch((err) => {
        console.error('Audio fetch failed:', err.message);
        io.to(roomId).emit('audio:error', { message: 'Background audio unavailable' });
      });
  });

  socket.on('host:play', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    startTimer(roomId, io);
    io.to(roomId).emit('playback:update', {
      playing: true,
      elapsed: getCurrentElapsed(room),
    });
  });

  socket.on('host:pause', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    pauseTimer(roomId);
    io.to(roomId).emit('playback:update', {
      playing: false,
      elapsed: getCurrentElapsed(room),
    });
  });

  socket.on('host:seek', ({ roomId, elapsed: seekTo }) => {
    const room = getRoom(roomId);
    if (!room) return;
    const wasPlaying = room.playing;
    if (wasPlaying) pauseTimer(roomId);
    room.elapsed = seekTo;
    if (wasPlaying) startTimer(roomId, io);
    io.to(roomId).emit('playback:update', {
      playing: room.playing,
      elapsed: seekTo,
    });
  });

  socket.on('host:restart', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    restartTimer(roomId);
    io.to(roomId).emit('playback:update', {
      playing: false,
      elapsed: 0,
    });
  });

  socket.on('host:closeRoom', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    io.to(roomId).emit('room:closed');
    deleteRoom(roomId);
  });

  socket.on('guest:leaveRoom', ({ roomId }) => {
    const room = getRoom(roomId);
    if (room) {
      room.guests.delete(socket.id);
      socket.leave(roomId);
      emitGuestCount(roomId);
    }
    socketRoomMap.delete(socket.id);
  });

  socket.on('guest:join', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) {
      socket.emit('room:error', { message: 'Room not found' });
      return;
    }
    socket.join(roomId);
    room.guests.add(socket.id);
    socketRoomMap.set(socket.id, roomId);

    socket.emit('room:state', {
      song: room.song,
      lyrics: room.lyrics,
      plainLyrics: room.plainLyrics,
      elapsed: getCurrentElapsed(room),
      playing: room.playing,
    });

    emitGuestCount(roomId);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    const roomId = socketRoomMap.get(socket.id);
    if (roomId) {
      const room = getRoom(roomId);
      if (room) {
        room.guests.delete(socket.id);
        emitGuestCount(roomId);
      }
      socketRoomMap.delete(socket.id);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const { getLocalIP } = require('./utils');
  console.log(`\n  Lyricsync server running on:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${getLocalIP()}:${PORT}\n`);
});
