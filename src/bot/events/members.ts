import { Client, GuildMember, PartialGuildMember, GuildBan } from 'discord.js-selfbot-v13';
import { db } from '@/database/index.js';
import { memberEvents } from '@/database/schema.js';
import { logger } from '@/utils/logger.js';
import { requireGuild } from '../guildFilter.js';
import { broadcaster } from '@/dashboard/socket/broadcaster.js';
import { enrichUser } from '@/services/enricher.js';

async function onGuildMemberAdd(client: Client, member: GuildMember) {
  try {
    const guildId = member.guild.id;
    const userId = member.id;
    const createdAt = new Date();

    if (member.user) enrichUser({ id: member.user.id, username: member.user.username, discriminator: member.user.discriminator, avatarURL: member.user.avatarURL.bind(member.user) as any, bot: member.user.bot });

    db.insert(memberEvents).values({
      guildId,
      userId,
      eventType: 'JOIN',
      rolesJson: JSON.stringify(member.roles.cache.map((r) => r.id)),
      createdAt,
    }).run();

    broadcaster.toGuild(guildId, 'member:event', { guildId, userId, eventType: 'JOIN', createdAt });
  } catch (err) {
    logger.error({ err }, 'Error in guildMemberAdd handler');
  }
}

async function onGuildMemberRemove(client: Client, member: GuildMember | PartialGuildMember) {
  try {
    const guildId = member.guild.id;
    const userId = member.id;
    const createdAt = new Date();

    if (member.user) enrichUser({ id: member.user.id, username: member.user.username, discriminator: member.user.discriminator, avatarURL: member.user.avatarURL.bind(member.user) as any, bot: member.user.bot });

    db.insert(memberEvents).values({
      guildId,
      userId,
      eventType: 'LEAVE',
      rolesJson: null,
      createdAt,
    }).run();

    broadcaster.toGuild(guildId, 'member:event', { guildId, userId, eventType: 'LEAVE', createdAt });
  } catch (err) {
    logger.error({ err }, 'Error in guildMemberRemove handler');
  }
}

async function onGuildBanAdd(client: Client, ban: GuildBan) {
  try {
    const guildId = ban.guild.id;
    const userId = ban.user.id;
    const createdAt = new Date();

    enrichUser({ id: ban.user.id, username: ban.user.username, discriminator: ban.user.discriminator, avatarURL: ban.user.avatarURL.bind(ban.user) as any, bot: ban.user.bot });

    db.insert(memberEvents).values({
      guildId,
      userId,
      eventType: 'BAN',
      rolesJson: null,
      createdAt,
    }).run();

    broadcaster.toGuild(guildId, 'member:event', { guildId, userId, eventType: 'BAN', createdAt });
  } catch (err) {
    logger.error({ err }, 'Error in guildBanAdd handler');
  }
}

async function onGuildBanRemove(client: Client, ban: GuildBan) {
  try {
    const guildId = ban.guild.id;
    const userId = ban.user.id;
    const createdAt = new Date();

    enrichUser({ id: ban.user.id, username: ban.user.username, discriminator: ban.user.discriminator, avatarURL: ban.user.avatarURL.bind(ban.user) as any, bot: ban.user.bot });

    db.insert(memberEvents).values({
      guildId,
      userId,
      eventType: 'UNBAN',
      rolesJson: null,
      createdAt,
    }).run();

    broadcaster.toGuild(guildId, 'member:event', { guildId, userId, eventType: 'UNBAN', createdAt });
  } catch (err) {
    logger.error({ err }, 'Error in guildBanRemove handler');
  }
}

async function onGuildMemberUpdate(
  client: Client,
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
) {
  try {
    const guildId = newMember.guild.id;
    const userId = newMember.id;
    const createdAt = new Date();

    if (newMember.user) enrichUser({ id: newMember.user.id, username: newMember.user.username, discriminator: newMember.user.discriminator, avatarURL: newMember.user.avatarURL.bind(newMember.user) as any, bot: newMember.user.bot });

    // Nick diff
    const oldNick = oldMember.nickname ?? null;
    const newNick = newMember.nickname ?? null;
    if (oldNick !== newNick) {
      db.insert(memberEvents).values({
        guildId,
        userId,
        eventType: 'NICK_CHANGE',
        oldValue: oldNick,
        newValue: newNick,
        rolesJson: null,
        createdAt,
      }).run();

      broadcaster.toGuild(guildId, 'member:event', {
        guildId,
        userId,
        eventType: 'NICK_CHANGE',
        oldValue: oldNick,
        newValue: newNick,
        createdAt,
      });
    }

    // Roles diff
    const oldRoles = new Set(oldMember.roles?.cache?.map((r) => r.id) ?? []);
    const newRoles = new Set(newMember.roles.cache.map((r) => r.id));
    const added = [...newRoles].filter((r) => !oldRoles.has(r));
    const removed = [...oldRoles].filter((r) => !newRoles.has(r));

    if (added.length > 0 || removed.length > 0) {
      db.insert(memberEvents).values({
        guildId,
        userId,
        eventType: 'UPDATE',
        oldValue: JSON.stringify(removed),
        newValue: JSON.stringify(added),
        rolesJson: JSON.stringify(newMember.roles.cache.map((r) => r.id)),
        createdAt,
      }).run();

      broadcaster.toGuild(guildId, 'member:event', {
        guildId,
        userId,
        eventType: 'UPDATE',
        addedRoles: added,
        removedRoles: removed,
        createdAt,
      });
    }
  } catch (err) {
    logger.error({ err }, 'Error in guildMemberUpdate handler');
  }
}

export const handleGuildMemberAdd = requireGuild(onGuildMemberAdd);
export const handleGuildMemberRemove = requireGuild(onGuildMemberRemove);
export const handleGuildBanAdd = requireGuild(onGuildBanAdd);
export const handleGuildBanRemove = requireGuild(onGuildBanRemove);
export const handleGuildMemberUpdate = requireGuild(onGuildMemberUpdate);
