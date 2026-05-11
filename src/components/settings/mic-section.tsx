"use client";

import { useEffect, useState } from "react";
import { patchDeviceSettings, useDeviceSettings } from "@/lib/storage/settings-store";
import { useUserId } from "@/lib/storage/user-scope";
import { SettingRow, SettingsSection } from "./settings-section";

export function MicSection() {
  const userId = useUserId();
  const device = useDeviceSettings();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    let cancelled = false;
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => {
        if (cancelled) return;
        setDevices(all.filter((d) => d.kind === "audioinput"));
      })
      .catch(() => {
        // permission denied or unsupported — leave the list empty
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function onChange(next: string) {
    patchDeviceSettings(userId, { micDeviceId: next });
  }

  return (
    <SettingsSection
      title="Microphone"
      description="Per-device. Other devices keep their own choice."
    >
      <SettingRow label="Input device">
        <select
          value={device.micDeviceId}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px] outline-none focus:border-[var(--border-strong)]"
        >
          <option value="">System default</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || d.deviceId.slice(0, 8)}
            </option>
          ))}
        </select>
      </SettingRow>
    </SettingsSection>
  );
}
