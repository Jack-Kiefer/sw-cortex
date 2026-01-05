CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`github_repo` text,
	`color` text DEFAULT '#6366f1',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer,
	`message` text NOT NULL,
	`remind_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`slack_channel` text,
	`snoozed_until` integer,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	`slack_message_ts` text,
	`interacted` integer DEFAULT false,
	`last_reminded_at` integer,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `task_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`action` text NOT NULL,
	`previous_value` text,
	`new_value` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`priority` integer DEFAULT 2,
	`project_id` integer,
	`due_date` integer,
	`snoozed_until` integer,
	`tags` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	`notify_at` integer,
	`notification_sent` integer DEFAULT false,
	`notification_channel` text,
	`notification_snoozed_until` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
