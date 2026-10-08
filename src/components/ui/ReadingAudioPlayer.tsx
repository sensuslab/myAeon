"use client";

import { useId } from "react";
import type { ReadingAudioState } from "./useReadingAudio";

function timeLabel(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export default function ReadingAudioPlayer({ audio }: { audio: ReadingAudioState }) {
  const id = useId();
  return (
    <section aria-label="Listen to your reading" className="rounded-2xl border border-astral-cyan/20 bg-astral-cyan/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--app-text)]">Your reading, spoken</p>
          <p className="mt-1 text-[11px] text-[var(--app-text)] opacity-60">All timeframes and planet reflections</p>
        </div>
        <button type="button" onClick={() => void audio.togglePlayback()}
          disabled={!audio.available || audio.generating} aria-busy={audio.generating}
          aria-describedby={`${id}-status`}
          className="min-h-11 shrink-0 rounded-full border border-astral-cyan/30 bg-astral-cyan/10 px-4 text-xs text-astral-cyan transition hover:bg-astral-cyan/20 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-astral-cyan">
          {audio.generating ? "Preparing audio…" : audio.playing ? "Pause" : audio.ready ? "Play" : audio.error ? "Try again" : "Listen to reading"}
        </button>
      </div>
      {audio.ready && (
        <div className="mt-3 space-y-2">
          <input type="range" aria-label="Reading playback position" min={0} max={audio.duration || 1}
            step={0.1} value={Math.min(audio.currentTime, audio.duration || 1)}
            disabled={!audio.duration} onChange={(event) => audio.seek(Number(event.target.value))}
            className="h-6 w-full accent-astral-cyan" />
          <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--app-text)]">
            <span>{timeLabel(audio.currentTime)} / {timeLabel(audio.duration)}</span>
            <label className="flex items-center gap-2" htmlFor={`${id}-speed`}>Speed
              <select id={`${id}-speed`} value={audio.rate} onChange={(event) => audio.changeRate(Number(event.target.value))}
                className="min-h-9 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-strong-bg)] px-2">
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
              </select>
            </label>
            {audio.downloadUrl && <a href={audio.downloadUrl} download="myAeon-reading.wav"
              className="text-astral-cyan underline underline-offset-2">Download</a>}
          </div>
        </div>
      )}
      <p id={`${id}-status`} role="status" aria-live="polite" className="mt-2 text-[11px] text-[var(--app-text)] opacity-60">
        {!audio.available ? "Listening is not available for this reading yet."
          : audio.generating ? "Creating your narration. This may take a moment."
            : audio.notice ?? (audio.ready ? "Your recording is ready to replay." : "Audio is created only when you choose to listen.")}
      </p>
      {audio.error && <p role="alert" className="mt-2 text-xs text-red-400">{audio.error}</p>}
    </section>
  );
}
