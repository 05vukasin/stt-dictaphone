"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGroup } from "../actions";
import { toast } from "@/lib/use-toast";

export function NewGroupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await createGroup({ name: name.trim(), description: description.trim() });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success("Group created");
      router.replace(`/admin/groups/${r.group.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-[var(--muted)]">Name</span>
        <input
          required
          minLength={2}
          maxLength={64}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--border-strong)]"
          placeholder="e.g. engineering"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-[var(--muted)]">Description</span>
        <textarea
          rows={3}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--border-strong)]"
        />
      </label>
      {error ? <p className="text-[12px] text-[var(--record)]">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-[var(--fg)] px-3 py-1.5 text-[12px] font-semibold text-[var(--bg)] disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create group"}
      </button>
    </form>
  );
}
