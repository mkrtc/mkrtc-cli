CREATE TABLE IF NOT EXISTS `aliases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`value` text NOT NULL,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `aliases_name_unique` ON `aliases` (`name`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `passwords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`password` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `passwords_password_unique` ON `passwords` (`password`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ssh_args` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ssh_id` integer NOT NULL,
	`arg` text NOT NULL,
	FOREIGN KEY (`ssh_id`) REFERENCES `ssh`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ssh` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`ip` text NOT NULL,
	`password` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ssh_name_unique` ON `ssh` (`name`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS  `uuids` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`uuid` text NOT NULL,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uuids_name_unique` ON `uuids` (`name`);
