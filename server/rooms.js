const rooms = {};

function createRoom(roomId, hostSocketId) {
  rooms[roomId] = {
    id: roomId,
    song: null,
    lyrics: null,
    plainLyrics: null,
    audioUrl: null,
    playing: false,
    startedAt: null,
    elapsed: 0,
    timerInterval: null,
    guests: new Set(),
    hostSocketId,
  };
  return rooms[roomId];
}

function getRoom(roomId) {
  return rooms[roomId] || null;
}

function deleteRoom(roomId) {
  const room = rooms[roomId];
  if (room && room.timerInterval) {
    clearInterval(room.timerInterval);
  }
  delete rooms[roomId];
}

function startTimer(roomId, io) {
  const room = rooms[roomId];
  if (!room) return;

  room.playing = true;
  room.startedAt = Date.now();

  if (room.timerInterval) clearInterval(room.timerInterval);

  room.timerInterval = setInterval(() => {
    const currentElapsed = room.elapsed + (Date.now() - room.startedAt);
    io.to(roomId).emit('timer:tick', { elapsed: currentElapsed });
  }, 500);
}

function pauseTimer(roomId) {
  const room = rooms[roomId];
  if (!room || !room.playing) return;

  room.elapsed += Date.now() - room.startedAt;
  room.playing = false;
  room.startedAt = null;

  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
}

function restartTimer(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.elapsed = 0;
  room.playing = false;
  room.startedAt = null;

  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
}

function getCurrentElapsed(room) {
  if (!room) return 0;
  if (room.playing && room.startedAt) {
    return room.elapsed + (Date.now() - room.startedAt);
  }
  return room.elapsed;
}

module.exports = {
  rooms,
  createRoom,
  getRoom,
  deleteRoom,
  startTimer,
  pauseTimer,
  restartTimer,
  getCurrentElapsed,
};
