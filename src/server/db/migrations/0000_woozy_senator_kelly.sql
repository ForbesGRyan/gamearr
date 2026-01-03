CREATE TABLE `download_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`release_id` integer NOT NULL,
	`download_id` text NOT NULL,
	`status` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`release_id`) REFERENCES `releases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`igdb_id` integer NOT NULL,
	`title` text NOT NULL,
	`year` integer,
	`platform` text NOT NULL,
	`monitored` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'wanted' NOT NULL,
	`cover_url` text,
	`folder_path` text,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `releases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`title` text NOT NULL,
	`size` integer,
	`seeders` integer,
	`download_url` text NOT NULL,
	`indexer` text NOT NULL,
	`quality` text,
	`grabbed_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_igdb_id_unique` ON `games` (`igdb_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_unique` ON `settings` (`key`);