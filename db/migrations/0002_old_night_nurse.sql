CREATE TABLE `ssh_args` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ssh_id` integer NOT NULL,
	`arg` text NOT NULL,
	FOREIGN KEY (`ssh_id`) REFERENCES `ssh`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `ssh` ADD `username` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `ssh_username_unique` ON `ssh` (`username`);