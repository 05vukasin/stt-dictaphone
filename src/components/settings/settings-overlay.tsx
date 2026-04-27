"use client";

import { Modal } from "../ui/modal";
import { ThemeSelector } from "./theme-selector";
import { ProviderSection } from "./provider-section";
import { PromptSection } from "./prompt-section";
import { DataSection } from "./data-section";
import { ShortcutsSection } from "./shortcuts-section";
import { AboutSection } from "./about-section";
import { SettingsSection } from "./settings-section";

interface SettingsOverlayProps {
  open: boolean;
  onClose(): void;
}

export function SettingsOverlay({ open, onClose }: SettingsOverlayProps) {
  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="flex flex-col gap-3">
        <SettingsSection title="Appearance">
          <ThemeSelector />
        </SettingsSection>
        <ProviderSection />
        <PromptSection />
        <DataSection />
        <ShortcutsSection />
        <AboutSection />
      </div>
    </Modal>
  );
}
