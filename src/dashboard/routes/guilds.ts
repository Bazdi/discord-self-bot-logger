import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '@/database/index.js';
import { logger } from '@/utils/logger.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const rows = db.all<{ id: string; name: string; iconUrl: string | null; memberCount: number | null; messageCount: number }>(sql`
      SELECT g.id, g.name, g.icon_url AS iconUrl, g.member_count AS memberCount, count(m.id) AS messageCount
      FROM guilds g
      LEFT JOIN messages m ON m.guild_id = g.id
      GROUP BY g.id
      ORDER BY g.name
    `);

    res.json(
      rows.map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.iconUrl,
        messageCount: g.messageCount,
        memberCount: g.memberCount ?? 0,
      }))
    );
  } catch (err) {
    logger.error(err, 'Failed to fetch guilds');
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const rows = db.all<{ id: string; name: string; iconUrl: string | null; memberCount: number | null; messageCount: number }>(sql`
      SELECT g.id, g.name, g.icon_url AS iconUrl, g.member_count AS memberCount, count(m.id) AS messageCount
      FROM guilds g
      LEFT JOIN messages m ON m.guild_id = g.id
      WHERE g.id = ${req.params.id}
      GROUP BY g.id
    `);

    if (rows.length === 0) {
      res.status(404).json({ error: 'Guild not found' });
      return;
    }

    const g = rows[0];
    res.json({
      id: g.id,
      name: g.name,
      icon: g.iconUrl,
      messageCount: g.messageCount,
      memberCount: g.memberCount ?? 0,
    });
  } catch (err) {
    logger.error(err, 'Failed to fetch guild');
    next(err);
  }
});

router.get('/:id/channels', async (req, res, next) => {
  try {
    const gId = req.params.id;
    // Primary source: channels table (has name + type).
    // Fallback: distinct channel IDs seen in messages that were never stored
    // in the channels table (e.g. because the channel event wasn't captured).
    const rows = db.all<{ id: string; name: string | null; type: number | null; messageCount: number }>(sql`
      SELECT c.id, c.name, c.type, count(m.id) AS messageCount
      FROM channels c
      LEFT JOIN messages m ON m.channel_id = c.id
      WHERE c.guild_id = ${gId}
      GROUP BY c.id

      UNION ALL

      SELECT m.channel_id AS id, NULL AS name, NULL AS type, count(*) AS messageCount
      FROM messages m
      WHERE m.guild_id = ${gId}
        AND NOT EXISTS (SELECT 1 FROM channels WHERE id = m.channel_id AND guild_id = ${gId})
      GROUP BY m.channel_id

      ORDER BY messageCount DESC, name ASC
    `);

    res.json(
      rows.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        messageCount: c.messageCount,
      }))
    );
  } catch (err) {
    logger.error(err, 'Failed to fetch channels');
    next(err);
  }
});

export default router;
