import { db } from '@/database/index.js';
import { users, channels, guilds } from '@/database/schema.js';
import { logger } from '@/utils/logger.js';

export interface DiscordUser {
  id: string;
  username: string;
  discriminator?: string;
  avatarURL?: (options?: { size?: number }) => string | null;
  bot: boolean;
}

export interface DiscordChannel {
  id: string;
  name?: string | null;
  type: number | string;
  guildId?: string | null;
  topic?: string | null;
  nsfw?: boolean;
  parentId?: string | null;
}

const CHANNEL_TYPE_NUM: Record<string, number> = {
  GUILD_TEXT: 0, DM: 1, GUILD_VOICE: 2, GROUP_DM: 3, GUILD_CATEGORY: 4,
  GUILD_NEWS: 5, GUILD_NEWS_THREAD: 10, GUILD_PUBLIC_THREAD: 11,
  GUILD_PRIVATE_THREAD: 12, GUILD_STAGE_VOICE: 13, GUILD_FORUM: 15,
};

export interface DiscordGuild {
  id: string;
  name: string;
  iconURL?: (options?: { size?: number }) => string | null;
  ownerId: string;
  memberCount?: number;
  joinedAt: Date | null;
}

class SimpleLRU<T> {
  private cache = new Map<string, T>();
  constructor(private maxSize: number) {}

  get(key: string): T | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    // Promote to newest by re-inserting
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }
    this.cache.delete(key);
    this.cache.set(key, value);
  }
}

// Timestamps of last DB write — re-upsert after 10 min so name/avatar changes propagate
const USER_TTL = 10 * 60 * 1000;
const userCache = new SimpleLRU<number>(1000);
const channelCache = new SimpleLRU<boolean>(1000);
const guildCache = new SimpleLRU<'placeholder' | 'full'>(1000);

export function enrichUser(user: DiscordUser): void {
  const lastSeen = userCache.get(user.id);
  if (lastSeen && Date.now() - lastSeen < USER_TTL) return;

  const avatarUrl = typeof user.avatarURL === 'function' ? user.avatarURL({ size: 128 }) : null;

  try {
    db.insert(users).values({
      id: user.id,
      username: user.username,
      discriminator: user.discriminator ?? '0',
      avatarUrl,
      bot: user.bot,
      firstSeenAt: new Date(),
    }).onConflictDoUpdate({
      target: users.id,
      set: {
        username: user.username,
        discriminator: user.discriminator ?? '0',
        avatarUrl,
        bot: user.bot,
      },
    }).run();
    userCache.set(user.id, Date.now());
  } catch (err) {
    logger.error({ userId: user.id, err }, 'Failed to enrich user');
  }
}

export function enrichChannel(channel: DiscordChannel): void {
  if (channelCache.get(channel.id)) return;

  const type = typeof channel.type === 'number' ? channel.type : (CHANNEL_TYPE_NUM[channel.type] ?? 0);

  try {
    db.insert(channels).values({
      id: channel.id,
      guildId: channel.guildId ?? null,
      name: channel.name ?? null,
      type,
      topic: channel.topic ?? null,
      nsfw: channel.nsfw ?? false,
      parentId: channel.parentId ?? null,
    }).onConflictDoUpdate({
      target: channels.id,
      set: {
        name: channel.name ?? null,
        type,
        topic: channel.topic ?? null,
        nsfw: channel.nsfw ?? false,
        parentId: channel.parentId ?? null,
      },
    }).run();
    channelCache.set(channel.id, true);
  } catch (err) {
    logger.error({ channelId: channel.id, err }, 'Failed to enrich channel');
  }
}

export function enrichGuild(guild: DiscordGuild): void {
  if (guildCache.get(guild.id) === 'full') return;

  const iconUrl = typeof guild.iconURL === 'function' ? guild.iconURL({ size: 128 }) : null;

  try {
    db.insert(guilds).values({
      id: guild.id,
      name: guild.name,
      iconUrl,
      ownerId: guild.ownerId,
      memberCount: guild.memberCount ?? null,
      joinedAt: guild.joinedAt,
      configuredAt: new Date(),
    }).onConflictDoUpdate({
      target: guilds.id,
      set: {
        name: guild.name,
        iconUrl,
        ownerId: guild.ownerId,
        memberCount: guild.memberCount ?? null,
        joinedAt: guild.joinedAt,
      },
    }).run();
    guildCache.set(guild.id, 'full');
  } catch (err) {
    logger.error({ guildId: guild.id, err }, 'Failed to enrich guild');
  }
}

export function ensureGuild(guildId: string): void {
  if (guildCache.get(guildId)) return;

  try {
    db.insert(guilds).values({
      id: guildId,
      name: 'Unknown Guild',
      iconUrl: null,
      ownerId: null,
      memberCount: null,
      joinedAt: null,
      configuredAt: new Date(),
    }).onConflictDoNothing().run();
    guildCache.set(guildId, 'placeholder');
  } catch (err) {
    logger.error({ guildId, err }, 'Failed to ensure guild placeholder');
  }
}
