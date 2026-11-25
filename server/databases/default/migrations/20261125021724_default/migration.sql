CREATE TABLE `game_catalog` (
	`id` text PRIMARY KEY,
	`igdb_id` integer NOT NULL UNIQUE,
	`slug` text NOT NULL UNIQUE,
	`data` text NOT NULL
);
