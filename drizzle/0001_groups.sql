CREATE TABLE "settings_group" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"stt_provider" text DEFAULT 'openai' NOT NULL,
	"summary_provider" text DEFAULT 'openai' NOT NULL,
	"openai_api_key" text DEFAULT '' NOT NULL,
	"groq_api_key" text DEFAULT '' NOT NULL,
	"anthropic_api_key" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'auto' NOT NULL,
	"auto_summarize" boolean DEFAULT true NOT NULL,
	"audio_format" text DEFAULT 'webm' NOT NULL,
	"stt_prompt" text DEFAULT '' NOT NULL,
	"summary_prompt" text DEFAULT '' NOT NULL,
	"allow_summary_prompt_override" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	CONSTRAINT "settings_group_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"group_id" text,
	"language_override" text,
	"summary_prompt_override" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_group_id_settings_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."settings_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "settings_group_default_idx" ON "settings_group" USING btree ("is_default") WHERE "settings_group"."is_default" = true;