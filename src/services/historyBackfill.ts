import type { Client } from 'discord.js-selfbot-v13';
import { db } from '@/database/index.js';
import { messages } from '@/database/schema.js';
import { logger } from '@/utils/logger.js';
import { config } from '@/config/loader.js';
import { enrichUser, enrichChannel, enrichGuild } from '@/services/enricher.js';

const CHANNEL_TYPE_NUM: Record<string, number> = {
  GUILD_TEXT: 0, DM: 1, GUILD_VOICE: 2, GROUP_DM: 3, GUILD_CATEGORY: 4,
  GUILD_NEWS: 5, GUILD_NEWS_THREAD: 10, GUILD_PUBLIC_THREAD: 11,
  GUILD_PRIVATE_THREAD: 12, GUILD_STAGE_VOICE: 13, GUILD_FORUM: 15,
};

function resolveChannelType(type: unknown): number {
  if (typeof type === 'number') return type;
  if (typeof type === 'string') return CHANNEL_TYPE_NUM[type] ?? 0;
  return 0;
}

// Text channels that can have messages fetched via the messages API
const BACKFILLABLE_TYPES = new Set([0, 5, 15]);

function isBackfillable(ch: any): boolean {
  if (typeof ch.messages?.fetch !== 'function') return false;
  return BACKFILLABLE_TYPES.has(resolveChannelType(ch.type));
}

export interface ChannelProgress {
  channelId: string;
  channelName: string | null;
  fetched: number;
  done: boolean;
}

export interface GuildProgress {
  guildId: string;
  guildName: string;
  channels: ChannelProgress[];
  fetched: number;
  done: boolean;
  startedAt: number;
  elapsedMs: number;
}

export interface BackfillStatus {
  running: boolean;
  startedAt: number | null;
  elapsedMs: number | null;
  totalFetched: number;
  currentGuild: string | null;
  currentChannel: string | null;
  guilds: GuildProgress[];
  stoppedEarly: boolean;
}

let _running = false;
let _stop = false;
let _startedAt: number | null = null;
let _totalFetched = 0;
let _currentGuild: string | null = null;
let _currentChannel: string | null = null;
let _guildProgress: GuildProgress[] = [];
let _stoppedEarly = false;

export function getBackfillStatus(): BackfillStatus {
  const now = Date.now();
  return {
    running: _running,
    startedAt: _startedAt,
    elapsedMs: _startedAt ? now - _startedAt : null,
    totalFetched: _totalFetched,
    currentGuild: _currentGuild,
    currentChannel: _currentChannel,
    guilds: _guildProgress.map((g) => ({
      ...g,
      elapsedMs: g.startedAt ? now - g.startedAt : 0,
    })),
    stoppedEarly: _stoppedEarly,
  };
}

