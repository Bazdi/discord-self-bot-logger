import { Client } from 'discord.js-selfbot-v13';
import { config } from '@/config/loader.js';
import { handleMessageCreate } from './messageCreate.js';
import { handleMessageUpdate } from './messageUpdate.js';
import { handleMessageDelete, handleMessageDeleteBulk } from './messageDelete.js';
import {
  handleReactionAdd,
  handleReactionRemove,
  handleReactionRemoveAll,
  handleReactionRemoveEmoji,
} from './reactions.js';
import {
  handleGuildMemberAdd,
  handleGuildMemberRemove,
  handleGuildBanAdd,
  handleGuildBanRemove,
  handleGuildMemberUpdate,
} from './members.js';
import { handleVoiceStateUpdate } from './voice.js';
import {
  handleChannelCreate,
  handleChannelUpdate,
  handleChannelDelete,
  handleRoleCreate,
  handleRoleUpdate,
  handleRoleDelete,
  handleGuildUpdate,
  handleThreadCreate,
  handleThreadUpdate,
  handleThreadDelete,
} from './guildAudit.js';
import { handlePresenceUpdate } from './presence.js';

export function registerEvents(client: Client) {
  if (config.logging.events.messages) {
    client.on('messageCreate', (...args) => handleMessageCreate(client, ...args));
  }

  if (config.logging.events.messageEdits) {
    client.on('messageUpdate', (...args) => handleMessageUpdate(client, ...args));
  }

  if (config.logging.events.messageDeletes) {
    client.on('messageDelete', (...args) => handleMessageDelete(client, ...args));
    client.on('messageDeleteBulk', (...args) => handleMessageDeleteBulk(client, ...args));
  }

  if (config.logging.events.reactions) {
    client.on('messageReactionAdd', (...args) => handleReactionAdd(client, ...args));
    client.on('messageReactionRemove', (...args) => handleReactionRemove(client, ...args));
    client.on('messageReactionRemoveAll', (...args) => handleReactionRemoveAll(client, ...args));
    client.on('messageReactionRemoveEmoji', (...args) => handleReactionRemoveEmoji(client, ...args));
  }

  if (config.logging.events.members) {
    client.on('guildMemberAdd', (...args) => handleGuildMemberAdd(client, ...args));
    client.on('guildMemberRemove', (...args) => handleGuildMemberRemove(client, ...args));
    client.on('guildBanAdd', (...args) => handleGuildBanAdd(client, ...args));
    client.on('guildBanRemove', (...args) => handleGuildBanRemove(client, ...args));
    client.on('guildMemberUpdate', (...args) => handleGuildMemberUpdate(client, ...args));
  }

  if (config.logging.events.voice) {
    client.on('voiceStateUpdate', (...args) => handleVoiceStateUpdate(client, ...args));
  }

  if (config.logging.events.guildChanges) {
    client.on('guildUpdate', (...args) => handleGuildUpdate(client, ...args));
  }

  if (config.logging.events.channelChanges) {
    client.on('channelCreate', (...args) => handleChannelCreate(client, ...args));
    client.on('channelUpdate', (...args) => handleChannelUpdate(client, ...args));
    client.on('channelDelete', (...args) => handleChannelDelete(client, ...args));
  }

  if (config.logging.events.roleChanges) {
    client.on('roleCreate', (...args) => handleRoleCreate(client, ...args));
    client.on('roleUpdate', (...args) => handleRoleUpdate(client, ...args));
    client.on('roleDelete', (...args) => handleRoleDelete(client, ...args));
  }

  if (config.logging.events.threads) {
    client.on('threadCreate', (...args) => handleThreadCreate(client, ...args));
    client.on('threadUpdate', (...args) => handleThreadUpdate(client, ...args));
    client.on('threadDelete', (...args) => handleThreadDelete(client, ...args));
  }

  if (config.logging.presence.enabled) {
    client.on('presenceUpdate', (...args) => handlePresenceUpdate(client, ...args));
  }
}
