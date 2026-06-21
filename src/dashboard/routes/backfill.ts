import { Router } from 'express';
import { logger } from '@/utils/logger.js';
import { updateConfigField } from '@/config/loader.js';
import { client } from '@/bot/client.js';
import { startBackfill, stopBackfill, getBackfillStatus } from '@/services/historyBackfill.js';

const router = Router();

router.get('/status', (_req, res) => {
  res.json(getBackfillStatus());
});

router.post('/start', async (req, res, next) => {
  try {
    const { guildIds } = req.body as { guildIds?: string[] };

    if (getBackfillStatus().running) {
      res.status(409).json({ error: 'Backfill already running' });
      return;
    }

    startBackfill(client, guildIds).catch((err) => {
      logger.error({ err }, '[backfill] Background error');
    });

    res.json({ started: true });
  } catch (err) {
    next(err);
  }
});

router.post('/stop', (_req, res) => {
  stopBackfill();
  res.json({ stopping: true });
});

router.patch('/settings', (req, res, next) => {
  try {
    const { perRequest, delayMs } = req.body as { perRequest?: number; delayMs?: number };

    if (perRequest !== undefined) {
      const val = Number(perRequest);
      if (!Number.isInteger(val) || val < 1 || val > 100) {
        res.status(400).json({ error: 'perRequest must be 1–100' });
        return;
      }
      updateConfigField('logging.backfill.perRequest', val);
    }

    if (delayMs !== undefined) {
      const val = Number(delayMs);
      if (!Number.isInteger(val) || val < 0) {
        res.status(400).json({ error: 'delayMs must be ≥ 0' });
        return;
      }
      updateConfigField('logging.backfill.delayMs', val);
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
