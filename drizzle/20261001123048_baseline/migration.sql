CREATE TABLE `accounts` (
	`id` text PRIMARY KEY,
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
	CONSTRAINT `fk_accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `site_admin_asset_refs` (
	`revision_id` text NOT NULL,
	`field_path` text NOT NULL,
	`asset_id` text NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT `site_admin_asset_refs_pk` PRIMARY KEY(`revision_id`, `field_path`, `position`),
	CONSTRAINT `fk_site_admin_asset_refs_revision_id_site_admin_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `site_admin_revisions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_site_admin_asset_refs_asset_id_site_admin_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `site_admin_assets`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `site_admin_assets` (
	`id` text PRIMARY KEY,
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
CREATE TABLE `site_admin_content_arts` (
	`revision_id` text PRIMARY KEY,
	`field_title` text NOT NULL,
	`field_description` text,
	`field_href` text,
	`field_images` text NOT NULL,
	`field_createdAt` text,
	CONSTRAINT `fk_site_admin_content_arts_revision_id_site_admin_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `site_admin_revisions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `site_admin_content_careers` (
	`revision_id` text PRIMARY KEY,
	`field_period` text NOT NULL,
	`field_position` text NOT NULL,
	`field_company` text NOT NULL,
	CONSTRAINT `fk_site_admin_content_careers_revision_id_site_admin_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `site_admin_revisions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `site_admin_content_posts` (
	`revision_id` text PRIMARY KEY,
	`field_title` text NOT NULL,
	`field_excerpt` text,
	`field_content` text NOT NULL,
	`field_tags` text NOT NULL,
	`field_image` text,
	`field_authorUserId` text,
	`field_createdAt` text,
	CONSTRAINT `fk_site_admin_content_posts_revision_id_site_admin_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `site_admin_revisions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `site_admin_content_ranks` (
	`revision_id` text PRIMARY KEY,
	`field_game` text NOT NULL,
	`field_season` text,
	`field_rank` text NOT NULL,
	`field_image` text NOT NULL,
	`field_href` text,
	CONSTRAINT `fk_site_admin_content_ranks_revision_id_site_admin_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `site_admin_revisions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `site_admin_content_skills` (
	`revision_id` text PRIMARY KEY,
	`field_name` text NOT NULL,
	`field_icon` text NOT NULL,
	`field_category` text,
	CONSTRAINT `fk_site_admin_content_skills_revision_id_site_admin_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `site_admin_revisions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `site_admin_content_socials` (
	`revision_id` text PRIMARY KEY,
	`field_href` text NOT NULL,
	`field_icon` text NOT NULL,
	`field_label` text NOT NULL,
	CONSTRAINT `fk_site_admin_content_socials_revision_id_site_admin_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `site_admin_revisions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `site_admin_content_works` (
	`revision_id` text PRIMARY KEY,
	`field_title` text NOT NULL,
	`field_description` text,
	`field_category` text,
	`field_image` text,
	`field_icon` text,
	`field_href` text,
	`field_price` text,
	`field_style` text NOT NULL,
	`field_createdAt` text,
	CONSTRAINT `fk_site_admin_content_works_revision_id_site_admin_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `site_admin_revisions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `site_admin_entries` (
	`id` text PRIMARY KEY,
	`model` text NOT NULL,
	`locale` text DEFAULT '' NOT NULL,
	`translation_group` text NOT NULL,
	`current_revision_id` text,
	`published_revision_id` text,
	`scheduled_revision_id` text,
	`scheduled_at` text,
	`sort_order` real,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`published_at` text
);
--> statement-breakpoint
CREATE TABLE `jwks` (
	`id` text PRIMARY KEY,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`alg` text,
	`crv` text
);
--> statement-breakpoint
CREATE TABLE `site_admin_meta` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` text PRIMARY KEY,
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
	CONSTRAINT `fk_passkeys_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY,
	`key` text NOT NULL UNIQUE,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `site_admin_relations` (
	`revision_id` text NOT NULL,
	`field_path` text NOT NULL,
	`target_entry_id` text NOT NULL,
	`position` integer NOT NULL,
	`required` integer NOT NULL,
	CONSTRAINT `site_admin_relations_pk` PRIMARY KEY(`revision_id`, `field_path`, `position`),
	CONSTRAINT `fk_site_admin_relations_revision_id_site_admin_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `site_admin_revisions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_site_admin_relations_target_entry_id_site_admin_entries_id_fk` FOREIGN KEY (`target_entry_id`) REFERENCES `site_admin_entries`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `site_admin_revisions` (
	`id` text PRIMARY KEY,
	`entry_id` text NOT NULL,
	`slug` text NOT NULL,
	`actor_id` text,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_site_admin_revisions_entry_id_site_admin_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `site_admin_entries`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `site_admin_routes` (
	`path` text NOT NULL,
	`locale` text DEFAULT '' NOT NULL,
	`entry_id` text NOT NULL,
	`revision_id` text,
	`kind` text NOT NULL,
	`target_path` text,
	`status` integer,
	`created_at` text NOT NULL,
	CONSTRAINT `site_admin_routes_pk` PRIMARY KEY(`locale`, `path`),
	CONSTRAINT `fk_site_admin_routes_entry_id_site_admin_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `site_admin_entries`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_site_admin_routes_revision_id_site_admin_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `site_admin_revisions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	CONSTRAINT `fk_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `accounts_userId_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `site_admin_asset_refs_asset` ON `site_admin_asset_refs` (`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `site_admin_assets_key` ON `site_admin_assets` (`storage`,`key`);--> statement-breakpoint
CREATE INDEX `site_admin_assets_gc` ON `site_admin_assets` (`state`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `site_admin_entries_translation` ON `site_admin_entries` (`model`,`translation_group`,`locale`);--> statement-breakpoint
CREATE INDEX `site_admin_entries_model` ON `site_admin_entries` (`model`);--> statement-breakpoint
CREATE INDEX `site_admin_entries_schedule` ON `site_admin_entries` (`scheduled_at`) WHERE "site_admin_entries"."scheduled_revision_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `passkeys_userId_idx` ON `passkeys` (`user_id`);--> statement-breakpoint
CREATE INDEX `passkeys_credentialID_idx` ON `passkeys` (`credential_id`);--> statement-breakpoint
CREATE INDEX `site_admin_relations_target` ON `site_admin_relations` (`target_entry_id`);--> statement-breakpoint
CREATE INDEX `site_admin_revisions_entry` ON `site_admin_revisions` (`entry_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `site_admin_routes_entry` ON `site_admin_routes` (`entry_id`);--> statement-breakpoint
CREATE INDEX `sessions_userId_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);