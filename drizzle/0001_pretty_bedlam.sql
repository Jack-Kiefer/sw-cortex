CREATE TABLE `checklist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`title` text NOT NULL,
	`is_completed` integer DEFAULT false,
	`sort_order` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `habit_completions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`habit_id` integer NOT NULL,
	`completed_at` integer NOT NULL,
	`note` text,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `habits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`frequency` text DEFAULT 'daily' NOT NULL,
	`frequency_days` text,
	`target_count` integer DEFAULT 1,
	`color` text DEFAULT '#6366f1',
	`reminder_time` text,
	`is_archived` integer DEFAULT false,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `importance` integer DEFAULT 2;--> statement-breakpoint
ALTER TABLE `tasks` ADD `start_date` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `estimated_minutes` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `actual_minutes` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `parent_id` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `sort_order` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `tasks` ADD `recurrence_type` text DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `tasks` ADD `recurrence_rule` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `recurrence_end_date` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `last_recurrence` integer;