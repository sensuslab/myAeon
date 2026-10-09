"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/ui/AppHeader";
import ControlPanel, { type BirthInput } from "@/components/ui/ControlPanel";
import { initialBirthInput, londonToday, birthProfile, profileFingerprint } from "@/components/ui/BirthDetailsForm";
import type { AstrologyUsage } from "@/lib/astrologyTypes";
import ReadingPanel from "@/components/ui/ReadingPanel";
import PlanetTooltip from "@/components/ui/PlanetTooltip";
import PlanetInfoBar from "@/components/ui/PlanetInfoBar";
import HowItWorksModal from "@/components/ui/HowItWorksModal";
import AeonPreloader from "@/components/ui/AeonPreloader";
import QuickTour from "@/components/ui/QuickTour";
import MobileBottomActions from "@/components/ui/MobileBottomActions";
import MobileReadingDrawer from "@/components/ui/MobileReadingDrawer";
import MobileReadingView from "@/components/ui/MobileReadingView";
import type { ReadingPayload, ThemeMode } from "@/components/ui/types";
import { downloadReadingPdf } from "@/components/ui/downloadReadingPdf";
import { useReadingAudio } from "@/components/ui/useReadingAudio";
import {
  computeSnapshot,
  longitudeToSign,
  type CosmicSnapshot,
  type PlanetVisual,
  type ZodiacSign,
} from "@/lib/zodiac";

// 3D scene loads only on the client
const SceneCanvas = dynamic(() => import("@/components/scene/SceneCanvas"), {
  ssr: false,
  loading: () => null,
});
const VoiceExplorer = dynamic(() => import("@/components/ui/VoiceExplorer"), { ssr: false });

function todayInputValue() {
  return londonToday();
}

function dateFromInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  return new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`);
}

function formatSkyDate(value: string) {
  const today = todayInputValue();
  if (value === today) return "Now";
  return dateFromInput(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function Home() {
  const [birthInput, setBirthInput] = useState(initialBirthInput);
  const [confirmedProfile, setConfirmedProfile] = useState<{ id: string; fingerprint: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [usage, setUsage] = useState<AstrologyUsage | null>(null);
  const [enrichmentEnabled, setEnrichmentEnabled] = useState(false);
  const fingerprint = profileFingerprint(birthInput);
  const profileId = confirmedProfile?.fingerprint === fingerprint ? confirmedProfile.id : undefined;
  const refreshUsage = useCallback(async () => {
    try {
      const response = await fetch('/api/astrology/profile');
      const data = await response.json();
      setUsage(data.usage || null); setEnrichmentEnabled(Boolean(data.enabled));
    } catch { setEnrichmentEnabled(false); }
  }, []);
  useEffect(() => { void refreshUsage(); }, [refreshUsage]);
  const confirmProfile = useCallback(async (input: BirthInput) => {
    const response = await fetch('/api/astrology/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(birthProfile(input)) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not confirm birth details.');
    setConfirmedProfile({ id: data.profileId, fingerprint: profileFingerprint(input) });
    setProfileStatus('Birth details confirmed for Zeus. Chart calculations start when needed.');
    return data.profileId as string;
  }, []);
  const handleConfirm = useCallback(async (input: BirthInput) => {
    setConfirming(true); setProfileStatus(null);
    try { await confirmProfile(input); } catch (err) { setProfileStatus(err instanceof Error ? err.message : 'Could not confirm details.'); }
    finally { setConfirming(false); }
  }, [confirmProfile]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sign, setSign] = useState<ZodiacSign | null>(null);
  const [reading, setReading] = useState<ReadingPayload | null>(null);
  const audio = useReadingAudio(reading);
  const [hoveredPlanet, setHoveredPlanet] = useState<PlanetVisual | null>(null);
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetVisual | null>(null);
  const [flat, setFlat] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [themeReady, setThemeReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileReadingOpen, setMobileReadingOpen] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const handlePreloaderComplete = useCallback(() => setAppReady(true), []);
  const openTour = useCallback(() => {
    setVoiceOpen(false);
    setHowItWorksOpen(false);
    setTourOpen(true);
  }, []);
  const closeTour = useCallback(() => {
    setTourOpen(false);
    try { window.localStorage.setItem("aeon-walkthrough-astrologer-v2", "seen"); } catch {}
  }, []);
  useEffect(() => {
    if (!appReady) return;
    try {
      if (!window.localStorage.getItem("aeon-walkthrough-astrologer-v2")) setTourOpen(true);
    } catch { setTourOpen(true); }
  }, [appReady]);
  const skyDate = birthInput.readingDate;
  const changeBirthInput = useCallback((input: BirthInput) => { setBirthInput(input); setProfileStatus(null); }, []);

  // Compute the displayed sky for the selected reading date.
  const snapshot: CosmicSnapshot = useMemo(() => {
    return computeSnapshot(dateFromInput(skyDate));
  }, [skyDate]);
  const skyDateLabel = useMemo(() => formatSkyDate(skyDate), [skyDate]);

  // Pre-compute current zodiac sign for each planet (used by tooltip + info bar)
  const signsById = useMemo(() => {
    const out: Record<string, ZodiacSign> = {};
    snapshot.planets.forEach((p) => {
      out[p.id] = longitudeToSign(p.longitude);
    });
    return out;
  }, [snapshot]);

  // Update the "current time" display once per minute
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now));
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("aeon-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
    setThemeReady(true);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    window.localStorage.setItem("aeon-theme", theme);

    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    themeMeta?.setAttribute("content", theme === "light" ? "#eef6f9" : "#050616");
  }, [theme, themeReady]);

  const fetchReading = useCallback(async (input: BirthInput, s: ZodiacSign) => {
    setSign(s);
    setError(null);
    setReading(null);
    setLoading(true);

    try {
      const confirmedId = input.confirmed ? await confirmProfile(input) : undefined;
      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, birthTime: input.timeConfidence === "unknown" ? undefined : input.birthTime, birthPlace: `${input.location.city}, ${input.location.nation}`, profileId: confirmedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      setReading(data as ReadingPayload);
      if (data.meta?.astrology?.usage) setUsage(data.meta.astrology.usage);
      if (isMobile) {
        setMobileDrawerOpen(false);
        setMobileReadingOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      void refreshUsage();
    }
  }, [isMobile, confirmProfile, refreshUsage]);

  const handlePlanetClick = useCallback((p: PlanetVisual) => {
    setSelectedPlanet(p);
    if (!isMobile) return;
    if (reading) {
      setMobileReadingOpen(true);
    } else {
      setMobileDrawerOpen(true);
    }
  }, [isMobile, reading]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    if (!reading) return;
    setPdfLoading(true);
    setError(null);
    try {
      await downloadReadingPdf(reading);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create PDF");
    } finally {
      setPdfLoading(false);
    }
  }, [reading]);

  const tooltipSign = hoveredPlanet ? signsById[hoveredPlanet.id]?.name ?? null : null;
  const selectedPlanetPosition = selectedPlanet
    ? snapshot.planets.find((p) => p.id === selectedPlanet.id) ?? null
    : null;
  const selectedPlanetSign = selectedPlanet ? signsById[selectedPlanet.id] ?? null : null;
  const selectedPlanetDegree = selectedPlanetPosition
    ? Math.floor(selectedPlanetPosition.longitude % 30)
    : null;

  return (
    <main
      data-theme={theme}
      className="relative h-[100svh] w-full overflow-hidden bg-[var(--app-bg)] text-[var(--app-text)] transition-colors duration-300"
    >
      {!(isMobile && mobileReadingOpen) && (
        <SceneCanvas
          snapshot={snapshot}
          onPlanetHover={setHoveredPlanet}
          onPlanetClick={handlePlanetClick}
          flat={flat}
          selectedPlanetId={selectedPlanet?.id ?? null}
          theme={theme}
          onReady={() => setSceneReady(true)}
        />
      )}

      <AppHeader
        sunSign={sign ? { name: sign.name, symbol: sign.glyph } : null}
        currentTime={currentTime}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenTour={openTour}
      />

      <div className="hidden md:block">
        <ControlPanel
          onSubmit={fetchReading}
          loading={loading}
          onViewChange={setFlat}
          flat={flat}
          onHowItWorks={() => setHowItWorksOpen(true)}
          input={birthInput} onChange={changeBirthInput} onConfirm={handleConfirm}
          confirming={confirming} profileConfirmed={Boolean(profileId)} status={profileStatus}
          usage={usage} enrichmentEnabled={enrichmentEnabled}
        />
      </div>

      <div className="hidden md:block">
        <ReadingPanel
          reading={reading}
          audio={audio}
          sign={sign}
          loading={loading}
          error={error}
          pdfLoading={pdfLoading}
          selectedPlanet={selectedPlanet}
          selectedPlanetSign={selectedPlanetSign}
          selectedPlanetDegree={selectedPlanetDegree}
          onDownloadPdf={handleDownloadPdf}
          onClearSelectedPlanet={() => setSelectedPlanet(null)}
        />
      </div>

      <div className="hidden md:block">
        <PlanetInfoBar snapshot={snapshot} signsById={signsById} label={skyDateLabel} />
      </div>

      <MobileBottomActions
        hidden={mobileDrawerOpen || voiceOpen || tourOpen || howItWorksOpen}
        readingView={mobileReadingOpen}
        onTalk={() => setVoiceOpen(true)}
        loading={loading}
        reading={reading}
        onOpenDrawer={() => { setMobileReadingOpen(false); setMobileDrawerOpen(true); }}
        onOpenReading={() => setMobileReadingOpen(true)}
      />

      <MobileReadingDrawer
        open={mobileDrawerOpen}
        loading={loading}
        error={error}
        reading={reading}
        flat={flat}
        onSubmit={fetchReading}
        onClose={() => setMobileDrawerOpen(false)}
        onViewChange={setFlat}
        onViewReading={() => {
          setMobileDrawerOpen(false);
          setMobileReadingOpen(true);
        }}
        onHowItWorks={() => setHowItWorksOpen(true)}
        input={birthInput} onChange={changeBirthInput} onConfirm={handleConfirm}
        confirming={confirming} profileConfirmed={Boolean(profileId)} status={profileStatus}
        usage={usage} enrichmentEnabled={enrichmentEnabled}
      />

      <MobileReadingView
        onOpenTour={openTour}
        open={mobileReadingOpen}
        reading={reading}
        audio={audio}
        sign={sign}
        loading={loading}
        error={error}
        pdfLoading={pdfLoading}
        selectedPlanet={selectedPlanet}
        selectedPlanetSign={selectedPlanetSign}
        selectedPlanetDegree={selectedPlanetDegree}
        onClose={() => setMobileReadingOpen(false)}
        onEditDetails={() => {
          setMobileReadingOpen(false);
          setMobileDrawerOpen(true);
        }}
        onDownloadPdf={handleDownloadPdf}
        onClearSelectedPlanet={() => setSelectedPlanet(null)}
      />

      <PlanetTooltip planet={hoveredPlanet} sign={tooltipSign} />

      <HowItWorksModal
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
      />

      <AeonPreloader ready={sceneReady} theme={theme} onComplete={handlePreloaderComplete} />
      <QuickTour open={tourOpen} onClose={closeTour} />
      <VoiceExplorer profileId={profileId} contextId={reading?.meta?.astrology?.contextId} onUsageRefresh={refreshUsage} open={voiceOpen} onOpen={() => setVoiceOpen(true)} onClose={() => setVoiceOpen(false)} reading={reading} viewedDate={skyDate} selectedPlanet={selectedPlanet?.id ?? null} onStart={() => { audio.stream.stop(); audio.pause(); }} />
    </main>
  );
}
