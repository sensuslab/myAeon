"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReadingPayload } from "./types";
import { useReadingStream } from "./useReadingStream";

/** One player and one browser audio cache shared by desktop and mobile controls. */
export function useReadingAudio(reading: ReadingPayload | null) {
  const stream = useReadingStream(reading);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;
    const sync = () => {
      setPlaying(!audio.paused && !audio.ended);
      setCurrentTime(audio.currentTime);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const failed = () => {
      setPlaying(false);
      setError("Your browser could not play this audio. Try downloading the recording.");
    };
    const events = ["play", "pause", "ended", "timeupdate", "loadedmetadata", "durationchange"];
    events.forEach((event) => audio.addEventListener(event, sync));
    audio.addEventListener("error", failed);
    return () => {
      requestRef.current?.abort();
      audio.pause();
      events.forEach((event) => audio.removeEventListener(event, sync));
      audio.removeEventListener("error", failed);
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, []);

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    const audio = audioRef.current;
    audio?.pause();
    if (audio) { audio.removeAttribute("src"); audio.load(); audio.playbackRate = 1; }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setGenerating(false); setReady(false); setPlaying(false);
    setCurrentTime(0); setDuration(0); setRate(1); setError(null); setNotice(null);
  }, [reading]);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.ended) audio.currentTime = 0;
    try { await audio.play(); setNotice(null); }
    catch {
      // iOS may require a second gesture after asynchronous audio generation.
      setNotice("Audio is ready. Press play to start listening.");
    }
  }, []);

  const togglePlayback = useCallback(async (autoplay = true) => {
    const audio = audioRef.current;
    if (!audio || requestRef.current) return;
    setError(null);
    if (urlRef.current) {
      if (!autoplay) return;
      if (!audio.paused) audio.pause(); else await play();
      return;
    }
    if (!reading?.audioScript || !reading.audioAuthorization) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setGenerating(true); setNotice(null);
    try {
      const response = await fetch("/api/reading/audio", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: reading.audioScript, authorization: reading.audioAuthorization }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Could not generate reading audio. Please try again.");
      }
      if (!response.headers.get("content-type")?.startsWith("audio/")) {
        throw new Error("The voice service returned invalid audio.");
      }
      const blob = await response.blob();
      if (controller.signal.aborted || !audioRef.current) return;
      if (!blob.size) throw new Error("The voice service returned empty audio.");
      urlRef.current = URL.createObjectURL(blob);
      audio.src = urlRef.current;
      setReady(true);
      if (autoplay) await play();
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not generate reading audio.");
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setGenerating(false); }
    }
  }, [reading, play]);

  const seek = useCallback((time: number) => {
    if (audioRef.current && Number.isFinite(time)) {
      audioRef.current.currentTime = time; setCurrentTime(time);
    }
  }, []);
  const changeRate = useCallback((value: number) => {
    if (audioRef.current) audioRef.current.playbackRate = value;
    setRate(value);
  }, []);

  return { stream, pause: () => audioRef.current?.pause(), generateDownload: () => togglePlayback(false), available: Boolean(reading?.audioScript && reading.audioAuthorization), generating, ready,
    playing, currentTime, duration, rate, error, notice, togglePlayback, seek, changeRate,
    downloadUrl: ready ? urlRef.current : null };
}

export type ReadingAudioState = ReturnType<typeof useReadingAudio>;
