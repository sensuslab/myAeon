"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import type { ThemeMode } from "@/components/ui/types";

export default function PrivacyPage() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  useEffect(() => {
    try { const saved = localStorage.getItem("aeon-theme"); if (saved === "light" || saved === "dark") setTheme(saved); } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
  }, [theme]);
  const toggleTheme = () => setTheme(current => {
    const next = current === "dark" ? "light" : "dark";
    try { localStorage.setItem("aeon-theme", next); } catch {}
    return next;
  });
  return <main data-theme={theme} className="min-h-[100svh] bg-[var(--app-bg)] text-[var(--app-text)]">
    <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 border-b border-[var(--panel-border)] px-5 py-5">
      <Link href="/" aria-label="Back to myAeon"><Image src="/brand/my-aeon-wordmark.png" alt="myAeon" width={1456} height={449} className="aeon-header-wordmark" /></Link>
      <button type="button" onClick={toggleTheme} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--panel-border)]">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
    </header>
    <article className="mx-auto max-w-3xl px-5 py-8 text-sm leading-7 md:text-base">
      <Link href="/" className="mb-7 inline-flex min-h-11 items-center gap-2 text-sm text-astral-cyan"><ArrowLeft size={16} />Back to myAeon</Link>
      <h1 className="text-3xl font-medium">Privacy policy</h1>
      <p className="mt-2 mb-8 text-sm opacity-70">Effective date: 10 October 2026</p>
      <div className="space-y-7">
        <Section title="What this policy covers">
          <p>This policy describes the data handled by this myAeon application and the external services it uses. Birth details can identify you. Do not enter anyone else&apos;s details without their permission, and avoid sharing sensitive information in a voice conversation. AI-generated astrology is for reflection, not professional advice.</p>
        </Section>
        <Section title="Birth details and chart calculation">
          <p>We process the birth date, optional name, local birth time and its confidence, birthplace coordinates, country, timezone, clock-change choice, selected reading date and your confirmation. You authorise this use through the birth-details consent checkbox. Confirming creates a private profile associated with an anonymous browser identifier.</p>
          <p>Charts are computed locally on the application server using Kerykeion and its ephemeris runtime. This does not mean calculation happens on your device: your birth details reach the app server. Chart calculation alone does not send those details to a hosted astrology service or generate an AI interpretation. A full wheel is provided only for a known, recorded birth time; estimated and unknown times are treated with stated limitations.</p>
        </Section>
        <Section title="AI readings and chart interpretation">
          <p>Casting a reading sends the submitted reading details and relevant sky information to a remote AI service. Choosing Enhance with my birth chart or Interpret birth chart additionally sends calculated natal/transit facts and, when present, your current reading for interpretation. Chart interpretation is an explicit action, separate from chart calculation.</p>
          <p>The configured reading provider is DeepSeek. Its handling of prompts, generated output, security records, international transfers and retention is governed by its own terms and <a href="https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html" className="privacy-link" target="_blank" rel="noopener noreferrer">privacy policy</a>. That policy describes processing and storage in the People&apos;s Republic of China. We do not promise that external AI services immediately delete prompts or never use them for service improvement.</p>
        </Section>
        <Section title="Listening and conversations">
          <p>Listening or generating an audio download sends the reading text to Deepgram for speech generation. When you start a Zeus conversation, microphone audio, typed messages, transcripts, the selected sky date, your current reading and available chart facts are processed remotely by Deepgram and the configured model provider, OpenAI. Merely opening the conversation panel does not activate your microphone; ending or closing the conversation stops it.</p>
          <p>myAeon does not create a permanent conversation archive. Active conversation context is held temporarily in server memory, and the visible transcript is held in the browser during the session. External processing has separate retention rules: see <a href="https://deepgram.com/privacy" className="privacy-link" target="_blank" rel="noopener noreferrer">Deepgram&apos;s privacy policy</a>, its <a href="https://developers.deepgram.com/trust-security/your-data" className="privacy-link" target="_blank" rel="noopener noreferrer">data-handling documentation</a> and <a href="https://developers.openai.com/api/docs/guides/your-data" className="privacy-link" target="_blank" rel="noopener noreferrer">OpenAI&apos;s API data controls</a>. Retention depends on the service and deployment configuration, including abuse monitoring and legal requirements; this app does not guarantee zero provider retention.</p>
        </Section>
        <Section title="Temporary storage and downloads">
          <p>Private profiles, computed chart contexts and chart results use bounded, temporary server-memory caches with a one-hour expiry. Generated download audio may be cached on the server for up to one hour to avoid repeat processing. Active voice context lasts for the conversation; unused connection tickets expire quickly. The browser holds your current reading, chart images and audio while the page is open.</p>
          <p>Expiry limits reuse of cached entries, but is not a guarantee of immediate physical deletion from all systems or backups. It does not govern external providers or hosting logs. SVG, PDF and audio files that you download remain on your device until you delete them. Chart files contain personal chart information; take care when sharing them.</p>
        </Section>
        <Section title="Cookies and local preferences">
          <p>A signed, anonymous, HTTP-only cookie associates your browser with its private profile and chart contexts. It is scoped to this site, uses SameSite protection and has a one-year lifetime. It is not an account login and does not contain your birth details. Clearing it breaks that browser&apos;s association with existing private contexts.</p>
          <p>Your theme and walkthrough preference are stored in browser local storage until you clear them. They are not advertising preferences. You can remove site cookies and local storage through your browser settings. Doing so does not delete copies already processed by external providers.</p>
        </Section>
        <Section title="Hosting, security and retention">
          <p>Requests also expose ordinary technical data, such as IP address, timestamps, browser information and request paths, to the application host and any infrastructure it uses. Hosting, proxy and security systems may keep access, diagnostic or abuse-prevention logs under their own retention policies. We do not claim that there are no hosting logs. API credentials stay on the server; private chart identifiers are associated with the anonymous browser session.</p>
          <p>External providers may process data in other countries, retain it longer than the application cache, or disclose it when legally required. Their linked policies and the actual hosting configuration determine those practices. Avoid submitting sensitive material that is unnecessary for the reading or conversation.</p>
        </Section>
        <Section title="Your choices and questions">
          <p>You can explore the solar system without submitting birth details. You choose whether to confirm a profile, cast a reading, request chart interpretation, listen, download or start a conversation. To stop new processing, do not invoke those actions; end the voice session and close the page. Clear browser site data to remove local preferences and the anonymous cookie. Requests about data already sent to a provider should also follow that provider&apos;s privacy procedures.</p>
          <p>For questions about this deployment or requests to its operator, use the contact or issue channels in the <a href="https://github.com/sensuslab/myAeon" className="privacy-link" target="_blank" rel="noopener noreferrer">myAeon source repository</a>. Do not post birth details, private identifiers or conversation transcripts in a public issue. Deployment operators are responsible for keeping their processing and contact information accurate.</p>
        </Section>
        <Section title="Source and licensing">
          <p>The application source is available on <a href="https://github.com/sensuslab/myAeon" className="privacy-link" target="_blank" rel="noopener noreferrer">GitHub</a>. Kerykeion is licensed under <a href="https://www.gnu.org/licenses/agpl-3.0.html" className="privacy-link" target="_blank" rel="noopener noreferrer">AGPL-3.0</a>; its <a href="https://github.com/g-battaglia/kerykeion" className="privacy-link" target="_blank" rel="noopener noreferrer">source and licensing terms</a> must be reviewed together with the ephemeris dependencies. Non-commercial use is not an exemption from AGPL requirements. Operators must meet applicable licence, corresponding-source and network-use obligations; a source link alone is not a claim that every deployment is compliant.</p>
        </Section>
        <Section title="Changes">
          <p>We may update this policy as the application or its processing changes. The effective date above identifies this version. External provider policies can change independently; consult the linked policies before submitting details you consider sensitive.</p>
        </Section>
      </div>
    </article>
  </main>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3"><h2 className="text-lg font-medium text-astral-gold">{title}</h2>{children}</section>;
}
