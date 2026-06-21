import express from 'express';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import path from 'node:path';
import { logger } from '@/utils/logger.js';
import { errorHandler } from '@/dashboard/middleware/errorHandler.js';
import { initSocketIO } from '@/dashboard/socket/index.js';
import { config } from '@/config/loader.js';
import { apiAuth } from '@/dashboard/middleware/auth.js';

import healthRouter from '@/dashboard/routes/health.js';
import configRouter from '@/dashboard/routes/config.js';
import messagesRouter from '@/dashboard/routes/messages.js';
import searchRouter from '@/dashboard/routes/search.js';
import activityRouter from '@/dashboard/routes/activity.js';
import usersRouter from '@/dashboard/routes/users.js';
import statsRouter from '@/dashboard/routes/stats.js';
import exportRouter from '@/dashboard/routes/export.js';
import guildsRouter from '@/dashboard/routes/guilds.js';
import attachmentsRouter from '@/dashboard/routes/attachments.js';
import purgeRouter from '@/dashboard/routes/purge.js';

export function startDashboardServer(host: string, port: number): HttpServer {
  const app = express();
  const server = createServer(app);

  const isLoopback = host === '127.0.0.1' || host === '::1' || host === 'localhost';
  if (!isLoopback && !config.dashboard.authToken) {
    logger.warn(
      `Dashboard bound to non-loopback host "${host}" without dashboard.authToken set — ` +
        'the API and all logged Discord data are exposed to your network. ' +
        'Set dashboard.authToken or bind to 127.0.0.1.'
    );
  }

  initSocketIO(server);

  app.use(express.json({ limit: '1mb' }));
  app.use('/api/v1', apiAuth);
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/config', configRouter);
  app.use('/api/v1/messages', messagesRouter);
  app.use('/api/v1/search', searchRouter);
  app.use('/api/v1/activity', activityRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/stats', statsRouter);
  app.use('/api/v1/export', exportRouter);
  app.use('/api/v1/guilds', guildsRouter);
  app.use('/api/v1/attachments', attachmentsRouter);
  app.use('/api/v1/purge', purgeRouter);

  const staticPath = path.resolve(process.cwd(), 'dashboard-ui', 'dist');
  app.use(express.static(staticPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });

  app.use(errorHandler);

  server.listen(port, host, () => {
    logger.info(
      `Dashboard server running at http://${host}:${port}`
    );
  });

  return server;
}
