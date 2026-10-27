CREATE TABLE `vitehub_content_sessions` (
	`workspace` text NOT NULL,
	`collection` text NOT NULL,
	`document` text NOT NULL,
	`session` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text,
	`user_image` text,
	`kind` text NOT NULL,
	`acquired_at` integer,
	`renewed_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_input_at` integer,
	PRIMARY KEY(`workspace`, `collection`, `document`, `session`)
);
--> statement-breakpoint
CREATE INDEX `vitehub_content_sessions_expiry` ON `vitehub_content_sessions` (`workspace`,`expires_at`);--> statement-breakpoint
CREATE TABLE `liti_gameStats` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`game` text,
	`periodKey` text,
	`period` text,
	`order` integer,
	`start` text,
	`end` text,
	`values` text,
	`href` text,
	FOREIGN KEY (`game`) REFERENCES `liti_games`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `liti_gameStats_unique_0` ON `liti_gameStats` (`game`,`periodKey`);--> statement-breakpoint
CREATE TABLE `liti_games` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`igdbId` integer,
	`slug` text,
	`name` text,
	`cover` text,
	`icon` text,
	`primaryMetric` text,
	`order` real,
	`metrics` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `liti_games_unique_0` ON `liti_games` (`igdbId`);--> statement-breakpoint
CREATE UNIQUE INDEX `liti_games_unique_1` ON `liti_games` (`slug`);--> statement-breakpoint
CREATE TABLE `liti_ranks` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`game` text,
	`image` text,
	`slug` text,
	`season` text,
	`rank` text,
	`href` text,
	`order` real
);
--> statement-breakpoint
CREATE TABLE `liti_socials` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`label` text,
	`slug` text,
	`href` text,
	`icon` text,
	`order` real
);
--> statement-breakpoint
CREATE UNIQUE INDEX `liti_socials_unique_0` ON `liti_socials` (`slug`);--> statement-breakpoint
CREATE TABLE `workspace_history_metadata` (
	`workspace` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`workspace`, `key`)
);
--> statement-breakpoint
CREATE TABLE `workspace_history_objects` (
	`workspace` text NOT NULL,
	`digest` text NOT NULL,
	`size` integer NOT NULL,
	PRIMARY KEY(`workspace`, `digest`)
);
--> statement-breakpoint
CREATE TABLE `workspace_history_refs` (
	`workspace` text NOT NULL,
	`ref` text NOT NULL,
	`head` text,
	`sequence` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`workspace`, `ref`)
);
--> statement-breakpoint
CREATE TABLE `workspace_history_revisions` (
	`workspace` text NOT NULL,
	`id` text NOT NULL,
	`ref` text NOT NULL,
	`parent_id` text,
	`sequence` integer NOT NULL,
	`created_at` text NOT NULL,
	`message` text,
	`metadata` text,
	`files` integer NOT NULL,
	`bytes` integer NOT NULL,
	`entries` text NOT NULL,
	`committed` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`workspace`, `id`)
);
--> statement-breakpoint
CREATE INDEX `workspace_history_timeline` ON `workspace_history_revisions` (`workspace`,`ref`,`committed`,`sequence`);--> statement-breakpoint
CREATE TABLE `workspace_history_workspaces` (
	`workspace` text PRIMARY KEY NOT NULL,
	`deleted` integer DEFAULT false NOT NULL
);
