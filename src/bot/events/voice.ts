import { Client, VoiceState } from 'discord.js-selfbot-v13';
import { db } from '@/database/index.js';
import { voiceEvents } from '@/database/schema.js';
import { logger } from '@/utils/logger.js';
import { requireGuild } from '../guildFilter.js';
import { broadcaster } from '@/dashboard/socket/broadcaster.js';
import { enrichUser, enrichChannel } from '@/services/enricher.js';

function determineVoiceEvent(
  oldState: VoiceState,
  newState: VoiceState
): { type: string; oldValue: string | null; newValue: string | null } {
  const oldChannel = oldState.channelId;
  const newChannel = newState.channelId;

  if (!oldChannel && newChannel) return { type: 'JOIN', oldValue: null, newValue: newChannel };
  if (oldChannel && !newChannel) return { type: 'LEAVE', oldValue: oldChannel, newValue: null };
  if (oldChannel && newChannel && oldChannel !== newChannel) return { type: 'MOVE', oldValue: oldChannel, newValue: newChannel };

  if (oldState.mute !== newState.mute || oldState.selfMute !== newState.selfMute) {
    return {
      type: 'MUTE',
      oldValue: String(oldState.mute || oldState.selfMute),
      newValue: String(newState.mute || newState.selfMute),
    };
  }
  if (oldState.deaf !== newState.deaf || oldState.selfDeaf !== newState.selfDeaf) {
    return {
      type: 'DEAF',
      oldValue: String(oldState.deaf || oldState.selfDeaf),
      newValue: String(newState.deaf || newState.selfDeaf),
    };
  }
  if (oldState.streaming !== newState.streaming) {
    return { type: 'STREAM', oldValue: String(oldState.streaming), newValue: String(newState.streaming) };
  }
  if (oldState.selfVideo !== newState.selfVideo) {
    return { type: 'VIDEO', oldValue: String(oldState.selfVideo), newValue: String(newState.selfVideo) };
  }

  return { type: 'UNKNOWN', oldValue: null, newValue: null };
}

async function onVoiceStateUpdate(client: Client, oldState: VoiceState, newState: VoiceState) {
  try {
    const guildId = newState.guild.id;
    const userId = newState.id;
    const channelId = newState.channelId ?? oldState.channelId ?? null;
    const { type, oldValue, newValue } = determineVoiceEvent(oldState, newState);
    if (type === 'UNKNOWN') return;

    const createdAt = new Date();

    const member = newState.member ?? oldState.member;
    const user = member?.user ?? client.users.cache.get(userId) ?? null;
    if (user) {
      enrichUser({
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatarURL: user.avatarURL.bind(user) as any,
        bot: user.bot,
      });
    }

    // Enrich both the old and new channel so voice channels appear in the channels table
    for (const state of [oldState, newState]) {
      const ch = state.channel as any;
      if (ch) {
        enrichChannel({
          id: ch.id,
          name: ch.name ?? null,
          type: ch.type,
          guildId,
          topic: null,
          nsfw: ch.nsfw ?? false,
          parentId: ch.parentId ?? null,
        });
      }
    }

    db.insert(voiceEvents).values({
      guildId,
      userId,
      channelId,
      eventType: type,
      oldValue,
      newValue,
      createdAt,
    }).run();

    broadcaster.toGuild(guildId, 'voice:event', {
      guildId,
      userId,
      channelId,
      eventType: type,
      oldValue,
      newValue,
      createdAt,
    });
  } catch (err) {
    logger.error({ err }, 'Error in voiceStateUpdate handler');
  }
}

export const handleVoiceStateUpdate = requireGuild(onVoiceStateUpdate);
