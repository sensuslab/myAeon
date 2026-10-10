"use client";

import { useId } from "react";
import { Download, LoaderCircle, Pause, Play, Square } from "lucide-react";
import type { ReadingAudioState } from "./useReadingAudio";
import { publicMessage } from "./chartPresentation";

function timeLabel(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export default function ReadingAudioPlayer({ audio }: { audio: ReadingAudioState }) {
  const id = useId();
  const stream = audio.stream;
  const control = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-astral-cyan/30 bg-astral-cyan/10 px-3 text-xs text-astral-cyan transition hover:bg-astral-cyan/20 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-astral-cyan";
  return (
    <section aria-label="Listen to your reading" className="border-y border-astral-cyan/20 py-4">
      <p className="text-xs font-medium text-[var(--app-text)]">Your reading, spoken</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void stream.togglePlayback()}
          disabled={!audio.available || stream.connecting} aria-busy={stream.connecting}
          aria-describedby={`${id}-status`} className={`${control} flex-1`}>
          {stream.connecting ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />
            : stream.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          {stream.connecting ? "Connecting" : stream.playing ? "Pause" : stream.ready ? "Play" : "Listen"}
        </button>
        {(stream.ready || stream.connecting) && <button type="button" onClick={stream.stop}
          title="Stop listening" aria-label="Stop listening" className={`${control} w-11 px-0`}><Square size={15} aria-hidden /></button>}
        {audio.downloadUrl ? <a href={audio.downloadUrl} download="myAeon-reading.wav" className={`${control} flex-1`}>
          <Download size={16} aria-hidden />Download
        </a> : <button type="button" onClick={() => void audio.generateDownload()}
          disabled={!audio.available || audio.generating} aria-busy={audio.generating} className={`${control} flex-1`}>
          {audio.generating ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Download size={16} aria-hidden />}
          {audio.generating ? "Generating" : "Generate Download"}
        </button>}
      </div>
      {stream.ready && (
        <div className="mt-3 space-y-2">
          <input type="range" aria-label="Reading playback position" min={0} max={stream.duration || 1}
            step={0.1} value={Math.min(stream.currentTime, stream.duration || 1)}
            disabled={!stream.duration} onChange={(event) => stream.seek(Number(event.target.value))}
            className="h-8 w-full accent-astral-cyan" />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--app-text)]">
            <span>{timeLabel(stream.currentTime)} / {timeLabel(stream.duration)}{!stream.complete ? " buffered" : ""}</span>
            <label className="flex items-center gap-2" htmlFor={`${id}-speed`}>Speed
              <select id={`${id}-speed`} value={stream.rate} onChange={(event) => stream.changeRate(Number(event.target.value))}
                className="min-h-11 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-strong-bg)] px-2">
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => <option key={rate} value={rate}>{rate}x</option>)}
              </select>
            </label>
          </div>
        </div>
      )}
      <p id={`${id}-status`} role="status" aria-live="polite" className="mt-2 text-xs text-[var(--app-text)] opacity-60">
        {!audio.available ? "Listening is not available for this reading yet."
          : stream.connecting ? "Starting your reading..."
            : stream.playing ? "Listening" : stream.ready ? "Paused" : ""}
      </p>
      {audio.generating && <p role="status" className="mt-2 text-xs text-[var(--app-text)] opacity-60">Preparing your complete recording...</p>}
      {stream.error && <p role="alert" className="mt-2 text-xs text-red-400">{publicMessage(stream.error, "Could not start listening. Please try again.")}</p>}
      {audio.error && <p role="alert" className="mt-2 text-xs text-red-400">{publicMessage(audio.error, "Could not generate your recording. Please try again.")}</p>}
    </section>
  );
}
