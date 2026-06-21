CREATE TABLE IF NOT EXISTS `roles` (
  `id` text PRIMARY KEY NOT NULL,
  `guild_id` text NOT NULL REFERENCES `guilds`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `color` integer,
  `updated_at` integer
);
