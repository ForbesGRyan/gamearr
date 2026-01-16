CREATE TABLE `api_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cache_key` text NOT NULL,
	`cache_type` text NOT NULL,
	`data` text NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_embeddings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`title_hash` text NOT NULL,
	`embedding` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `game_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`data` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `game_folders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`folder_path` text NOT NULL,
	`version` text,
	`quality` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `game_stores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`store_id` integer NOT NULL,
	`store_game_id` text,
	`store_name` text,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`icon_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`api_key_hash` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
ALTER TABLE games ADD `slug` text;--> statement-breakpoint
ALTER TABLE games ADD `hltb_id` text;--> statement-breakpoint
ALTER TABLE games ADD `hltb_main` integer;--> statement-breakpoint
ALTER TABLE games ADD `hltb_main_extra` integer;--> statement-breakpoint
ALTER TABLE games ADD `hltb_completionist` integer;--> statement-breakpoint
ALTER TABLE games ADD `hltb_last_sync` integer;--> statement-breakpoint
ALTER TABLE games ADD `protondb_tier` text;--> statement-breakpoint
ALTER TABLE games ADD `protondb_score` integer;--> statement-breakpoint
ALTER TABLE games ADD `protondb_last_sync` integer;--> statement-breakpoint
ALTER TABLE libraries ADD `download_category` text DEFAULT 'gamearr';--> statement-breakpoint
CREATE UNIQUE INDEX `api_cache_cache_key_unique` ON `api_cache` (`cache_key`);--> statement-breakpoint
CREATE INDEX `api_cache_key_idx` ON `api_cache` (`cache_key`);--> statement-breakpoint
CREATE INDEX `api_cache_expires_at_idx` ON `api_cache` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_embeddings_game_id_unique` ON `game_embeddings` (`game_id`);--> statement-breakpoint
CREATE INDEX `game_embeddings_title_hash_idx` ON `game_embeddings` (`title_hash`);--> statement-breakpoint
CREATE INDEX `game_events_game_id_idx` ON `game_events` (`game_id`);--> statement-breakpoint
CREATE INDEX `game_events_event_type_idx` ON `game_events` (`event_type`);--> statement-breakpoint
CREATE INDEX `game_folders_game_id_idx` ON `game_folders` (`game_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_folders_folder_path_unique` ON `game_folders` (`folder_path`);--> statement-breakpoint
CREATE INDEX `game_stores_game_id_idx` ON `game_stores` (`game_id`);--> statement-breakpoint
CREATE INDEX `game_stores_store_id_idx` ON `game_stores` (`store_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_stores_game_id_store_id_unique` ON `game_stores` (`game_id`,`store_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_token_idx` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `stores_name_unique` ON `stores` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `stores_slug_unique` ON `stores` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `users_username_idx` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `games_slug_idx` ON `games` (`slug`);--> statement-breakpoint
CREATE INDEX `games_status_monitored_idx` ON `games` (`status`,`monitored`);--> statement-breakpoint
CREATE INDEX `games_library_status_idx` ON `games` (`library_id`,`status`);