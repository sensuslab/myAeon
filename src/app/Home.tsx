"use client";

import BirthDetailsForm from "@/components/ui/BirthDetailsForm";
import AeonPreloader from "@/components/ui/AeonPreloader";
import AlphaDisclaimer from "@/components/ui/AlphaDisclaimer";
import WelcomeScreen from "@/components/ui/WelcomeScreen";
import Modal from "@/components/ui/Modal";
import { PLANETS, getSunSign } from "@/lib/zodiac";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppHeader from "@/components/ui/AppHeader";
import { type BirthInput } from "@/components/ui/ControlPanel";
import {
  initialBirthInput,
  londonToday,
  birthProfile,
  profileFingerprint,
  readingFingerprint,
} from "@/components/ui/BirthDetailsForm";
import type { AstrologyUsage } from "@/lib/astrologyTypes";
import ReadingPanel from "@/components/ui/ReadingPanel";
import PlanetTooltip from "@/components/ui/PlanetTooltip";
import HowItWorksModal from "@/components/ui/HowItWorksModal";
import QuickTour from "@/components/ui/QuickTour";
import { useNatalProfile } from "@/components/ui/useNatalProfile";
import BirthChartView from "@/components/ui/BirthChartView";
import {
  publicMessage,
  type ChartContext,
  type ReadingWithChart,
} from "@/components/ui/chartPresentation";
import type { ThemeMode, ZeusSource, ZeusReadingFocus } from "@/components/ui/types";
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
const VoiceExplorer = dynamic(() => import("@/components/ui/VoiceExplorer"), {
  ssr: false,
});

function todayInputValue() {
  return londonToday();
}

function dateFromInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  const noon = new Date(`${value}T12:00:00Z`);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(noon),
  );
  return new Date(+noon - (hour - 12) * 3600000);
}

function formatSkyDate(value: string) {
  const today = todayInputValue();
  if (value === today) return "Today · noon London";
  return dateFromInput(value).toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    month: "short",
    day: "numeric",
  });
}

