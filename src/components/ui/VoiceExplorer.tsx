"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, X, Mic, MicOff, Volume2, VolumeX, Send } from "lucide-react";
import { AgentProvider, Orb, useAgentContext } from "@deepgram/ui";
import type { AgentSessionConfig } from "@deepgram/agents";
import type { ReadingPayload } from "./types";
type Props = { reading: ReadingPayload | null; viewedDate: string; selectedPlanet: string | null; onStart: () => void };

function Conversation({ onEnd }: { onEnd: (error?: string) => void }) {
  const agent = useAgentContext();
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [compact, setCompact] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const active = agent.state === "connected";
  const connecting = agent.state === "connecting" || agent.state === "reconnecting";
  useEffect(() => {
    const update = () => setCompact((window.visualViewport?.height || window.innerHeight) < 600);
    update(); window.addEventListener("resize", update); window.visualViewport?.addEventListener("resize", update);
    return () => { window.removeEventListener("resize", update); window.visualViewport?.removeEventListener("resize", update); };
  }, []);
  useEffect(() => {
    const failed = () => { agent.stop(); onEnd("Voice connection interrupted. Check microphone access and try again."); };
    agent.session.on("error", failed); agent.session.on("sdk-error", failed);
    return () => { agent.session.off("error", failed); agent.session.off("sdk-error", failed); };
  }, [agent.session, agent.stop, onEnd]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [agent.conversation]);
  return <>
    <div className="flex shrink-0 flex-col items-center gap-3 py-3">
      <Orb size={compact ? 96 : 180} colors={["#d4a437", "#38b8c9"]} state={agent.isSpeaking ? "talking" : agent.isListening ? "listening" : "idle"} getInputVolume={agent.getInputVolume} getOutputVolume={agent.getOutputVolume} />
      <p aria-live="polite" className="h-5 text-sm opacity-70">{connecting ? "Connecting..." : active ? agent.isSpeaking ? "myAeon is speaking" : agent.micMuted ? "Microphone muted" : "Listening" : ""}</p>
      <div className="flex items-center gap-3">
        <button disabled={connecting} onClick={async () => { setError(null); if (active) { agent.stop(); onEnd(); } else try { await agent.start(); } catch { onEnd("Allow microphone access in your browser and try again."); } }} className="flex min-h-12 items-center justify-center rounded-lg bg-[#d4a437] px-5 text-sm font-semibold text-[#15120b] disabled:opacity-50">{active ? "End" : connecting ? "Connecting..." : "Start conversation"}</button>
        {active && <><button title={agent.micMuted ? "Unmute microphone" : "Mute microphone"} aria-label={agent.micMuted ? "Unmute microphone" : "Mute microphone"} aria-pressed={agent.micMuted} onClick={() => agent.setMicMuted(!agent.micMuted)} className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--panel-border)]">{agent.micMuted ? <MicOff size={20} /> : <Mic size={20} />}</button><button title={agent.outputMuted ? "Unmute speaker" : "Mute speaker"} aria-label={agent.outputMuted ? "Unmute speaker" : "Mute speaker"} aria-pressed={agent.outputMuted} onClick={() => agent.setOutputMuted(!agent.outputMuted)} className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--panel-border)]">{agent.outputMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button></>}
      </div>
    </div>
    {error && <p role="alert" className="mx-5 mb-3 text-sm text-red-500">{error}</p>}
    <div role="log" aria-label="Conversation transcript" className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 text-base leading-7">{agent.conversation.map(turn => <div key={turn.id} className="border-b border-[var(--panel-border)] py-4"><p className="mb-1 text-xs font-medium opacity-60">{turn.role === "user" ? "You" : "myAeon"}</p><p>{turn.content}</p></div>)}<div ref={end} /></div>
    {active && <form className="mx-5 mb-3 flex shrink-0 gap-2" onSubmit={event => { event.preventDefault(); if (input.trim()) { agent.sendUserMessage(input.trim()); setInput(""); } }}><input aria-label="Message myAeon" placeholder="Ask myAeon..." maxLength={2000} value={input} onChange={event => setInput(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[var(--panel-border)] bg-[var(--field-bg)] px-3 text-base" /><button title="Send message" aria-label="Send message" disabled={!input.trim()} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--panel-border)] disabled:opacity-40"><Send size={18} /></button></form>}
  </>;
}

export default function VoiceExplorer({ reading, viewedDate, selectedPlanet, onStart }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const context = useRef({ reading, viewedDate, selectedPlanet });
  const token = useRef<string | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const launchButton = useRef<HTMLButtonElement>(null);
  const startRef = useRef(onStart);
  startRef.current = onStart; context.current = { reading, viewedDate, selectedPlanet };
  const config = useMemo<AgentSessionConfig>(() => ({
    url: `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/explore`, reconnect: { enabled: false },
    auth: { tokenFactory: async () => {
      startRef.current(); setError(null);
      const response = await fetch("/api/explore/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: context.current }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Could not start conversation."); throw new Error("Session unavailable"); }
      token.current = data.token; return data.token;
    } },
    agent: { think: { provider: { type: "open_ai", model: "gpt-6-luna" } } },
    audio: { input: { encoding: "linear16", sampleRate: 16000 }, output: { encoding: "linear16", sampleRate: 24000 } },
  }), []);
  useEffect(() => {
    if (!open || !token.current) return;
    const controller = new AbortController();
    void fetch("/api/explore/session", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, context: context.current }) }).then(res => { if (!res.ok && res.status !== 410) setError("Restart the conversation to use your latest reading."); }).catch(() => { if (!controller.signal.aborted) setError("Could not refresh conversation context."); });
    return () => controller.abort();
  }, [reading, viewedDate, selectedPlanet, open]);
  useEffect(() => { if (!open) return; setError(null); token.current = null; closeButton.current?.focus(); return () => { token.current = null; launchButton.current?.focus(); }; }, [open]);
  return <>
    <button ref={launchButton} type="button" onClick={() => setOpen(true)} aria-label="Explore astrology with myAeon" className="fixed right-4 top-20 z-40 flex min-h-11 items-center gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-strong-bg)] px-3 text-sm text-[var(--app-text)] shadow-lg md:right-auto md:left-1/2 md:top-6 md:-translate-x-1/2"><AudioLines size={18} /> Explore</button>
    {open && <div className="fixed inset-0 z-[100] flex justify-end bg-black/45 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="voice-heading" className="flex h-[100dvh] w-full flex-col bg-[var(--app-bg)] text-[var(--app-text)] shadow-2xl md:max-w-md" onClick={event => event.stopPropagation()} onKeyDown={event => {
        if (event.key === "Escape") setOpen(false);
        if (event.key === "Tab") { const elements = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]'); const first = elements[0]; const last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
      }}>
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--panel-border)] px-5 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]"><div><h2 id="voice-heading" className="text-lg font-medium">Explore with myAeon</h2><p className="mt-1 text-xs opacity-60">{reading ? "Your reading and the sky" : "The sky and astrology"}</p></div><button ref={closeButton} onClick={() => setOpen(false)} aria-label="Close and end conversation" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10"><X size={20} /></button></header>
        {error && <p role="alert" className="mx-5 mt-3 text-sm text-red-500">{error}</p>}
        <AgentProvider key={sessionVersion} config={config} tts><Conversation onEnd={message => { token.current = null; setError(message || null); setSessionVersion(value => value + 1); }} /></AgentProvider>
        <p className="shrink-0 border-t border-[var(--panel-border)] px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 text-xs leading-5 opacity-60">Audio is processed by Deepgram. Conversations are not saved by myAeon. Astrology offers reflection, not certainty.</p>
      </section>
    </div>}
  </>;
}
