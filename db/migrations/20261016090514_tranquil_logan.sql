CREATE TABLE `site_admin_content_gameStats` (
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
	FOREIGN KEY (`revision_id`) REFERENCES `site_admin_revisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `site_admin_content_games` (
	`revision_id` text PRIMARY KEY NOT NULL,
	`field_slug` text NOT NULL,
	`field_igdbId` integer NOT NULL,
	`field_name` text NOT NULL,
	`field_cover` text,
	`field_icon` text,
	`field_primaryMetric` text,
	`field_metrics` text,
	FOREIGN KEY (`revision_id`) REFERENCES `site_admin_revisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `site_admin_content_posts` ADD `field_plainTitle` text;--> statement-breakpoint
ALTER TABLE `site_admin_content_posts` ADD `field_gameMentions` text;
--> statement-breakpoint
CREATE TRIGGER site_admin_games_unique BEFORE INSERT ON site_admin_content_games
WHEN EXISTS (
 SELECT 1 FROM site_admin_content_games g
 JOIN site_admin_revisions r ON r.id = g.revision_id
 JOIN site_admin_entries e ON e.current_revision_id = g.revision_id
 WHERE r.entry_id != (SELECT entry_id FROM site_admin_revisions WHERE id = NEW.revision_id)
 AND (g.field_igdbId = NEW.field_igdbId OR g.field_slug = NEW.field_slug)
)
BEGIN SELECT RAISE(ABORT, 'Game already exists'); END;
--> statement-breakpoint
CREATE TRIGGER site_admin_games_identity BEFORE INSERT ON site_admin_content_games
WHEN EXISTS (
 SELECT 1 FROM site_admin_content_games g
 JOIN site_admin_revisions r ON r.id = g.revision_id
 JOIN site_admin_entries e ON e.current_revision_id = g.revision_id
 WHERE r.entry_id = (SELECT entry_id FROM site_admin_revisions WHERE id = NEW.revision_id)
 AND (g.field_igdbId != NEW.field_igdbId OR g.field_slug != NEW.field_slug OR g.field_name != NEW.field_name)
)
BEGIN SELECT RAISE(ABORT, 'IGDB identity cannot change'); END;
--> statement-breakpoint
CREATE TRIGGER site_admin_gameStats_unique BEFORE INSERT ON site_admin_content_gameStats
WHEN EXISTS (
 SELECT 1 FROM site_admin_content_gameStats s
 JOIN site_admin_revisions r ON r.id = s.revision_id
 JOIN site_admin_entries e ON e.current_revision_id = s.revision_id
 WHERE r.entry_id != (SELECT entry_id FROM site_admin_revisions WHERE id = NEW.revision_id)
 AND s.field_game = NEW.field_game AND s.field_periodKey = NEW.field_periodKey
)
BEGIN SELECT RAISE(ABORT, 'Period already exists for this game'); END;
