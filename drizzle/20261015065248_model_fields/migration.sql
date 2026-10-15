ALTER TABLE `site_admin_content_arts` ADD `field_slug` text;--> statement-breakpoint
ALTER TABLE `site_admin_content_careers` ADD `field_slug` text;--> statement-breakpoint
ALTER TABLE `site_admin_content_posts` ADD `field_slug` text;--> statement-breakpoint
ALTER TABLE `site_admin_content_ranks` ADD `field_slug` text;--> statement-breakpoint
ALTER TABLE `site_admin_content_skills` ADD `field_slug` text;--> statement-breakpoint
ALTER TABLE `site_admin_content_socials` ADD `field_slug` text;--> statement-breakpoint
ALTER TABLE `site_admin_content_works` ADD `field_slug` text;--> statement-breakpoint
UPDATE site_admin_content_arts SET field_slug = (SELECT CASE WHEN slug LIKE '?site-admin-draft:%' THEN '' ELSE slug END FROM site_admin_revisions WHERE id = revision_id);
--> statement-breakpoint
UPDATE site_admin_content_careers SET field_slug = (SELECT CASE WHEN slug LIKE '?site-admin-draft:%' THEN '' ELSE slug END FROM site_admin_revisions WHERE id = revision_id);
--> statement-breakpoint
UPDATE site_admin_content_posts SET field_slug = (SELECT CASE WHEN slug LIKE '?site-admin-draft:%' THEN '' ELSE slug END FROM site_admin_revisions WHERE id = revision_id);
--> statement-breakpoint
UPDATE site_admin_content_ranks SET field_slug = (SELECT CASE WHEN slug LIKE '?site-admin-draft:%' THEN '' ELSE slug END FROM site_admin_revisions WHERE id = revision_id);
--> statement-breakpoint
UPDATE site_admin_content_skills SET field_slug = (SELECT CASE WHEN slug LIKE '?site-admin-draft:%' THEN '' ELSE slug END FROM site_admin_revisions WHERE id = revision_id);
--> statement-breakpoint
UPDATE site_admin_content_socials SET field_slug = (SELECT CASE WHEN slug LIKE '?site-admin-draft:%' THEN '' ELSE slug END FROM site_admin_revisions WHERE id = revision_id);
--> statement-breakpoint
UPDATE site_admin_content_works SET field_slug = (SELECT CASE WHEN slug LIKE '?site-admin-draft:%' THEN '' ELSE slug END FROM site_admin_revisions WHERE id = revision_id);
--> statement-breakpoint
UPDATE site_admin_content_posts SET field_publication = json_set(COALESCE(field_publication, '{}'), '$.publishedSlug',
    (SELECT published.field_slug FROM site_admin_entries e JOIN site_admin_content_posts published ON published.revision_id=e.published_revision_id WHERE e.current_revision_id=site_admin_content_posts.revision_id))
WHERE revision_id IN (SELECT current_revision_id FROM site_admin_entries WHERE model='posts' AND published_revision_id IS NOT NULL);
--> statement-breakpoint
ALTER TABLE `site_admin_content_posts` DROP COLUMN `field_excerpt`;--> statement-breakpoint
ALTER TABLE `site_admin_revisions` DROP COLUMN `slug`;
--> statement-breakpoint
-- Existing public pointers remain unchanged; disabling publishing does not publish pending edits.
UPDATE site_admin_entries SET scheduled_revision_id = NULL, scheduled_at = NULL WHERE model IN ('socials', 'ranks');
--> statement-breakpoint
UPDATE site_admin_routes SET revision_id = NULL WHERE kind = 'historical' AND entry_id IN (SELECT id FROM site_admin_entries WHERE model IN ('socials', 'ranks'));
--> statement-breakpoint
DELETE FROM site_admin_meta WHERE key LIKE 'content_search:v1:%';
--> statement-breakpoint
-- Typed content rows, relations and asset references cascade with each obsolete revision.
DELETE FROM site_admin_revisions WHERE entry_id IN (SELECT id FROM site_admin_entries WHERE model IN ('socials', 'ranks'))
AND id NOT IN (SELECT current_revision_id FROM site_admin_entries WHERE current_revision_id IS NOT NULL)
AND id NOT IN (SELECT published_revision_id FROM site_admin_entries WHERE published_revision_id IS NOT NULL)
AND id NOT IN (SELECT scheduled_revision_id FROM site_admin_entries WHERE scheduled_revision_id IS NOT NULL)
AND id NOT IN (SELECT revision_id FROM site_admin_routes WHERE revision_id IS NOT NULL);
