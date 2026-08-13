"use client";

import * as THREE from "three";
import { useMemo } from "react";

/**
 * Layered orbital ring — a crisp line plus a soft glow band on the XZ plane.
 */
export default function PlanetOrbit({ radius, color = "#ffffff", opacity = 0.12 }: {
  radius: number;
  color?: string;
  opacity?: number;
}) {
  const { coreGeometry, glowGeometry } = useMemo(() => {
    const coreWidth = Math.max(0.028, radius * 0.0028);
    const glowWidth = Math.max(0.14, radius * 0.012);
    return {
      coreGeometry: new THREE.RingGeometry(radius - coreWidth, radius + coreWidth, 192),
      glowGeometry: new THREE.RingGeometry(radius - glowWidth, radius + glowWidth, 192),
    };
  }, [radius]);

  return (
    <group rotation={[Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}>
      <mesh renderOrder={0}>
        <primitive object={glowGeometry} attach="geometry" />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={Math.min(opacity * 0.7, 0.24)}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh renderOrder={1}>
        <primitive object={coreGeometry} attach="geometry" />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={Math.min(opacity + 0.1, 0.62)}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
