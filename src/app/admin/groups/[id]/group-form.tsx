"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FiEye, FiEyeOff, FiStar, FiTrash2, FiX } from "react-icons/fi";
import type { SettingsGroupRow } from "@/lib/settings/queries";
import { deleteGroup, setDefaultGroup, setGroupConfig } from "../actions";
import { LANGUAGES } from "@/types/settings";
import { toast } from "@/lib/use-toast";

interface Props {
  group: SettingsGroupRow;
}

type SecretAction = "leave" | "rotate" | "clear";

interface SecretFieldState {
  action: SecretAction;
  draft: string;
}

function initialSecretState(currentValue: string): SecretFieldState {
  // We deliberately don't seed `draft` with the existing value — the field
  // always starts empty so an admin who saves with no input doesn't rotate
  // their keys.
  return { action: currentValue ? "leave" : "rotate", draft: "" };
}

export function GroupForm({ group }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState({
    description: group.description,
    sttProvider: group.sttProvider,
    summaryProvider: group.summaryProvider,
    language: group.language,
    autoSummarize: group.autoSummarize,
    audioFormat: group.audioFormat,
    sttPrompt: group.sttPrompt,
    summaryPrompt: group.summaryPrompt,
    allowSummaryPromptOverride: group.allowSummaryPromptOverride,
  });
  // API keys are kept out of the main state because we never want to ship
  // either the ciphertext or the plaintext into the React tree. The DB row
  // tells us only whether a key is currently set; the input lets the admin
  // rotate it.
  const [secrets, setSecrets] = useState({
    openai: initialSecretState(group.openaiApiKey),
    groq: initialSecretState(group.groqApiKey),
    anthropic: initialSecretState(group.anthropicApiKey),
  });

  function patch<K extends keyof typeof state>(key: K, value: (typeof state)[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function patchSecret(key: keyof typeof secrets, value: Partial<SecretFieldState>) {
    setSecrets((s) => ({ ...s, [key]: { ...s[key], ...value } }));
  }

  function buildKeyPatch(): {
    openaiApiKey?: string;
    groqApiKey?: string;
    anthropicApiKey?: string;
  } {
    const fieldFor = (s: SecretFieldState) =>
      s.action === "rotate" && s.draft.length > 0
        ? s.draft
        : s.action === "clear"
          ? ""
          : undefined;
    const out: ReturnType<typeof buildKeyPatch> = {};
    const openai = fieldFor(secrets.openai);
    const groq = fieldFor(secrets.groq);
    const anthropic = fieldFor(secrets.anthropic);
    if (openai !== undefined) out.openaiApiKey = openai;
    if (groq !== undefined) out.groqApiKey = groq;
    if (anthropic !== undefined) out.anthropicApiKey = anthropic;
    return out;
  }

  function save() {
    start(async () => {
      const r = await setGroupConfig(group.id, { ...state, ...buildKeyPatch() });
      if (r.ok) {
        toast.success("Group updated");
        // The form's "current" snapshots are stale now (we rotated keys);
        // a router.refresh reseeds the SettingsGroupRow prop and resets the
        // secret inputs back to empty.
        router.refresh();
        setSecrets({
          openai: { action: "leave", draft: "" },
          groq: { action: "leave", draft: "" },
          anthropic: { action: "leave", draft: "" },
        });
      } else toast.error("Save failed", r.error);
    });
  }

  function makeDefault() {
    start(async () => {
      const r = await setDefaultGroup(group.id);
      if (r.ok) {
        toast.success("Default group updated");
        router.refresh();
      } else {
        toast.error("Couldn't set default", r.error);
      }
    });
  }

  function remove() {
    if (!confirm(`Delete group "${group.name}"? Members will fall back to the default group.`)) {
      return;
    }
    start(async () => {
      const r = await deleteGroup(group.id);
      if (r.ok) {
        toast.success("Group deleted");
        router.replace("/admin/groups");
      } else {
        toast.error("Delete failed", r.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Section title="Description">
        <textarea
          rows={2}
          maxLength={500}
          value={state.description}
          onChange={(e) => patch("description", e.target.value)}
          className={inputCx}
        />
      </Section>

      <Section title="Providers & format">
        <Row label="STT provider">
          <select
            value={state.sttProvider}
            onChange={(e) => patch("sttProvider", e.target.value)}
            className={selectCx}
          >
            <option value="openai">OpenAI · whisper-1</option>
            <option value="groq">Groq · whisper-large-v3</option>
          </select>
        </Row>
        <Row label="Summary provider">
          <select
            value={state.summaryProvider}
            onChange={(e) => patch("summaryProvider", e.target.value)}
            className={selectCx}
          >
            <option value="openai">OpenAI · GPT-4o-mini</option>
            <option value="anthropic">Anthropic · Claude Sonnet 4.5</option>
            <option value="groq">Groq · Llama 3.3 70B</option>
          </select>
        </Row>
        <Row label="Audio format">
          <select
            value={state.audioFormat}
            onChange={(e) => patch("audioFormat", e.target.value)}
            className={selectCx}
          >
            <option value="webm">WebM (Opus)</option>
            <option value="wav">WAV</option>
          </select>
        </Row>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px]">
          <span className="font-medium">Auto-summarize after transcription</span>
          <input
            type="checkbox"
            className="size-4 accent-[var(--fg)]"
            checked={state.autoSummarize}
            onChange={(e) => patch("autoSummarize", e.target.checked)}
          />
        </label>
      </Section>

      <Section title="API keys (encrypted at rest; never reach the browser)">
        <SecretInput
          label="OpenAI"
          isSet={Boolean(group.openaiApiKey)}
          field={secrets.openai}
          onPatch={(p) => patchSecret("openai", p)}
          placeholder="sk-..."
        />
        <SecretInput
          label="Groq"
          isSet={Boolean(group.groqApiKey)}
          field={secrets.groq}
          onPatch={(p) => patchSecret("groq", p)}
          placeholder="gsk_..."
        />
        <SecretInput
          label="Anthropic"
          isSet={Boolean(group.anthropicApiKey)}
          field={secrets.anthropic}
          onPatch={(p) => patchSecret("anthropic", p)}
          placeholder="sk-ant-..."
        />
      </Section>

      <Section title="Defaults">
        <Row label="Language hint">
          <select
            value={state.language}
            onChange={(e) => patch("language", e.target.value)}
            className={selectCx}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="STT prompt">
          <textarea
            rows={3}
            value={state.sttPrompt}
            onChange={(e) => patch("sttPrompt", e.target.value)}
            className={inputCx}
            placeholder="e.g. Names: Vukasin, Pejovic"
          />
        </Row>
        <Row label="Summary prompt">
          <textarea
            rows={6}
            value={state.summaryPrompt}
            onChange={(e) => patch("summaryPrompt", e.target.value)}
            className={inputCx}
          />
        </Row>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px]">
          <span className="font-medium">Members can override the summary prompt</span>
          <input
            type="checkbox"
            className="size-4 accent-[var(--fg)]"
            checked={state.allowSummaryPromptOverride}
            onChange={(e) => patch("allowSummaryPromptOverride", e.target.checked)}
          />
        </label>
      </Section>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-[var(--fg)] px-3 py-1.5 text-[12px] font-semibold text-[var(--bg)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {!group.isDefault ? (
          <button
            type="button"
            onClick={makeDefault}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--surface)] disabled:opacity-50"
          >
            <FiStar aria-hidden /> Make default
          </button>
        ) : null}
        {!group.isDefault ? (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--record)]/40 bg-transparent px-3 py-1.5 text-[12px] font-medium text-[var(--record)] hover:bg-[var(--record)]/10 disabled:opacity-50"
          >
            <FiTrash2 aria-hidden /> Delete group
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4">
      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function SecretInput({
  label,
  isSet,
  field,
  onPatch,
  placeholder,
}: {
  label: string;
  isSet: boolean;
  field: SecretFieldState;
  onPatch(p: Partial<SecretFieldState>): void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  // Decide what to show in the empty placeholder. If the key is already set
  // and the admin hasn't asked to clear it, show the masked indicator;
  // otherwise show the format hint.
  const empty = field.draft.length === 0;
  const showMasked = isSet && field.action !== "clear" && empty;
  const inputPlaceholder = showMasked
    ? "•••••••• already set — type to rotate"
    : placeholder;

  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <input
          type={show ? "text" : "password"}
          value={field.draft}
          onChange={(e) => {
            const v = e.target.value;
            onPatch({ draft: v, action: v.length > 0 ? "rotate" : isSet ? "leave" : "rotate" });
          }}
          placeholder={inputPlaceholder}
          spellCheck={false}
          autoComplete="off"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-[12px] outline-none focus:border-[var(--border-strong)]"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]"
          aria-label={show ? "Hide key" : "Show key"}
        >
          {show ? <FiEyeOff aria-hidden /> : <FiEye aria-hidden />}
        </button>
        {isSet && field.action !== "clear" ? (
          <button
            type="button"
            onClick={() => onPatch({ action: "clear", draft: "" })}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--record)]/40 bg-transparent p-2 text-[var(--record)] hover:bg-[var(--record)]/10"
            aria-label={`Clear ${label} key`}
            title={`Clear ${label} key`}
          >
            <FiX aria-hidden />
          </button>
        ) : null}
      </div>
      {field.action === "clear" ? (
        <p className="mt-1 text-[11px] text-[var(--record)]">
          Will be cleared on save.{" "}
          <button
            type="button"
            onClick={() => onPatch({ action: "leave" })}
            className="underline hover:text-[var(--fg)]"
          >
            Cancel
          </button>
        </p>
      ) : null}
    </Row>
  );
}

const inputCx =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--border-strong)] resize-y";
const selectCx =
  "rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px] outline-none focus:border-[var(--border-strong)]";
