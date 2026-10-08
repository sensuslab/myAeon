"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReadingPayload } from "./types";

type Piece = { buffer: AudioBuffer; offset: number };
type Scheduled = { source: AudioBufferSourceNode; start: number; end: number; offset: number; seconds: number; rate: number };
type Session = { context: AudioContext; socket: WebSocket; pieces: Piece[]; scheduled: Scheduled[];
  duration: number; position: number; rate: number; complete: boolean; paused: boolean; timer?: ReturnType<typeof setInterval>;
  timeout?: ReturnType<typeof setTimeout> };

function position(session: Session) {
  if (session.paused) return session.position;
  let value = session.position;
  for (const item of session.scheduled) {
    if (session.context.currentTime < item.start) break;
    value = item.offset + Math.min(item.seconds, (session.context.currentTime - item.start) * item.rate);
  }
  return value;
}

function schedule(session: Session, piece: Piece, offset = 0) {
  const source = session.context.createBufferSource();
  source.buffer = piece.buffer; source.playbackRate.value = session.rate;
  source.connect(session.context.destination);
  const last = session.scheduled[session.scheduled.length - 1];
  const start = Math.max(session.context.currentTime + 0.08, last?.end ?? 0);
  const seconds = piece.buffer.duration - offset;
  source.start(start, offset);
  session.scheduled.push({ source, start, end: start + seconds / session.rate,
    offset: piece.offset + offset, seconds, rate: session.rate });
}

function rebuild(session: Session, time: number) {
  for (const item of session.scheduled) { item.source.stop(); item.source.disconnect(); }
  session.scheduled = []; session.position = time;
  for (const piece of session.pieces) {
    if (piece.offset + piece.buffer.duration > time) schedule(session, piece, Math.max(0, time - piece.offset));
  }
}

export function useReadingStream(reading: ReadingPayload | null) {
  const ref = useRef<Session | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    const session = ref.current;
    ref.current = null;
    if (session) {
      clearInterval(session.timer); clearTimeout(session.timeout); session.socket.close();
      void session.context.close();
    }
    setConnecting(false); setPlaying(false); setReady(false); setComplete(false);
    setCurrentTime(0); setDuration(0); setRate(1);
  }, []);

  useEffect(() => {
    stop(); setReady(false); setComplete(false); setCurrentTime(0); setDuration(0); setRate(1); setError(null);
    return stop;
  }, [reading, stop]);

  const togglePlayback = useCallback(async () => {
    let session = ref.current;
    if (session) {
      setError(null);
      if (!session.paused) {
        session.position = position(session); session.paused = true;
        await session.context.suspend(); setPlaying(false);
      } else {
        if (session.complete && session.position >= session.duration - 0.05) rebuild(session, 0);
        await session.context.resume(); session.paused = false; setPlaying(true);
      }
      return;
    }
    if (!reading?.audioScript || !reading.audioAuthorization) return;
    setError(null); setConnecting(true);
    try {
      // Resume inside the tap gesture so iOS can play later incoming frames.
      const context = new AudioContext();
      const resume = context.resume();
      const url = new URL('/api/reading/audio/stream', window.location.href);
      url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(url);
      socket.binaryType = 'arraybuffer';
      session = { context, socket, pieces: [], scheduled: [], duration: 0, position: 0, rate: 1, complete: false, paused: false };
      const current = session;
      ref.current = current;
      const fail = (message: string) => {
        if (ref.current !== current) return;
        stop(); setReady(false); setError(message);
      };
      const timeout = setTimeout(() => {
        if (!current.pieces.length) fail('Listening took too long to start. Try again or Generate Download.');
      }, 30000);
      current.timeout = timeout;
      socket.onopen = () => socket.send(JSON.stringify({ script: reading.audioScript, authorization: reading.audioAuthorization }));
      socket.onmessage = event => {
        if (ref.current !== current) return;
        if (event.data instanceof ArrayBuffer) {
          const data = new DataView(event.data);
          if (!data.byteLength || data.byteLength % 2) { fail('The voice service returned invalid audio.'); return; }
          const buffer = context.createBuffer(1, data.byteLength / 2, 24000);
          const samples = buffer.getChannelData(0);
          for (let i = 0; i < samples.length; i++) samples[i] = data.getInt16(i * 2, true) / 32768;
          const piece = { buffer, offset: current.duration };
          current.pieces.push(piece); current.duration += buffer.duration;
          schedule(current, piece); clearTimeout(timeout);
          setReady(true); setConnecting(false); setDuration(current.duration);
          setPlaying(!current.paused && context.state === 'running');
        } else {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'error') fail(message.message);
            if (message.type === 'complete') { current.complete = true; setComplete(true); clearTimeout(timeout); }
          } catch { fail('Invalid streaming response.'); }
        }
      };
      socket.onerror = () => fail('Could not start listening. Try Generate Download.');
      socket.onclose = () => {
        clearTimeout(timeout);
        if (!current.complete && ref.current === current) fail('Listening was interrupted. Try again or Generate Download.');
      };
      current.timer = setInterval(() => {
        if (ref.current !== current) { clearTimeout(timeout); return; }
        const time = position(current); setCurrentTime(time);
        if (current.complete && time >= current.duration - 0.01 && !current.paused) {
          current.position = current.duration; current.paused = true;
          void context.suspend(); setPlaying(false);
        }
      }, 250);
      await resume;
    } catch {
      stop(); setError('Your browser could not start streaming audio. Try Generate Download.');
    }
  }, [reading, stop]);

  const seek = useCallback((time: number) => {
    const session = ref.current;
    if (session && Number.isFinite(time)) {
      const value = Math.max(0, Math.min(time, session.duration));
      rebuild(session, value); setCurrentTime(value);
    }
  }, []);
  const changeRate = useCallback((value: number) => {
    const session = ref.current;
    if (!session || ![0.75, 1, 1.25, 1.5, 2].includes(value)) return;
    const time = position(session);
    session.rate = value; rebuild(session, time); setRate(value);
  }, []);

  return { connecting, playing, ready, complete, currentTime, duration, rate, error, togglePlayback, seek, changeRate, stop };
}
