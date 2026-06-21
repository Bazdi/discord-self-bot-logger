import type { Server as HTTPServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '@/utils/logger.js';
import { registerSocketHandlers } from '@/dashboard/socket/handlers.js';
import { config } from '@/config/loader.js';
import { tokensMatch } from '@/dashboard/middleware/auth.js';

let io: SocketIOServer | undefined;

export function initSocketIO(server: HTTPServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: { origin: process.env.NODE_ENV === 'production' ? false : '*' },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    const required = config.dashboard.authToken;
    if (!required) return next();
    const provided = socket.handshake.auth?.token;
    if (tokensMatch(typeof provided === 'string' ? provided : undefined, required)) {
      return next();
    }
    next(new Error('Unauthorized'));
  });

  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'Socket connected');
    registerSocketHandlers(socket);

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'Socket disconnected');
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO has not been initialized');
  }
  return io;
}

export { io };
