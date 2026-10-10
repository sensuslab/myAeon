"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import SceneViewControls, { type SceneView } from "@/components/ui/SceneViewControls";
import BirthChartView from "@/components/ui/BirthChartView";
import { publicMessage, type ChartContext, type ReadingWithChart } from "@/components/ui/chartPresentation";
import type { ThemeMode } from "@/components/ui/types";
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
  const [view, setView] = useState<SceneView>("solar");
  const [chart, setChart] = useState<{ key: string; context: ChartContext } | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [enhancingChart, setEnhancingChart] = useState(false);
  const [enhancementError, setEnhancementError] = useState<string | null>(null);
  const fingerprint = profileFingerprint(birthInput);
  const inputKey = `${fingerprint}|${birthInput.readingDate}`;
  const currentKey = useRef(inputKey);
  currentKey.current = inputKey;
  const latestInput = useRef(birthInput);
  latestInput.current = birthInput;
  const chartRequest = useRef<AbortController | null>(null);
  const readingRequest = useRef<AbortController | null>(null);
  const enhanceRequest = useRef<AbortController | null>(null);
  const currentChart = chart?.key === inputKey ? chart.context : null;
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
    if (!input.confirmed) throw new Error('Confirm permission to use these birth details first.');
    if (confirmedProfile?.fingerprint === profileFingerprint(input)) return confirmedProfile.id;
    const response = await fetch('/api/astrology/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(birthProfile(input)) });
    const data = await response.json();
    if (!response.ok || typeof data.profileId !== 'string') throw new Error(publicMessage(data.error, 'Could not confirm birth details. Please try again.'));
    if (profileFingerprint(latestInput.current) === profileFingerprint(input)) {
      setConfirmedProfile({ id: data.profileId, fingerprint: profileFingerprint(input) });
      setProfileStatus('Birth details confirmed. Your chart is calculated when requested.');
    }
    return data.profileId as string;
  }, [confirmedProfile]);
  const handleConfirm = useCallback(async (input: BirthInput) => {
    setConfirming(true); setProfileStatus(null);
    try { await confirmProfile(input); } catch (err) { setProfileStatus(publicMessage(err, 'Could not confirm birth details. Please try again.')); }
    finally { setConfirming(false); }
  }, [confirmProfile]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sign, setSign] = useState<ZodiacSign | null>(null);
  const [reading, setReading] = useState<ReadingWithChart | null>(null);
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
    try { window.localStorage.setItem("aeon-walkthrough-chart-v3", "seen"); } catch {}
  }, []);
  useEffect(() => {
    if (!appReady) return;
    try {
      if (!window.localStorage.getItem("aeon-walkthrough-chart-v3")) setTourOpen(true);
    } catch { setTourOpen(true); }
  }, [appReady]);
  const skyDate = birthInput.readingDate;
  const changeBirthInput = useCallback((input: BirthInput) => {
    const nextKey = `${profileFingerprint(input)}|${input.readingDate}`;
    if (nextKey !== currentKey.current) {
      currentKey.current = nextKey;
      chartRequest.current?.abort(); readingRequest.current?.abort(); enhanceRequest.current?.abort(); enhanceRequest.current = null;
      setChart(null); setChartError(null); setChartLoading(false);
      setEnhancingChart(false); setEnhancementError(null);
      setReading(null); setLoading(false); setError(null);
    }
    latestInput.current = input;
    setBirthInput(input); setProfileStatus(null);
  }, []);

  useEffect(() => () => {
    chartRequest.current?.abort(); readingRequest.current?.abort(); enhanceRequest.current?.abort();
  }, []);

  const fetchChart = useCallback(async (input: BirthInput, confirmedId: string) => {
    const key = `${profileFingerprint(input)}|${input.readingDate}`;
    if (currentKey.current !== key || chart?.key === key) return;
    chartRequest.current?.abort();
    const controller = new AbortController();
    chartRequest.current = controller;
    setChartLoading(true); setChartError(null);
    try {
      const response = await fetch('/api/astrology/chart', {
        method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: confirmedId, readingDate: input.readingDate }),
      });
      const data = await response.json();
      if (!response.ok || !data.context?.id) throw new Error(publicMessage(data.error, 'Could not calculate your chart. Your reading remains available.'));
      if (!controller.signal.aborted && currentKey.current === key) setChart({ key, context: data.context as ChartContext });
    } catch (err) {
      if (!controller.signal.aborted && currentKey.current === key) setChartError(publicMessage(err, 'Could not calculate your chart. Your reading remains available.'));
    } finally {
      if (chartRequest.current === controller && currentKey.current === key) setChartLoading(false);
    }
  }, [chart]);

  const calculateChart = useCallback(async () => {
    const input = latestInput.current;
    setChartError(null); setChartLoading(true);
    try {
      const id = await confirmProfile(input);
      await fetchChart(input, id);
    } catch (err) { if (latestInput.current === input) setChartError(publicMessage(err, 'Could not calculate your chart. Please try again.')); }
    finally { if (latestInput.current === input) setChartLoading(false); }
  }, [confirmProfile, fetchChart]);

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
    readingRequest.current?.abort(); enhanceRequest.current?.abort(); enhanceRequest.current = null;
    const controller = new AbortController();
    readingRequest.current = controller;
    const key = `${profileFingerprint(input)}|${input.readingDate}`;
    setEnhancingChart(false); setEnhancementError(null);
    setSign(s);
    setError(null);
    setReading(null);
    setLoading(true);

    try {
      const confirmedId = await confirmProfile(input);
      if (controller.signal.aborted || currentKey.current !== key) return;
      // Both requests begin after confirmation; neither awaits the other's result.
      void fetchChart(input, confirmedId);
      const res = await fetch("/api/reading", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, birthTime: input.timeConfidence === "unknown" ? undefined : input.birthTime, birthPlace: `${input.location.city}, ${input.location.nation}`, profileId: confirmedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(publicMessage(data?.error, 'Could not cast your reading. Please try again.'));
      if (controller.signal.aborted || currentKey.current !== key) return;
      setReading(data as ReadingWithChart);
      if (data.meta?.astrology?.usage) setUsage(data.meta.astrology.usage);
      if (isMobile) {
        setMobileDrawerOpen(false);
        setMobileReadingOpen(true);
      }
    } catch (err) {
      if (!controller.signal.aborted && currentKey.current === key) setError(publicMessage(err, "Could not cast your reading. Please try again."));
    } finally {
      if (readingRequest.current === controller && currentKey.current === key) setLoading(false);
      void refreshUsage();
    }
  }, [isMobile, confirmProfile, fetchChart, refreshUsage]);

  const enhanceChart = useCallback(async () => {
    if (!currentChart?.natal || birthInput.timeConfidence === 'unknown' || reading?.birthChart || loading || enhanceRequest.current) return;
    const controller = new AbortController();
    enhanceRequest.current = controller;
    const key = inputKey;
    setEnhancingChart(true); setEnhancementError(null);
    try {
      const response = await fetch('/api/reading/enhance', {
        method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextId: currentChart.id, ...(reading ? { reading } : {}) }),
      });
      const data = await response.json();
      if (!response.ok || !data.birthChart) throw new Error(publicMessage(data.error, 'Could not interpret your chart. Your existing reading is unchanged.'));
      if (controller.signal.aborted || currentKey.current !== key) return;
      // Replacing the payload triggers the existing audio hook's invalidation.
      setReading(data as ReadingWithChart);
      if (isMobile) setMobileReadingOpen(true);
    } catch (err) {
      if (!controller.signal.aborted && currentKey.current === key) setEnhancementError(publicMessage(err, 'Could not interpret your chart. Your existing reading is unchanged.'));
    } finally {
      if (enhanceRequest.current === controller) { enhanceRequest.current = null; if (currentKey.current === key) setEnhancingChart(false); }
    }
  }, [currentChart, birthInput.timeConfidence, reading, loading, inputKey, isMobile]);

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
      await downloadReadingPdf(reading, currentChart?.id);
    } catch (err) {
      setError(publicMessage(err, "Could not create PDF. Please try again."));
    } finally {
      setPdfLoading(false);
    }
  }, [reading, currentChart]);

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
      {view === "solar" && !(isMobile && mobileReadingOpen) && (
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

      <SceneViewControls view={view} onChange={next => { setView(next); setHoveredPlanet(null); setMobileReadingOpen(false); }} />
      {view === "chart" && <BirthChartView
        key={inputKey} context={currentChart} theme={theme} loading={chartLoading} error={chartError}
        timeConfidence={birthInput.timeConfidence} confirmed={Boolean(profileId)} hasReading={Boolean(reading)}
        enhanced={Boolean(reading?.birthChart)} onCalculate={() => void calculateChart()}
        onEditDetails={() => { if (isMobile) setMobileDrawerOpen(true); else document.querySelector<HTMLInputElement>('input[type="date"]')?.focus(); }}
        onEnhanceChart={loading ? undefined : () => void enhanceChart()} enhancingChart={enhancingChart} enhancementError={enhancementError}
      />}

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
          onEnhanceChart={() => void enhanceChart()} chartAvailable={Boolean(currentChart?.natal && birthInput.timeConfidence !== 'unknown')}
          chartLoading={chartLoading} enhancingChart={enhancingChart} enhancementError={enhancementError} chartConfidence={birthInput.timeConfidence}
        />
      </div>

      <div className="hidden md:block">
        {view === "solar" && <PlanetInfoBar snapshot={snapshot} signsById={signsById} label={skyDateLabel} />}
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
        onEnhanceChart={() => void enhanceChart()} chartAvailable={Boolean(currentChart?.natal && birthInput.timeConfidence !== 'unknown')}
        chartLoading={chartLoading} enhancingChart={enhancingChart} enhancementError={enhancementError} chartConfidence={birthInput.timeConfidence}
      />

      <PlanetTooltip planet={hoveredPlanet} sign={tooltipSign} />

      <HowItWorksModal
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
      />

      <AeonPreloader ready={sceneReady} theme={theme} onComplete={handlePreloaderComplete} />
      <QuickTour open={tourOpen} onClose={closeTour} />
      <VoiceExplorer profileId={profileId} contextId={currentChart?.id ?? reading?.birthChart?.contextId} onUsageRefresh={refreshUsage} open={voiceOpen} onOpen={() => setVoiceOpen(true)} onClose={() => setVoiceOpen(false)} reading={reading} viewedDate={skyDate} selectedPlanet={selectedPlanet?.id ?? null} onStart={() => { audio.stream.stop(); audio.pause(); }} />
    </main>
  );
}
