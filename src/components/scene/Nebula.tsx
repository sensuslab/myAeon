"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { ThemeMode } from "@/components/ui/types";

/**
 * Soft distant nebula — large translucent sprites that drift slowly in the
 * background to add color depth behind the planetary system.
 */
export default function Nebula({
  count = 6,
  radius = 80,
  theme,
}: {
  count?: number;
  radius?: number;
  theme: ThemeMode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.28, "rgba(255,255,255,0.38)");
    gradient.addColorStop(0.62, "rgba(255,255,255,0.08)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);

  const clouds = useMemo(() => {
    const palette =
      theme === "light"
        ? [
            { color: "#72b7c4", opacity: 0.08 },
            { color: "#e2b85e", opacity: 0.07 },
            { color: "#9eb0df", opacity: 0.06 },
            { color: "#f0b8a6", opacity: 0.05 },
          ]
        : [
            { color: "#7feaff", opacity: 0.06 },
            { color: "#d4a437", opacity: 0.05 },
            { color: "#c8b6ff", opacity: 0.06 },
            { color: "#ff8a8a", opacity: 0.04 },
          ];
    return Array.from({ length: count }).map((_, i) => {
      const theta = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const phi = Math.acos(2 * Math.random() - 1);
      return {
        pos: new THREE.Vector3(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.sin(phi) * Math.sin(theta) * 0.4,
          radius * Math.cos(phi)
        ),
        size: 30 + Math.random() * 35,
        ...palette[i % palette.length],
      };
    });
  }, [count, radius, theme]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.003;
    }
  });

  return (
    <group ref={groupRef}>
      {clouds.map((c, i) => (
        <sprite key={i} position={c.pos} scale={[c.size, c.size, 1]}>
          <spriteMaterial
            map={texture}
            color={c.color}
            opacity={c.opacity}
            transparent
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  );
}
