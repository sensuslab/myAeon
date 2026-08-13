"use client";

import { useMemo } from "react";
import * as THREE from "three";
import Sun from "./Sun";
import Planet from "./Planet";
import PlanetOrbit from "./PlanetOrbit";
import type { CosmicSnapshot, PlanetVisual } from "@/lib/zodiac";
import { PLANETS, longitudeToSign } from "@/lib/zodiac";
import type { ThemeMode } from "@/components/ui/types";

type Props = {
  snapshot: CosmicSnapshot;
  onPlanetHover: (planet: PlanetVisual | null, screenPos?: { x: number; y: number }) => void;
  onPlanetClick: (planet: PlanetVisual) => void;
  flat?: boolean;
  selectedPlanetId?: PlanetVisual["id"] | null;
  theme: ThemeMode;
};

/**
 * Top-level 3D planetary system. Sun + planets + orbital rings, lit by the
 * Sun's own point light.
 */
export default function SolarSystem({
  snapshot,
  onPlanetHover,
  onPlanetClick,
  flat,
  selectedPlanetId,
  theme,
}: Props) {
  const planetById = useMemo(() => {
    const m = new Map<string, PlanetVisual>();
    PLANETS.forEach((p) => m.set(p.id, p));
    return m;
  }, []);

  return (
    <group>
      <Sun theme={theme} />
      {snapshot.planets.map((pos) => {
        const planet = planetById.get(pos.id);
        if (!planet) return null;
        const selected = selectedPlanetId === planet.id;
        const sign = longitudeToSign(pos.longitude);
        const degree = Math.floor(pos.longitude % 30);
        return (
          <group key={pos.id}>
            <PlanetOrbit
              radius={planet.orbitRadius}
              color={selected ? planet.color : theme === "light" ? "#496f87" : "#a8b3d9"}
              opacity={selected ? 0.48 : theme === "light" ? 0.34 : 0.27}
            />
            <Planet
              planet={planet}
              angleRad={pos.angleRad}
              onHover={(p) => onPlanetHover(p)}
              onClick={onPlanetClick}
              flat={flat}
              selected={selected}
              theme={theme}
              label={`${sign.symbol} ${degree}°`}
            />
          </group>
        );
      })}
    </group>
  );
}
