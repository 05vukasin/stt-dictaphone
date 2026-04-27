"use client";

import { useEffect, useState } from "react";
import { FiDownload, FiTrash2, FiUpload } from "react-icons/fi";
import { clearAllRecordings, getStorageEstimate } from "@/lib/storage/recordings-store";
import { exportSettings, importSettings } from "@/lib/storage/settings-store";
import { clearAllTranscripts, listTranscripts } from "@/lib/storage/transcripts-store";
import { toast } from "@/lib/use-toast";
import { formatBytes } from "@/lib/format";
import { SettingsSection } from "./settings-section";

export function DataSection() {
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    void getStorageEstimate().then(setUsage);
  }, []);

  const pct = usage && usage.quota > 0 ? Math.min(100, (usage.usage / usage.quota) * 100) : 0;

  function exportAll() {
    const dump = {
      settings: JSON.parse(exportSettings(true)),
      transcripts: listTranscripts(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stt-dictaphone-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded", "Audio blobs stay on your device.");
  }

  function importAll(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const settingsResult = importSettings(JSON.stringify(parsed.settings));
        if (!settingsResult.ok) throw new Error(settingsResult.error);
        toast.success("Settings restored");
      } catch (err) {
        toast.error("Import failed", err instanceof Error ? err.message : "Unknown error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function wipeAll() {
    if (!confirm("Delete every recording and transcript on this device? This cannot be undone.")) {
      return;
    }
    await clearAllRecordings();
    clearAllTranscripts();
    toast.success("All data wiped");
    void getStorageEstimate().then(setUsage);
  }

  return (
    <SettingsSection title="Data" description="Everything stays on this device.">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-medium">Storage</span>
          <span className="text-[11px] text-[var(--muted)] tabular">
            {usage ? `${formatBytes(usage.usage)} / ${formatBytes(usage.quota)}` : "Estimating…"}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-strong)]">
          <div
            className="h-full bg-[var(--fg)] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={exportAll} className={btnCx}>
          <FiDownload aria-hidden />
          Export all
        </button>
        <label className={btnCx + " cursor-pointer"}>
          <FiUpload aria-hidden />
          Import settings
          <input type="file" accept="application/json" onChange={importAll} className="sr-only" />
        </label>
      </div>

      <button
        onClick={wipeAll}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--record)]/40 bg-transparent px-3 py-2 text-[12px] font-medium text-[var(--record)] transition-colors hover:bg-[var(--record)]/10"
      >
        <FiTrash2 aria-hidden />
        Wipe all data
      </button>
    </SettingsSection>
  );
}

const btnCx =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px] font-medium transition-colors hover:bg-[var(--surface)]";
