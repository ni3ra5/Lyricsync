import { io } from 'socket.io-client';

const socket = io('/', {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

export default socket;
