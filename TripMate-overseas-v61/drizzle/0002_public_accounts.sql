CREATE TABLE `public_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_normalized` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_iterations` integer DEFAULT 210000 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text NOT NULL,
	`approved_at` text,
	`approved_by` text,
	`last_login_at` text
);
CREATE UNIQUE INDEX `idx_public_users_email` ON `public_users` (`email_normalized`);
CREATE INDEX `idx_public_users_status_created` ON `public_users` (`status`,`created_at`);
CREATE TABLE `public_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `public_users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `idx_public_sessions_user_id` ON `public_sessions` (`user_id`);
CREATE INDEX `idx_public_sessions_expires_at` ON `public_sessions` (`expires_at`);
CREATE TABLE `auth_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` integer NOT NULL
);
