CREATE TABLE `library_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`folder_path` text NOT NULL,
	`parsed_title` text,
	`parsed_year` integer,
	`matched_game_id` integer,
	`ignored` integer DEFAULT false NOT NULL,
	`scanned_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`matched_game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_files_folder_path_unique` ON `library_files` (`folder_path`);