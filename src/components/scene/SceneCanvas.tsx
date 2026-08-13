"use client";

import { Canvas } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useRef } from "react";
import Starfield from "./Starfield";
import Nebula from "./Nebula";
import SolarSystem from "./SolarSystem";
import type { CosmicSnapshot, PlanetVisual } from "@/lib/zodiac";
import type { ThemeMode } from "@/components/ui/types";

type Props = {
  snapshot: CosmicSnapshot;
  onPlanetHover: (planet: PlanetVisual | null) => void;
  onPlanetClick: (planet: PlanetVisual) => void;
  flat?: boolean;
  selectedPlanetId?: PlanetVisual["id"] | null;
  theme: ThemeMode;
  onReady?: () => void;
};

export default function SceneCanvas({
  snapshot,
  onPlanetHover,
  onPlanetClick,
  flat,
  selectedPlanetId,
  theme,
  onReady,
}: Props) {
  const lightMode = theme === "light";
  const sceneBg = lightMode ? "#eef6f9" : "#040414";
  const fogNear = lightMode ? 48 : 50;
  const fogFar = lightMode ? 132 : 140;

  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        camera={{ position: [0, 18, 38], fov: 55 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <color attach="background" args={[sceneBg]} />
        <fog attach="fog" args={[sceneBg, fogNear, fogFar]} />

        {/* Soft fill so dark sides remain readable without flattening the scene */}
        <ambientLight intensity={lightMode ? 0.64 : 0.34} color={lightMode ? "#cfe6ef" : "#4c5e86"} />
        <hemisphereLight
          args={[
            lightMode ? "#ffffff" : "#9fdcff",
            lightMode ? "#d5c5a0" : "#171126",
            lightMode ? 0.54 : 0.36,
          ]}
        />
        <directionalLight
          position={[12, 16, 20]}
          intensity={lightMode ? 0.72 : 0.55}
          color={lightMode ? "#fff7e3" : "#d7eaff"}
        />

        <Suspense fallback={null}>
          <Starfield theme={theme} />
          <Nebula theme={theme} />
          <SolarSystem
            snapshot={snapshot}
            onPlanetHover={onPlanetHover}
            onPlanetClick={onPlanetClick}
            flat={flat}
            selectedPlanetId={selectedPlanetId}
            theme={theme}
          />
          <CanvasReady onReady={onReady} />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={20}
          maxDistance={80}
          enableDamping
          dampingFactor={0.06}
          rotateSpeed={0.5}
          target={[0, 0, 0]}
          minPolarAngle={Math.PI * 0.1}
          maxPolarAngle={Math.PI * 0.85}
        />
      </Canvas>
    </div>
  );
}

function CanvasReady({ onReady }: { onReady?: () => void }) {
  const calledRef = useRef(false);

  useFrame(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    window.requestAnimationFrame(() => onReady?.());
  });

  return null;
}
