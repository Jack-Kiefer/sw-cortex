CREATE TABLE `discoveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`source` text NOT NULL,
	`source_database` text,
	`source_query` text,
	`type` text DEFAULT 'insight',
	`priority` integer DEFAULT 2,
	`tags` text,
	`related_task_id` integer,
	`related_project_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`related_task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`related_project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
