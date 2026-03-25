# Lyricsync

Real-time synchronized lyrics for everyone in the room. A host searches and plays songs while guests join via QR code to follow along with synced lyrics on their own devices.

## Features

- **Song Search** — Search any song via the iTunes catalog
- **Synced Lyrics** — Time-stamped lyrics that scroll in real-time with playback
- **QR Code Sharing** — Guests scan a QR code to instantly join the session
- **Multi-Source Lyrics** — Fetches lyrics from LRCLIB, JioSaavn (Hindi/Bollywood), and lyrics.ovh
- **Audio Streaming** — Full song audio streamed via yt-dlp and proxied through the server
- **Real-Time Sync** — WebSocket-based (Socket.IO) synchronization across all connected devices

## Tech Stack

**Backend:** Node.js, Express, Socket.IO, yt-dlp
**Frontend:** React 18, React Router, Vite

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed and available in your PATH (or set `YT_DLP_PATH` env variable)

## Getting Started

```bash
# Clone the repo
git clone https://github.com/your-username/lyricsync.git
cd lyricsync

# Install dependencies
npm install
cd client && npm install && cd ..

# Start development servers (backend + frontend)
npm run dev
```

The app will be available at `http://localhost:3002`. A local network URL is also printed on startup so other devices on the same Wi-Fi can connect.

## Project Structure

```
lyricsync/
├── server/
│   ├── index.js          # Express server, routes, Socket.IO handlers
│   ├── rooms.js          # Room state & playback timing
│   ├── lyrics.js         # Multi-source lyrics fetching & LRC parsing
│   ├── audio.js          # yt-dlp audio extraction & streaming proxy
│   └── utils.js          # QR generation, IP detection, room ID generation
├── client/
│   └── src/
│       ├── App.jsx       # Router (/, /host, /room/:roomId)
│       ├── views/
│       │   ├── HomePage.jsx    # Landing page
│       │   ├── HostView.jsx    # Host controls: search, playback, QR
│       │   └── GuestView.jsx   # Guest lyrics display
│       ├── components/   # SearchBar, NowPlaying, LyricsDisplay, etc.
│       └── socket.js     # Socket.IO client
└── package.json          # Root scripts (concurrently runs server + client)
```

## How It Works

1. **Host** starts a session from the homepage, creating a room
2. Host searches for a song — the server checks iTunes and verifies lyrics availability
3. On song selection, the server fetches synced lyrics and audio via yt-dlp
4. **Guests** scan the QR code to join the room on their devices
5. The server broadcasts playback state (play/pause/seek/tick) to all clients via Socket.IO
6. Each client renders lyrics synced to the current playback position

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both server and client concurrently |
| `npm run server` | Start only the backend (port 3002) |
| `npm run client` | Start only the Vite dev server (port 5174) |

## License

MIT
