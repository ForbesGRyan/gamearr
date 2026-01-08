CREATE TABLE `game_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`update_type` text NOT NULL,
	`title` text NOT NULL,
	`version` text,
	`size` integer,
	`quality` text,
	`seeders` integer,
	`download_url` text,
	`indexer` text,
	`detected_at` integer DEFAULT (unixepoch()) NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `libraries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`platform` text,
	`monitored` integer DEFAULT true NOT NULL,
	`download_enabled` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE games ADD `store` text;--> statement-breakpoint
ALTER TABLE games ADD `steam_name` text;--> statement-breakpoint
ALTER TABLE games ADD `library_id` integer REFERENCES libraries(id);--> statement-breakpoint
ALTER TABLE games ADD `summary` text;--> statement-breakpoint
ALTER TABLE games ADD `genres` text;--> statement-breakpoint
ALTER TABLE games ADD `total_rating` integer;--> statement-breakpoint
ALTER TABLE games ADD `developer` text;--> statement-breakpoint
ALTER TABLE games ADD `publisher` text;--> statement-breakpoint
ALTER TABLE games ADD `game_modes` text;--> statement-breakpoint
ALTER TABLE games ADD `similar_games` text;--> statement-breakpoint
ALTER TABLE games ADD `installed_version` text;--> statement-breakpoint
ALTER TABLE games ADD `installed_quality` text;--> statement-breakpoint
ALTER TABLE games ADD `latest_version` text;--> statement-breakpoint
ALTER TABLE games ADD `update_policy` text DEFAULT 'notify';--> statement-breakpoint
ALTER TABLE games ADD `last_update_check` integer;--> statement-breakpoint
ALTER TABLE games ADD `update_available` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE library_files ADD `library_id` integer REFERENCES libraries(id);--> statement-breakpoint
ALTER TABLE releases ADD `torrent_hash` text;--> statement-breakpoint
CREATE INDEX `game_updates_game_id_idx` ON `game_updates` (`game_id`);--> statement-breakpoint
CREATE INDEX `game_updates_status_idx` ON `game_updates` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `libraries_path_unique` ON `libraries` (`path`);--> statement-breakpoint
CREATE UNIQUE INDEX `download_history_download_id_unique` ON `download_history` (`download_id`);--> statement-breakpoint
CREATE INDEX `download_history_game_id_idx` ON `download_history` (`game_id`);--> statement-breakpoint
CREATE INDEX `download_history_release_id_idx` ON `download_history` (`release_id`);--> statement-breakpoint
CREATE INDEX `download_history_status_idx` ON `download_history` (`status`);--> statement-breakpoint
CREATE INDEX `games_status_idx` ON `games` (`status`);--> statement-breakpoint
CREATE INDEX `games_monitored_idx` ON `games` (`monitored`);--> statement-breakpoint
CREATE INDEX `games_library_id_idx` ON `games` (`library_id`);--> statement-breakpoint
CREATE INDEX `library_files_matched_game_id_idx` ON `library_files` (`matched_game_id`);--> statement-breakpoint
CREATE INDEX `library_files_library_id_idx` ON `library_files` (`library_id`);--> statement-breakpoint
CREATE INDEX `library_files_ignored_idx` ON `library_files` (`ignored`);--> statement-breakpoint
CREATE INDEX `releases_game_id_idx` ON `releases` (`game_id`);--> statement-breakpoint
CREATE INDEX `releases_status_idx` ON `releases` (`status`);--> statement-breakpoint
CREATE INDEX `releases_torrent_hash_idx` ON `releases` (`torrent_hash`);--> statement-breakpoint
/*
 SQLite does not support "Creating foreign key on existing column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html

 Due to that we don't generate migration automatically and it has to be done manually
*/