export default function Home({ initialDate }: { initialDate: string }) {
  const [birthInput, setBirthInput] = useState(() => ({
    ...initialBirthInput(),
    readingDate: initialDate,
  }));
  const [selectedFeature, setSelectedFeature] = useState<{
    name: string;
    frame: "natal" | "transit";
    date: string;
  } | null>(null);
  const [welcome, setWelcome] = useState(true);
  const [workspace, setWorkspace] = useState<"solar" | "chart" | "reading">(
    "solar",
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [exploring, setExploring] = useState(false);
  const [resetCamera, setResetCamera] = useState(0);
  const readingChart = useRef<string>();
  const [confirmedProfile, setConfirmedProfile] = useState<{
    id: string;
    fingerprint: string;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [usage, setUsage] = useState<AstrologyUsage | null>(null);
  const [enrichmentEnabled, setEnrichmentEnabled] = useState(false);
  const [chart, setChart] = useState<{
    key: string;
    context: ChartContext;
  } | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [enhancingChart, setEnhancingChart] = useState(false);
  const [enhancementError, setEnhancementError] = useState<string | null>(null);
  const fingerprint = profileFingerprint(birthInput);
  const inputKey = readingFingerprint(birthInput);
  const currentKey = useRef(inputKey);
  currentKey.current = inputKey;
  const latestInput = useRef(birthInput);
  latestInput.current = birthInput;
  const chartRequest = useRef<AbortController | null>(null);
  const readingRequest = useRef<AbortController | null>(null);
  const enhanceRequest = useRef<AbortController | null>(null);
  const currentChart = chart?.key === inputKey ? chart.context : null;
  const natalProfile = useNatalProfile(fingerprint, currentChart?.id);
  const profileId =
    confirmedProfile?.fingerprint === fingerprint
      ? confirmedProfile.id
      : undefined;
  const refreshUsage = useCallback(async () => {
    try {
      const response = await fetch("/api/astrology/profile");
      const data = await response.json();
      setUsage(data.usage || null);
      setEnrichmentEnabled(Boolean(data.enabled));
    } catch {
      setEnrichmentEnabled(false);
    }
  }, []);
  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);
  const confirmProfile = useCallback(
    async (input: BirthInput, force = false) => {
      if (!input.confirmed)
        throw new Error("Confirm permission to use these birth details first.");
      if (!force && confirmedProfile?.fingerprint === profileFingerprint(input))
        return confirmedProfile.id;
      const response = await fetch("/api/astrology/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(birthProfile(input)),
      });
      const data = await response.json();
      if (!response.ok || typeof data.profileId !== "string")
        throw new Error(
          publicMessage(
            data.error,
            "Could not confirm birth details. Please try again.",
          ),
        );
      if (
        profileFingerprint(latestInput.current) === profileFingerprint(input)
      ) {
        setConfirmedProfile({
          id: data.profileId,
          fingerprint: profileFingerprint(input),
        });
        setProfileStatus(
          "Birth details confirmed. Your chart is calculated when requested.",
        );
      }
      return data.profileId as string;
    },
    [confirmedProfile],
  );
  const handleConfirm = useCallback(
    async (input: BirthInput) => {
      setConfirming(true);
      setProfileStatus(null);
      try {
        await confirmProfile(input);
      } catch (err) {
        setProfileStatus(
          publicMessage(
            err,
            "Could not confirm birth details. Please try again.",
          ),
        );
      } finally {
        setConfirming(false);
      }
    },
    [confirmProfile],
  );
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sign, setSign] = useState<ZodiacSign | null>(null);
  const [reading, setReading] = useState<ReadingWithChart | null>(null);
  const audio = useReadingAudio(reading);
  const [hoveredPlanet, setHoveredPlanet] = useState<PlanetVisual | null>(null);
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetVisual | null>(
    null,
  );
  const [flat, setFlat] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [themeReady, setThemeReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [alphaAcknowledged, setAlphaAcknowledged] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [zeusSource, setZeusSource] = useState<ZeusSource>("welcome");
  const [zeusReadingFocus, setZeusReadingFocus] = useState<ZeusReadingFocus | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const acknowledgeAlpha = useCallback(() => {
    setAlphaAcknowledged(true);
    let tourSeen = false;
    try {
      tourSeen = window.localStorage.getItem("aeon-walkthrough-chart-v3") === "seen";
    } catch {}
    setTourOpen(!tourSeen);
  }, []);
  const openTour = useCallback(() => {
    setVoiceOpen(false);
    setHowItWorksOpen(false);
    setTourOpen(true);
  }, []);
  const closeTour = useCallback(() => {
    setTourOpen(false);
    try {
      window.localStorage.setItem("aeon-walkthrough-chart-v3", "seen");
    } catch {}
  }, []);
  useEffect(() => {
    const update = () =>
      document.documentElement.style.setProperty(
        "--visible-height",
        `${window.visualViewport?.height ?? window.innerHeight}px`,
      );
    update();
    window.visualViewport?.addEventListener("resize", update);
    return () => window.visualViewport?.removeEventListener("resize", update);
  }, []);
  const skyDate = birthInput.readingDate;
  const changeBirthInput = useCallback((input: BirthInput) => {
    const nextKey = readingFingerprint(input);
    if (nextKey !== currentKey.current) {
      currentKey.current = nextKey;
      chartRequest.current?.abort();
      readingRequest.current?.abort();
      enhanceRequest.current?.abort();
      enhanceRequest.current = null;
      setChart(null);
      setSelectedFeature(null);
      setChartError(null);
      setChartLoading(false);
      setEnhancingChart(false);
      setEnhancementError(null);
      setLoading(false);
      setError(null);
    }
    latestInput.current = input;
    setBirthInput(input);
    setProfileStatus(null);
  }, []);

  useEffect(
    () => () => {
      chartRequest.current?.abort();
      readingRequest.current?.abort();
      enhanceRequest.current?.abort();
    },
    [],
  );

  const fetchChart = useCallback(
    async (input: BirthInput, confirmedId: string, force = false) => {
      const key = readingFingerprint(input);
      if (currentKey.current !== key || (!force && chart?.key === key)) return;
      chartRequest.current?.abort();
      const controller = new AbortController();
      chartRequest.current = controller;
      setChartLoading(true);
      setChartError(null);
      try {
        const response = await fetch("/api/astrology/chart", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId: confirmedId,
            readingDate: input.readingDate,
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.context?.id)
          throw new Error(
            publicMessage(
              data.error,
              "Could not calculate your chart. Your reading remains available.",
            ),
          );
        if (!controller.signal.aborted && currentKey.current === key) {
          setChart({ key, context: data.context as ChartContext });
          readingChart.current = data.context.id;
        }
      } catch (err) {
        if (!controller.signal.aborted && currentKey.current === key)
          setChartError(
            publicMessage(
              err,
              "Could not calculate your chart. Your reading remains available.",
            ),
          );
      } finally {
        if (chartRequest.current === controller && currentKey.current === key)
          setChartLoading(false);
      }
    },
    [chart],
  );

  const calculateChart = useCallback(async () => {
    const input = latestInput.current;
    setChartError(null);
    setChartLoading(true);
    try {
      const id = await confirmProfile(input, true);
      await fetchChart(input, id, true);
    } catch (err) {
      if (latestInput.current === input)
        setChartError(
          publicMessage(
            err,
            "Could not calculate your chart. Please try again.",
          ),
        );
    } finally {
      if (latestInput.current === input) setChartLoading(false);
    }
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
      setCurrentTime(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(now),
      );
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

    const themeMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    themeMeta?.setAttribute(
      "content",
      theme === "light" ? "#eef6f9" : "#050616",
    );
  }, [theme, themeReady]);

  const fetchReading = useCallback(
    async (input: BirthInput, s: ZodiacSign) => {
      readingRequest.current?.abort();
      enhanceRequest.current?.abort();
      enhanceRequest.current = null;
      const controller = new AbortController();
      readingRequest.current = controller;
      const key = readingFingerprint(input);
      setEnhancingChart(false);
      setEnhancementError(null);
      setSign(s);
      setError(null);
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
          body: JSON.stringify({
            ...input,
            birthTime:
              input.timeConfidence === "unknown" ? undefined : input.birthTime,
            birthPlace: `${input.location.city}, ${input.location.nation}`,
            profileId: confirmedId,
          }),
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(
            publicMessage(
              data?.error,
              "Could not cast your reading. Please try again.",
            ),
          );
        if (controller.signal.aborted || currentKey.current !== key) return;
        setReading(data as ReadingWithChart);
        setWorkspace("reading");
        setDetailsOpen(false);
        setWelcome(false);
        readingChart.current =
          data.birthChart?.contextId ?? data.meta?.astrology?.contextId ??
          (chart?.key === key ? chart.context.id : readingChart.current);
        if (data.meta?.astrology?.usage) setUsage(data.meta.astrology.usage);
      } catch (err) {
        if (!controller.signal.aborted && currentKey.current === key)
          setError(
            publicMessage(
              err,
              "Could not cast your reading. Please try again.",
            ),
          );
      } finally {
        if (readingRequest.current === controller && currentKey.current === key)
          setLoading(false);
        void refreshUsage();
      }
    },
    [isMobile, confirmProfile, fetchChart, refreshUsage],
  );

  const enhanceChart = useCallback(async () => {
    if (
      (reading && reading.meta?.readingDate !== skyDate) ||
      !currentChart?.natal ||
      birthInput.timeConfidence === "unknown" ||
      reading?.birthChart ||
      loading ||
      enhanceRequest.current
    )
      return;
    const controller = new AbortController();
    enhanceRequest.current = controller;
    const key = inputKey;
    setEnhancingChart(true);
    setEnhancementError(null);
    try {
      const response = await fetch("/api/reading/enhance", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: birthInput.mode ?? "today",
          contextId: currentChart.id,
          ...(reading ? { reading } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.birthChart)
        throw new Error(
          publicMessage(
            data.error,
            "Could not interpret your chart. Your existing reading is unchanged.",
          ),
        );
      if (controller.signal.aborted || currentKey.current !== key) return;
      // Replacing the payload triggers the existing audio hook's invalidation.
      setReading(data as ReadingWithChart);
      setWorkspace("reading");
    } catch (err) {
      if (!controller.signal.aborted && currentKey.current === key)
        setEnhancementError(
          publicMessage(
            err,
            "Could not interpret your chart. Your existing reading is unchanged.",
          ),
        );
    } finally {
      if (enhanceRequest.current === controller) {
        enhanceRequest.current = null;
        if (currentKey.current === key) setEnhancingChart(false);
      }
    }
  }, [
    currentChart,
    birthInput.timeConfidence,
    reading,
    loading,
    inputKey,
    isMobile,
  ]);

  const handlePlanetClick = useCallback((p: PlanetVisual) => {
    setSelectedFeature(null);
    setSelectedPlanet(p);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const handleDownloadPdf = useCallback(async (includeCharts?: boolean) => {
    if (!reading) return;
    setPdfLoading(true);
    setError(null);
    try {
      await downloadReadingPdf(
        reading,
        reading.birthChart?.contextId ?? readingChart.current,
        includeCharts,
      );
    } catch (err) {
      setError(publicMessage(err, "Could not create PDF. Please try again."));
    } finally {
      setPdfLoading(false);
    }
  }, [reading, currentChart]);

  const tooltipSign = hoveredPlanet
    ? (signsById[hoveredPlanet.id]?.name ?? null)
    : null;
  const selectedPlanetPosition = selectedPlanet
    ? (snapshot.planets.find((p) => p.id === selectedPlanet.id) ?? null)
    : null;
  const selectedPlanetSign = selectedPlanet
    ? (signsById[selectedPlanet.id] ?? null)
    : null;
  const selectedPlanetDegree = selectedPlanetPosition
    ? Math.floor(selectedPlanetPosition.longitude % 30)
    : null;

  const openZeus = (source: ZeusSource, focus: ZeusReadingFocus | null = null) => {
    setZeusSource(source);
    setZeusReadingFocus(focus);
    setWelcome(false);
    setDetailsOpen(false);
    setExploring(false);
    setVoiceOpen(true);
  };
  const navigate = (next: "solar" | "chart" | "reading" | "zeus") => {
    if (next === "zeus") {
      openZeus(welcome ? "welcome" : workspace);
      return;
    }
    setWelcome(false);
    setDetailsOpen(false);
    setVoiceOpen(false);
    setExploring(false);
    setWorkspace(next);
  };
  const blocked =
    !introComplete || !alphaAcknowledged || welcome || detailsOpen || voiceOpen || tourOpen || howItWorksOpen;
  return (
    <main
      data-theme={theme}
      data-workspace={workspace}
      data-welcome={welcome}
      className="aeon-shell"
    >
      <div
        className="aeon-background"
        ref={(element) => {
          if (element) element.inert = blocked;
        }}
        data-blocked={blocked}
        aria-hidden={blocked || undefined}
      >
        {(workspace !== "chart" || welcome) && (
          <SceneCanvas
            snapshot={snapshot}
            onPlanetHover={setHoveredPlanet}
            onPlanetClick={handlePlanetClick}
            flat={flat}
            selectedPlanetId={selectedPlanet?.id ?? null}
            theme={theme}
            enabled={exploring && !blocked}
            reset={resetCamera}
          />
        )}
      </div>
      <div
        className="aeon-workspace"
        ref={(element) => {
          if (element) element.inert = blocked;
        }}
        data-blocked={blocked}
      >
        <AppHeader
          sunSign={sign ? { name: sign.name, symbol: sign.glyph } : null}
          currentTime={currentTime}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenTour={openTour}
        />
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">
              {workspace === "solar"
                ? "THE OBSERVATORY"
                : workspace === "chart"
                  ? "YOUR CELESTIAL PATTERN"
                  : reading?.mode === "today"
                    ? "TODAY · QUICK READING"
                    : "YOUR READING"}
            </p>
            <h1>
              {workspace === "solar"
                ? "A wider perspective"
                : workspace === "chart"
                  ? "Your birth chart"
                  : reading?.greeting || "A moment of clarity"}
            </h1>
          </div>
          <button onClick={() => setDetailsOpen(true)}>
            Birth details <span aria-hidden>↗</span>
          </button>
        </div>
        {workspace === "solar" && (
          <>
            <div className="explore-controls">
              <button
                aria-pressed={exploring}
                onClick={() => setExploring((v) => !v)}
              >
                {exploring ? "Lock view" : "Unlock view"}
              </button>
              <button
                onClick={() => {
                  setSelectedPlanet(null);
                  setResetCamera((v) => v + 1);
                }}
              >
                Reset
              </button>
              <button aria-pressed={flat} onClick={() => setFlat((v) => !v)}>
                {flat ? "Perspective" : "Top down"}
              </button>
              <label>
                Sky date
                <input
                  aria-label="Preview sky date"
                  type="date"
                  min="1900-01-01"
                  max="2100-12-01"
                  value={skyDate}
                  onChange={(e) => {
                    if (e.target.value)
                      changeBirthInput({
                        ...birthInput,
                        readingDate: e.target.value,
                      });
                  }}
                />
              </label>
              <button
                aria-label="Previous sky day"
                onClick={() => {
                  const d = new Date(`${skyDate}T12:00:00Z`);
                  d.setUTCDate(d.getUTCDate() - 1);
                  changeBirthInput({
                    ...birthInput,
                    readingDate: d.toISOString().slice(0, 10),
                  });
                }}
              >
                ←
              </button>
              <button
                onClick={() =>
                  changeBirthInput({
                    ...birthInput,
                    readingDate: londonToday(),
                  })
                }
              >
                Today
              </button>
              <button
                aria-label="Next sky day"
                onClick={() => {
                  const d = new Date(`${skyDate}T12:00:00Z`);
                  d.setUTCDate(d.getUTCDate() + 1);
                  changeBirthInput({
                    ...birthInput,
                    readingDate: d.toISOString().slice(0, 10),
                  });
                }}
              >
                →
              </button>
              <span>{skyDateLabel} · heliocentric · illustrative scale</span>
            </div>
            <div className="planet-selector" aria-label="Select a planet">
              {PLANETS.map((planet) => (
                <button
                  key={planet.id}
                  aria-pressed={selectedPlanet?.id === planet.id}
                  onClick={() => {
                    setSelectedFeature(null);
                    setSelectedPlanet(planet);
                  }}
                  style={{
                    borderColor:
                      selectedPlanet?.id === planet.id
                        ? planet.color
                        : undefined,
                  }}
                >
                  {planet.name}
                </button>
              ))}
            </div>
            {selectedPlanet && (
              <aside className="focus-inspector">
                <button
                  className="focus-close"
                  aria-label="Close planet focus"
                  onClick={() => setSelectedPlanet(null)}
                >
                  ✕
                </button>
                <p className="eyebrow">PLANET IN FOCUS</p>
                <h2>{selectedPlanet.name}</h2>
                <p>{selectedPlanet.archetype}</p>
                <p className="text-xs opacity-60">
                  {selectedPlanetSign?.name} · {selectedPlanetDegree}° ·
                  heliocentric visual
                </p>
                <button onClick={() => navigate("zeus")}>
                  Explore this with Zeus
                </button>
              </aside>
            )}
          </>
        )}
        {workspace === "chart" && (
          <BirthChartView
            key={inputKey}
            context={currentChart}
            natalProfile={natalProfile}
            theme={theme}
            loading={chartLoading}
            error={chartError}
            timeConfidence={birthInput.timeConfidence}
            confirmed={Boolean(profileId)}
            hasReading={Boolean(reading)}
            enhanced={Boolean(reading?.birthChart)}
            onCalculate={() => void calculateChart()}
            onEditDetails={() => setDetailsOpen(true)}
            onEnhanceChart={
              loading || (reading && reading.meta?.readingDate !== skyDate)
                ? undefined
                : () => void enhanceChart()
            }
            enhancingChart={enhancingChart}
            enhancementError={enhancementError}
            onExplain={(name, frame) => {
              setSelectedFeature({ name, frame, date: skyDate });
              setSelectedPlanet(PLANETS.find((p) => p.name === name) ?? null);
              navigate("zeus");
            }}
          />
        )}
        {workspace === "reading" && (
          <div className="reading-workspace">
            {!reading && !loading && (
              <div className="reading-start">
                <p>
                  A focused reflection for today, or a longer journey through
                  the coming month.
                </p>
                <button
                  onClick={() => {
                    changeBirthInput({ ...birthInput, mode: "today" });
                    setDetailsOpen(true);
                  }}
                >
                  Read today
                </button>
              </div>
            )}
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
              onAskZeus={(focus) => openZeus("reading", focus)}
              onEnhanceChart={() => void enhanceChart()}
              chartAvailable={Boolean(
                currentChart?.natal &&
                birthInput.timeConfidence !== "unknown" &&
                reading?.meta?.readingDate === skyDate,
              )}
              chartLoading={chartLoading}
              enhancingChart={enhancingChart}
              enhancementError={enhancementError}
              chartConfidence={birthInput.timeConfidence}
            />
          </div>
        )}
        <nav className="workspace-nav" aria-label="Main workspaces">
          <button
            onClick={() => {
              audio.stream.stop();
              audio.pause();
              setWelcome(true);
            }}
            aria-label="Welcome screen"
          >
            Home
          </button>
          {(["solar", "chart", "reading", "zeus"] as const).map((item) => (
            <button
              key={item}
              aria-current={
                !voiceOpen && workspace === item ? "page" : undefined
              }
              onClick={() => navigate(item)}
            >
              {item === "zeus" && (
                <img src={`/zeus/${theme}.png`} alt="" width={28} height={28} />
              )}
              {
                {
                  solar: "Explore",
                  chart: "Birth chart",
                  reading: "Reading",
                  zeus: "Zeus",
                }[item]
              }
            </button>
          ))}
        </nav>
        <PlanetTooltip planet={hoveredPlanet} sign={tooltipSign} />
      </div>
      <AeonPreloader ready={themeReady} onComplete={() => setIntroComplete(true)} />
      {introComplete && !alphaAcknowledged && <AlphaDisclaimer onContinue={acknowledgeAlpha} />}
      {welcome && introComplete && alphaAcknowledged && (
        <WelcomeScreen
          theme={theme}
          onToggleTheme={toggleTheme}
          onStart={(mode) => {
            changeBirthInput({
              ...birthInput,
              mode,
              readingDate: londonToday(),
            });
            setWelcome(false);
            setDetailsOpen(true);
          }}
          onExplore={() => navigate("solar")}
          onZeus={() => navigate("zeus")}
        />
      )}
      {detailsOpen && (
        <Modal
          title="Your reading begins here"
          onClose={() => setDetailsOpen(false)}
        >
          <BirthDetailsForm
            input={birthInput}
            onChange={changeBirthInput}
            onSubmit={fetchReading}
            onConfirm={handleConfirm}
            loading={loading}
            confirming={confirming}
            profileConfirmed={Boolean(profileId)}
            status={profileStatus}
            usage={usage}
            enrichmentEnabled={enrichmentEnabled}
          />
          {error && <p role="alert">{error}</p>}
        </Modal>
      )}
      <HowItWorksModal
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
      />
      <QuickTour open={introComplete && alphaAcknowledged && tourOpen} onClose={closeTour} />
      <VoiceExplorer
        source={zeusSource}
        readingFocus={zeusReadingFocus}
        selectedFeature={zeusSource === "chart" ? selectedFeature : null}
        theme={theme}
        profileId={zeusSource === "reading" ? reading?.meta?.profileId : profileId}
        contextId={zeusSource === "reading" ? reading?.birthChart?.contextId ?? reading?.meta?.astrology?.contextId ?? readingChart.current : currentChart?.id}
        onUsageRefresh={refreshUsage}
        open={voiceOpen}
        onOpen={() => navigate("zeus")}
        onClose={() => setVoiceOpen(false)}
        reading={reading}
        viewedDate={zeusSource === "reading" ? reading?.meta?.readingDate ?? skyDate : skyDate}
        selectedPlanet={zeusSource === "solar" ? selectedPlanet?.id ?? null : null}
        onStart={() => {
          audio.stream.stop();
          audio.pause();
        }}
      />
    </main>
  );
}
