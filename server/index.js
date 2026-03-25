const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createRoom, getRoom, deleteRoom, startTimer, pauseTimer, restartTimer, getCurrentElapsed } = require('./rooms');
const { fetchLyrics } = require('./lyrics');
const { fetchAudioUrl, setupAudioRoute } = require('./audio');
const { generateQRData, generateRoomId } = require('./utils');

const app = express();
const server = http.createServer(app);
const PORT = 3002;

const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(express.json());

// --- API Routes ---

// Search songs via iTunes, check lyrics availability
app.get('/api/search', async (req, res) => {
  try {
    const { term } = req.query;
    if (!term) return res.json({ results: [] });
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=10`
    );
    const data = await response.json();
    const results = data.results.map((r) => ({
      trackId: r.trackId,
      title: r.trackName,
      artist: r.artistName,
      album: r.collectionName,
      artworkUrl: r.artworkUrl100?.replace('100x100', '300x300'),
      previewUrl: r.previewUrl || null,
      durationMs: r.trackTimeMillis || 0,
    }));

    // Check lyrics availability in parallel (all sources checked concurrently)
    const lyricsChecks = results.map(async (r) => {
      try {
        const checks = [
          // LRCLIB exact match
          fetch(`https://lrclib.net/api/get?${new URLSearchParams({ artist_name: r.artist, track_name: r.title })}`, { signal: AbortSignal.timeout(3000) })
            .then(res => res.ok ? res.json() : null)
            .then(data => !!(data && (data.syncedLyrics || data.plainLyrics)))
            .catch(() => false),
          // LRCLIB fuzzy search
          fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(`${r.artist} ${r.title}`)}`, { signal: AbortSignal.timeout(3000) })
            .then(res => res.ok ? res.json() : [])
            .then(data => data.length > 0 && !!(data[0].syncedLyrics || data[0].plainLyrics))
            .catch(() => false),
          // lyrics.ovh
          fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(r.artist)}/${encodeURIComponent(r.title)}`, { signal: AbortSignal.timeout(3000) })
            .then(res => res.ok ? res.json() : null)
            .then(data => !!(data && data.lyrics))
            .catch(() => false),
        ];
        const found = await Promise.any(checks.map((c, i) => c.then(v => { if (v) return true; throw new Error(); })))
          .catch(() => false);
        return { ...r, hasLyrics: found };
      } catch {
        return { ...r, hasLyrics: false };
      }
    });

    res.json({ results: await Promise.all(lyricsChecks) });
  } catch (err) {
    console.error('iTunes search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
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
  const ip = getLocalIP();
  const url = `http://${ip}:${PORT}`;
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

  socket.on('host:selectSong', async ({ roomId, trackId, title, artist, artworkUrl, previewUrl, durationMs }) => {
    const room = getRoom(roomId);
    if (!room) return;

    // Reset playback
    restartTimer(roomId);

    room.song = { title, artist, artworkUrl, trackId, durationMs: durationMs || 0 };

    // Fetch lyrics
    const { lyrics, plainLyrics } = await fetchLyrics(artist, title);
    room.lyrics = lyrics;
    room.plainLyrics = plainLyrics;

    // Skip iTunes preview (30s clip from middle of song) — wait for full song
    room.audioUrl = null;
    room.previewUrl = previewUrl;

    // Fetch full song via yt-dlp
    fetchAudioUrl(title, artist)
      .then((url) => {
        room.audioUrl = url;
        io.to(roomId).emit('audio:ready', { audioUrl: `/audio/${roomId}?t=${Date.now()}` });
      })
      .catch((err) => {
        console.error('Audio fetch failed:', err.message);
        io.to(roomId).emit('audio:error', { message: 'Background audio unavailable' });
      });

    io.to(roomId).emit('song:changed', {
      song: room.song,
      lyrics: room.lyrics,
      plainLyrics: room.plainLyrics,
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
      audioAvailable: !!room.audioUrl,
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
