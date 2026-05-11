import { pgTable, text, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";

// A "settings group" is the unit of admin-controlled configuration. Each
// group has its own providers, API keys, prompts, and defaults. Every user
// belongs to exactly one group (via user_profile); a single group flagged
// is_default=true is the fallback for new users and for users whose group
// was deleted.
export const settingsGroup = pgTable(
  "settings_group",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    description: text("description").notNull().default(""),
    isDefault: boolean("is_default").notNull().default(false),

    // Admin-controlled config:
    sttProvider: text("stt_provider").notNull().default("openai"),
    summaryProvider: text("summary_provider").notNull().default("openai"),
    openaiApiKey: text("openai_api_key").notNull().default(""),
    groqApiKey: text("groq_api_key").notNull().default(""),
    anthropicApiKey: text("anthropic_api_key").notNull().default(""),
    language: text("language").notNull().default("auto"),
    autoSummarize: boolean("auto_summarize").notNull().default(true),
    audioFormat: text("audio_format").notNull().default("webm"),
    sttPrompt: text("stt_prompt").notNull().default(""),
    summaryPrompt: text("summary_prompt").notNull().default(""),
    allowSummaryPromptOverride: boolean("allow_summary_prompt_override").notNull().default(true),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdBy: text("created_by"),
  },
  (t) => ({
    // Enforce at most one default group at the DB layer, not just app code.
    onlyOneDefault: uniqueIndex("settings_group_default_idx")
      .on(t.isDefault)
      .where(sql`${t.isDefault} = true`),
  }),
);

// One row per user — the link to their group plus the small whitelist of
// fields the user is allowed to override (language, summary prompt). Both
// override fields are nullable; null means "use the group's value".
export const userProfile = pgTable("user_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  groupId: text("group_id").references(() => settingsGroup.id, {
    onDelete: "set null",
  }),
  languageOverride: text("language_override"),
  summaryPromptOverride: text("summary_prompt_override"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
