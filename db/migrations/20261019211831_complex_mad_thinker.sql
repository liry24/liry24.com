CREATE TABLE `admin_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`model` text,
	`label` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_events_actor_time` ON `admin_events` (`actor_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `username` text;--> statement-breakpoint
ALTER TABLE `users` ADD `display_username` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);