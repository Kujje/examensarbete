import { Server } from 'socket.io';

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // lås till din Netlify-domän senare
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('join', (joinCode) => {
      const code = String(joinCode || '').trim().toUpperCase();
      if (code) socket.join(code);
    });
  });

  return io;
}