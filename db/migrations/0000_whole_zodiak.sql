CREATE TABLE `aliases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updatedAt` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aliases_name_unique` ON `aliases` (`name`);--> statement-breakpoint
CREATE TABLE `ssh` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`ip` text NOT NULL,
	`password` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ssh_name_unique` ON `ssh` (`name`);