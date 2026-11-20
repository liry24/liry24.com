DROP TABLE `passkey`;--> statement-breakpoint
CREATE UNIQUE INDEX `account_oidc_identity` ON `account` (`provider_id`,`account_id`);