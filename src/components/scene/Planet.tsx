"use client";

import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { PlanetVisual } from "@/lib/zodiac";
import type { ThemeMode } from "@/components/ui/types";

type Props = {
  planet: PlanetVisual;
  angleRad: number;
  onHover: (planet: PlanetVisual | null, position?: THREE.Vector3) => void;
  onClick: (planet: PlanetVisual) => void;
  flat?: boolean;
  selected?: boolean;
  theme: ThemeMode;
  label: string;
};

type LabelViewport = "visible" | "edge" | "offscreen";

/**
 * A single planet — sphere placed at the orbital angle on the XZ plane.
 * Includes a subtle axis tilt and self-rotation.
 *
 * `flat=true` squashes the position onto the camera plane so the solar
 * system reads as a 2D map (used by the "Flat / 3D" toggle).
 */
export default function Planet({ planet, angleRad, onHover, onClick, flat, selected, theme, label }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const projectedRef = useRef(new THREE.Vector3());
  const labelViewportRef = useRef<LabelViewport>("visible");
  const [hovered, setHovered] = useState(false);
  const [labelViewport, setLabelViewport] = useState<LabelViewport>("visible");
  const { camera, size } = useThree();
  const active = hovered || selected;
  const lightMode = theme === "light";

  const x = Math.cos(angleRad) * planet.orbitRadius;
  const z = Math.sin(angleRad) * planet.orbitRadius;
  const y = flat ? 0 : Math.sin(angleRad * 0.5) * 0.3;

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.4;
    }
    // tiny orbit bob for life
    if (groupRef.current && !flat) {
      const t = state.clock.elapsedTime;
      groupRef.current.position.y = y + Math.sin(t + angleRad) * 0.05;
    }
    if (groupRef.current) {
      groupRef.current.getWorldPosition(projectedRef.current);
      projectedRef.current.project(camera);

      const x = Math.abs(projectedRef.current.x);
      const screenY = Math.abs(projectedRef.current.y);
      const mobile = size.width <= 560;
      const edgeX = mobile ? 0.72 : 0.82;
      const edgeY = mobile ? 0.78 : 0.86;
      const hiddenX = mobile ? 0.94 : 1.02;
      const hiddenY = mobile ? 0.98 : 1.05;
      const nextViewport: LabelViewport =
        x > hiddenX || screenY > hiddenY ? "offscreen" : x > edgeX || screenY > edgeY ? "edge" : "visible";

      if (labelViewportRef.current !== nextViewport) {
        labelViewportRef.current = nextViewport;
        setLabelViewport(nextViewport);
      }
    }
  });

  return (
    <group ref={groupRef} position={[x, y, z]}>
      <pointLight
        color={planet.color}
        intensity={selected ? 0.65 : hovered ? 0.48 : lightMode ? 0.28 : 0.18}
        distance={planet.size * 7 + 2.5}
        decay={2}
      />

      <mesh scale={active ? 1.95 : 1.7}>
        <sphereGeometry args={[planet.size, 32, 32]} />
        <meshBasicMaterial
          color={planet.color}
          transparent
          opacity={selected ? 0.32 : hovered ? 0.26 : lightMode ? 0.18 : 0.13}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
          onHover(planet, groupRef.current?.position);
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "default";
          onHover(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(planet);
        }}
      >
        <sphereGeometry args={[planet.size, 48, 48]} />
        <meshStandardMaterial
          color={planet.color}
          emissive={active ? planet.color : planet.emissive}
          emissiveIntensity={selected ? 0.78 : hovered ? 0.62 : lightMode ? 0.42 : 0.34}
          roughness={0.55}
          metalness={0.08}
          toneMapped={false}
        />
      </mesh>

      {/* Saturn-like ring: handled here if the planet id matches */}
      {planet.id === "saturn" && <SaturnRing radius={planet.size} />}

      {/* Focus ring */}
      {active && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[planet.size * 1.75, planet.size * 2.08, 96]} />
          <meshBasicMaterial
            color={planet.color}
            transparent
            opacity={selected ? 0.68 : 0.42}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      <Html
        center
        position={[0, planet.size * 2.45 + 0.35, 0]}
        distanceFactor={32}
        zIndexRange={[12, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div
          className={`planet-scene-label planet-scene-label-${labelViewport} ${
            active ? "planet-scene-label-active" : ""
          }`}
        >
          <span
            className="planet-scene-label-dot"
            style={{ background: planet.color, boxShadow: `0 0 10px ${planet.color}` }}
          />
          <span className="planet-scene-label-name">{planet.name}</span>
          <span className="planet-scene-label-position">{label}</span>
        </div>
      </Html>
    </group>
  );
}

function SaturnRing({ radius }: { radius: number }) {
  const geometry = new THREE.RingGeometry(radius * 1.4, radius * 2.2, 64);
  return (
    <mesh rotation={[Math.PI / 2 - 0.4, 0, 0]}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial color="#e0c896" transparent opacity={0.55} side={THREE.DoubleSide} />
    </mesh>
  );
}