export function stopBackfill(): void {
  _stop = true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startBackfill(client: Client, guildIds?: string[]): Promise<void> {
  if (_running) throw new Error('Backfill already running');

  _running = true;
  _stop = false;
  _startedAt = Date.now();
  _totalFetched = 0;
  _currentGuild = null;
  _currentChannel = null;
  _guildProgress = [];
  _stoppedEarly = false;

  const { perRequest = 100, delayMs = 1500 } = config.logging.backfill;

  const trackedGuilds = config.logging.guilds;
  const targetIds =
    guildIds && guildIds.length > 0
      ? guildIds.filter((id) => trackedGuilds.length === 0 || trackedGuilds.includes(id))
      : trackedGuilds;

  logger.info({ targetIds, perRequest, delayMs }, '[backfill] Starting');

  try {
    for (const guildId of targetIds) {
      if (_stop) { _stoppedEarly = true; break; }

      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        logger.warn({ guildId }, '[backfill] Guild not in cache, skipping');
        continue;
      }

      enrichGuild({
        id: guild.id,
        name: guild.name,
        iconURL: guild.iconURL.bind(guild) as any,
        ownerId: guild.ownerId,
        memberCount: guild.memberCount,
        joinedAt: guild.joinedAt,
      });

      _currentGuild = guild.name;
      const guildEntry: GuildProgress = {
        guildId,
        guildName: guild.name,
        channels: [],
        fetched: 0,
        done: false,
        startedAt: Date.now(),
        elapsedMs: 0,
      };
      _guildProgress.push(guildEntry);

      const guildStart = Date.now();
      const textChannels = guild.channels.cache.filter((ch: any) => isBackfillable(ch));

      logger.info(
        { guildId, guildName: guild.name, channelCount: textChannels.size },
        '[backfill] Starting guild',
      );

      for (const [, channel] of textChannels) {
        if (_stop) { _stoppedEarly = true; break; }

        const ch = channel as any;
        _currentChannel = ch.name ?? ch.id;

        enrichChannel({
          id: ch.id,
          name: ch.name ?? null,
          type: resolveChannelType(ch.type),
          guildId,
          topic: ch.topic ?? null,
          nsfw: ch.nsfw ?? false,
          parentId: ch.parentId ?? null,
        });

        const chanEntry: ChannelProgress = {
          channelId: ch.id,
          channelName: ch.name ?? null,
          fetched: 0,
          done: false,
        };
        guildEntry.channels.push(chanEntry);

        const chanStart = Date.now();
        let before: string | undefined = undefined;
        let channelFetched = 0;

        while (true) {
          if (_stop) { _stoppedEarly = true; break; }

          let batch: any;
          try {
            const opts: Record<string, unknown> = { limit: perRequest };
            if (before) opts.before = before;
            batch = await ch.messages.fetch(opts);
          } catch (err: any) {
            if (err?.httpStatus === 403 || err?.code === 50013) {
              logger.warn({ guildId, channelId: ch.id, channelName: ch.name }, '[backfill] No permission, skipping');
            } else {
              logger.error({ err, guildId, channelId: ch.id }, '[backfill] Fetch error');
            }
            break;
          }

          if (!batch || batch.size === 0) break;

          let batchStored = 0;
          for (const [, msg] of batch) {
            if (msg.author) {
              enrichUser({
                id: msg.author.id,
                username: msg.author.username,
                discriminator: msg.author.discriminator,
                avatarURL: msg.author.avatarURL.bind(msg.author) as any,
                bot: msg.author.bot,
              });
            }

            try {
              db.insert(messages).values({
                id: msg.id,
                guildId,
                channelId: ch.id,
                authorId: msg.author?.id ?? 'unknown',
                content: msg.content ?? '',
                createdAt: new Date(msg.createdTimestamp),
                isDm: false,
                replyToId: msg.reference?.messageId ?? null,
                embedsJson: msg.embeds?.length > 0 ? JSON.stringify(msg.embeds) : null,
                flags: msg.flags?.bitfield ?? 0,
              }).onConflictDoNothing().run();
              batchStored++;
            } catch (err) {
              logger.error({ err, msgId: msg.id }, '[backfill] Insert failed');
            }
          }

          channelFetched += batchStored;
          chanEntry.fetched += batchStored;
          guildEntry.fetched += batchStored;
          _totalFetched += batchStored;

          // Oldest message in batch = next pagination cursor
          before = batch.last()?.id;

          logger.debug({
            guildId,
            channelId: ch.id,
            batchSize: batch.size,
            batchStored,
            channelTotal: channelFetched,
            grandTotal: _totalFetched,
          }, '[backfill] Batch stored');

          if (batch.size < perRequest) break;

          await sleep(delayMs);
        }

        chanEntry.done = true;
        logger.info({
          guildId,
          channelId: ch.id,
          channelName: ch.name,
          fetched: channelFetched,
          elapsedMs: Date.now() - chanStart,
        }, '[backfill] Channel done');
      }

      guildEntry.done = true;
      logger.info({
        guildId,
        guildName: guild.name,
        fetched: guildEntry.fetched,
        channels: guildEntry.channels.length,
        elapsedMs: Date.now() - guildStart,
      }, '[backfill] Guild done');
    }

    logger.info({
      totalFetched: _totalFetched,
      guilds: _guildProgress.length,
      elapsedMs: Date.now() - (_startedAt ?? 0),
      stoppedEarly: _stoppedEarly,
    }, '[backfill] Complete');

  } catch (err) {
    logger.error({ err }, '[backfill] Fatal error');
  } finally {
    _running = false;
    _currentGuild = null;
    _currentChannel = null;
  }
}
