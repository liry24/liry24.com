CREATE TABLE `site_admin_search` (
	`revision_id` text NOT NULL,
	`locale` text NOT NULL,
	`part` integer NOT NULL,
	`value` text NOT NULL,
	CONSTRAINT `site_admin_search_pk` PRIMARY KEY(`revision_id`, `locale`, `part`),
	CONSTRAINT `fk_site_admin_search_revision_id_site_admin_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `site_admin_revisions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `site_admin_translations` (
	`revision_id` text NOT NULL,
	`locale` text NOT NULL,
	`data` text NOT NULL,
	CONSTRAINT `site_admin_translations_pk` PRIMARY KEY(`revision_id`, `locale`),
	CONSTRAINT `fk_site_admin_translations_revision_id_site_admin_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `site_admin_revisions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `site_admin_entries` RENAME COLUMN `locale` TO `default_locale`;--> statement-breakpoint
UPDATE site_admin_entries SET default_locale='ja';--> statement-breakpoint
ALTER TABLE `site_admin_asset_refs` ADD `locale` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_admin_relations` ADD `locale` text DEFAULT '' NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_site_admin_asset_refs` (
	`revision_id` text NOT NULL,
	`locale` text DEFAULT '' NOT NULL,
	`field_path` text NOT NULL,
	`asset_id` text NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT `site_admin_asset_refs_pk` PRIMARY KEY(`revision_id`, `locale`, `field_path`, `position`),
	CONSTRAINT `fk_site_admin_asset_refs_revision_id_site_admin_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `site_admin_revisions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_site_admin_asset_refs_asset_id_site_admin_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `site_admin_assets`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
INSERT INTO `__new_site_admin_asset_refs`(`revision_id`, `locale`, `field_path`, `asset_id`, `position`) SELECT `revision_id`, 'ja', `field_path`, `asset_id`, `position` FROM `site_admin_asset_refs`;--> statement-breakpoint
DROP TABLE `site_admin_asset_refs`;--> statement-breakpoint
ALTER TABLE `__new_site_admin_asset_refs` RENAME TO `site_admin_asset_refs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_site_admin_relations` (
	`revision_id` text NOT NULL,
	`locale` text DEFAULT '' NOT NULL,
	`field_path` text NOT NULL,
	`target_entry_id` text NOT NULL,
	`position` integer NOT NULL,
	`required` integer NOT NULL,
	CONSTRAINT `site_admin_relations_pk` PRIMARY KEY(`revision_id`, `locale`, `field_path`, `position`),
	CONSTRAINT `fk_site_admin_relations_revision_id_site_admin_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `site_admin_revisions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_site_admin_relations_target_entry_id_site_admin_entries_id_fk` FOREIGN KEY (`target_entry_id`) REFERENCES `site_admin_entries`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
INSERT INTO `__new_site_admin_relations`(`revision_id`, `locale`, `field_path`, `target_entry_id`, `position`, `required`) SELECT `revision_id`, 'ja', `field_path`, `target_entry_id`, `position`, `required` FROM `site_admin_relations`;--> statement-breakpoint
DROP TABLE `site_admin_relations`;--> statement-breakpoint
ALTER TABLE `__new_site_admin_relations` RENAME TO `site_admin_relations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `site_admin_entries_translation`;--> statement-breakpoint
CREATE INDEX `site_admin_asset_refs_asset` ON `site_admin_asset_refs` (`asset_id`);--> statement-breakpoint
CREATE INDEX `site_admin_relations_target` ON `site_admin_relations` (`target_entry_id`);--> statement-breakpoint
ALTER TABLE `site_admin_entries` DROP COLUMN `translation_group`;
--> statement-breakpoint
UPDATE site_admin_routes SET locale='ja';
--> statement-breakpoint
DELETE FROM site_admin_meta WHERE key LIKE 'content_search:%';
--> statement-breakpoint
UPDATE site_admin_meta SET value=CAST(COALESCE(value,'0') AS INTEGER)+1 WHERE key='public_generation';
