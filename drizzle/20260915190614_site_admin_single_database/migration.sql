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
CREATE TABLE `site_admin_meta` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL
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
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_accounts` (
	`id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`issuer` text,
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
	CONSTRAINT `accounts_userId_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_accounts`(`id`, `account_id`, `issuer`, `provider_id`, `user_id`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password`, `created_at`, `updated_at`) SELECT `id`, `account_id`, `issuer`, `provider_id`, `user_id`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password`, `created_at`, `updated_at` FROM `accounts`;--> statement-breakpoint
DROP TABLE `accounts`;--> statement-breakpoint
ALTER TABLE `__new_accounts` RENAME TO `accounts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `admin_action_plans_actorUserId_createdAt_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `admin_action_plans_status_expiresAt_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `admin_audit_events_planId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `admin_audit_events_actorUserId_createdAt_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `art_images_artSlug_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `arts_sortIndex_createdAt_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `careers_sortIndex_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `oauth_access_tokens_clientId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `oauth_access_tokens_sessionId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `oauth_access_tokens_userId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `oauth_access_tokens_authorizationCodeId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `oauth_access_tokens_refreshId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `oauth_client_resources_clientId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `oauth_client_resources_resourceId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `oauth_clients_userId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `oauth_consents_clientId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `oauth_consents_userId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `oauth_refresh_tokens_clientId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `oauth_refresh_tokens_sessionId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `oauth_refresh_tokens_userId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `oauth_refresh_tokens_authorizationCodeId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `person_links_personId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `post_review_jobs_status_availableAt_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `post_review_jobs_postSlug_createdAt_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `post_reviews_postSlug_createdAt_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `post_reviews_jobId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `post_tags_postSlug_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `posts_createdAt_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `posts_status_publishedAt_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `posts_status_scheduledAt_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `ranks_sortIndex_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `skills_sortIndex_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `socials_alias_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `socials_sortIndex_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `work_persons_workSlug_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `works_sortIndex_createdAt_idx`;--> statement-breakpoint
CREATE INDEX `accounts_userId_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `site_admin_asset_refs_asset` ON `site_admin_asset_refs` (`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `site_admin_assets_key` ON `site_admin_assets` (`storage`,`key`);--> statement-breakpoint
CREATE INDEX `site_admin_assets_gc` ON `site_admin_assets` (`state`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `site_admin_entries_translation` ON `site_admin_entries` (`model`,`translation_group`,`locale`);--> statement-breakpoint
CREATE INDEX `site_admin_entries_model` ON `site_admin_entries` (`model`);--> statement-breakpoint
CREATE INDEX `site_admin_entries_schedule` ON `site_admin_entries` (`scheduled_at`) WHERE "site_admin_entries"."scheduled_revision_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `site_admin_relations_target` ON `site_admin_relations` (`target_entry_id`);--> statement-breakpoint
CREATE INDEX `site_admin_revisions_entry` ON `site_admin_revisions` (`entry_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `site_admin_routes_entry` ON `site_admin_routes` (`entry_id`);--> statement-breakpoint
DROP TABLE `admin_action_plans`;--> statement-breakpoint
DROP TABLE `admin_audit_events`;--> statement-breakpoint
DROP TABLE `art_images`;--> statement-breakpoint
DROP TABLE `arts`;--> statement-breakpoint
DROP TABLE `careers`;--> statement-breakpoint
DROP TABLE `oauth_access_tokens`;--> statement-breakpoint
DROP TABLE `oauth_client_assertions`;--> statement-breakpoint
DROP TABLE `oauth_client_resources`;--> statement-breakpoint
DROP TABLE `oauth_clients`;--> statement-breakpoint
DROP TABLE `oauth_consents`;--> statement-breakpoint
DROP TABLE `oauth_refresh_tokens`;--> statement-breakpoint
DROP TABLE `oauth_resources`;--> statement-breakpoint
DROP TABLE `person_links`;--> statement-breakpoint
DROP TABLE `persons`;--> statement-breakpoint
DROP TABLE `post_review_jobs`;--> statement-breakpoint
DROP TABLE `post_reviews`;--> statement-breakpoint
DROP TABLE `post_tags`;--> statement-breakpoint
DROP TABLE `posts`;--> statement-breakpoint
DROP TABLE `ranks`;--> statement-breakpoint
DROP TABLE `skills`;--> statement-breakpoint
DROP TABLE `socials`;--> statement-breakpoint
DROP TABLE `work_persons`;--> statement-breakpoint
DROP TABLE `works`;