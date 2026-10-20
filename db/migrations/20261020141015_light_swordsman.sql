CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`issuer` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_userId_idx` ON `accounts` (`user_id`);--> statement-breakpoint
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
CREATE TABLE `liti_asset_refs` (
	`revision_id` text NOT NULL,
	`locale` text DEFAULT '' NOT NULL,
	`field_path` text NOT NULL,
	`asset_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`revision_id`, `locale`, `field_path`, `position`),
	FOREIGN KEY (`revision_id`) REFERENCES `liti_revisions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `liti_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `liti_asset_refs_asset` ON `liti_asset_refs` (`asset_id`);--> statement-breakpoint
CREATE TABLE `liti_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`storage` text NOT NULL,
	`key` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`checksum` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`state` text NOT NULL,
	`operation_token` text,
	`lease_expires_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `liti_assets_key` ON `liti_assets` (`storage`,`key`);--> statement-breakpoint
CREATE INDEX `liti_assets_gc` ON `liti_assets` (`state`,`created_at`);--> statement-breakpoint
CREATE TABLE `liti_content_arts` (
	`revision_id` text PRIMARY KEY NOT NULL,
	`field_title` text NOT NULL,
	`field_images` text NOT NULL,
	`field_slug` text,
	`field_description` text,
	`field_href` text,
	`field_createdAt` text,
	FOREIGN KEY (`revision_id`) REFERENCES `liti_revisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `liti_content_careers` (
	`revision_id` text PRIMARY KEY NOT NULL,
	`field_company` text NOT NULL,
	`field_slug` text,
	`field_period` text NOT NULL,
	`field_position` text NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `liti_revisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `liti_content_gameStats` (
	`revision_id` text PRIMARY KEY NOT NULL,
	`field_slug` text,
	`field_game` text NOT NULL,
	`field_periodKey` text NOT NULL,
	`field_period` text NOT NULL,
	`field_order` integer NOT NULL,
	`field_start` text,
	`field_end` text,
	`field_values` text NOT NULL,
	`field_href` text,
	FOREIGN KEY (`revision_id`) REFERENCES `liti_revisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `liti_content_games` (
	`revision_id` text PRIMARY KEY NOT NULL,
	`field_slug` text NOT NULL,
	`field_igdbId` integer NOT NULL,
	`field_name` text NOT NULL,
	`field_cover` text,
	`field_icon` text,
	`field_primaryMetric` text,
	`field_metrics` text,
	FOREIGN KEY (`revision_id`) REFERENCES `liti_revisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `liti_content_posts` (
	`revision_id` text PRIMARY KEY NOT NULL,
	`field_title` text NOT NULL,
	`field_content` text NOT NULL,
	`field_slug` text,
	`field_tags` text NOT NULL,
	`field_image` text,
	`field_createdAt` text,
	`field_byline` text,
	`field_publication` text,
	`field_plainTitle` text,
	`field_gameMentions` text,
	`field_authorUserId` text,
	FOREIGN KEY (`revision_id`) REFERENCES `liti_revisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `liti_content_ranks` (
	`revision_id` text PRIMARY KEY NOT NULL,
	`field_game` text NOT NULL,
	`field_image` text NOT NULL,
	`field_slug` text,
	`field_season` text,
	`field_rank` text NOT NULL,
	`field_href` text,
	FOREIGN KEY (`revision_id`) REFERENCES `liti_revisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `liti_content_skills` (
	`revision_id` text PRIMARY KEY NOT NULL,
	`field_name` text NOT NULL,
	`field_slug` text,
	`field_icon` text NOT NULL,
	`field_category` text,
	FOREIGN KEY (`revision_id`) REFERENCES `liti_revisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `liti_content_socials` (
	`revision_id` text PRIMARY KEY NOT NULL,
	`field_label` text NOT NULL,
	`field_slug` text,
	`field_href` text NOT NULL,
	`field_icon` text NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `liti_revisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `liti_content_works` (
	`revision_id` text PRIMARY KEY NOT NULL,
	`field_title` text NOT NULL,
	`field_image` text,
	`field_slug` text,
	`field_description` text,
	`field_category` text,
	`field_icon` text,
	`field_href` text,
	`field_price` text,
	`field_style` text NOT NULL,
	`field_createdAt` text,
	FOREIGN KEY (`revision_id`) REFERENCES `liti_revisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `liti_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`default_locale` text DEFAULT '' NOT NULL,
	`current_revision_id` text,
	`published_revision_id` text,
	`scheduled_revision_id` text,
	`scheduled_at` text,
	`sort_order` real,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`published_at` text,
	`first_published_at` text
);
--> statement-breakpoint
CREATE INDEX `liti_entries_model` ON `liti_entries` (`model`);--> statement-breakpoint
CREATE INDEX `liti_entries_schedule` ON `liti_entries` (`scheduled_at`) WHERE scheduled_revision_id IS NOT NULL;--> statement-breakpoint
CREATE TABLE `jwks` (
	`id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`alg` text,
	`crv` text
);
--> statement-breakpoint
CREATE TABLE `liti_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`public_key` text NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`counter` integer NOT NULL,
	`device_type` text NOT NULL,
	`backed_up` integer NOT NULL,
	`transports` text,
	`created_at` integer,
	`aaguid` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `passkeys_userId_idx` ON `passkeys` (`user_id`);--> statement-breakpoint
CREATE INDEX `passkeys_credentialID_idx` ON `passkeys` (`credential_id`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limits_key_unique` ON `rate_limits` (`key`);--> statement-breakpoint
CREATE TABLE `liti_relations` (
	`revision_id` text NOT NULL,
	`locale` text DEFAULT '' NOT NULL,
	`field_path` text NOT NULL,
	`target_entry_id` text NOT NULL,
	`position` integer NOT NULL,
	`required` integer NOT NULL,
	PRIMARY KEY(`revision_id`, `locale`, `field_path`, `position`),
	FOREIGN KEY (`revision_id`) REFERENCES `liti_revisions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_entry_id`) REFERENCES `liti_entries`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `liti_relations_target` ON `liti_relations` (`target_entry_id`);--> statement-breakpoint
CREATE TABLE `liti_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`actor_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `liti_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `liti_revisions_entry` ON `liti_revisions` (`entry_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `liti_routes` (
	`path` text NOT NULL,
	`locale` text DEFAULT '' NOT NULL,
	`entry_id` text NOT NULL,
	`revision_id` text,
	`kind` text NOT NULL,
	`target_path` text,
	`status` integer,
	`created_at` text NOT NULL,
	PRIMARY KEY(`locale`, `path`),
	FOREIGN KEY (`entry_id`) REFERENCES `liti_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`revision_id`) REFERENCES `liti_revisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `liti_routes_entry` ON `liti_routes` (`entry_id`);--> statement-breakpoint
CREATE TABLE `liti_search` (
	`revision_id` text NOT NULL,
	`locale` text NOT NULL,
	`part` integer NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`revision_id`, `locale`, `part`),
	FOREIGN KEY (`revision_id`) REFERENCES `liti_revisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_userId_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `liti_translations` (
	`revision_id` text NOT NULL,
	`locale` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`revision_id`, `locale`),
	FOREIGN KEY (`revision_id`) REFERENCES `liti_revisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer,
	`username` text,
	`display_username` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);