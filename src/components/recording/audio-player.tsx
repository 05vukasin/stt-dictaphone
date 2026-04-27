"use client";

import { useEffect, useRef, useState } from "react";
import { getRecording } from "@/lib/storage/recordings-store";

interface AudioPlayerProps {
  id: string;
  mime: string;
}

export function AudioPlayer({ id, mime }: AudioPlayerProps) {
  const [src, setSrc] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let url: string | null = null;
    (async () => {
      const rec = await getRecording(id);
      if (!rec) return;
      url = URL.createObjectURL(rec.blob);
      setSrc(url);
    })();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  if (!src) {
    return (
      <div className="h-12 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
    );
  }

  return (
    <audio ref={audioRef} controls preload="metadata" src={src} className="w-full rounded-2xl">
      Your browser does not support the audio element.
      {mime ? <source src={src} type={mime} /> : null}
    </audio>
  );
}
