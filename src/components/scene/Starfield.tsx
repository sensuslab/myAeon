"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { ThemeMode } from "@/components/ui/types";

/**
 * Twinkling procedural starfield — instanced points with per-star phase.
 * Spherical distribution so it surrounds the camera no matter which way
 * the user rotates.
 */
export default function Starfield({
  count = 3000,
  radius = 120,
  theme,
}: {
  count?: number;
  radius?: number;
  theme: ThemeMode;
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material } = useMemo(() => {
    const lightMode = theme === "light";
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);

    const palette = lightMode
      ? [
          new THREE.Color("#496a83"),
          new THREE.Color("#15788a"),
          new THREE.Color("#a66f1f"),
          new THREE.Color("#6f7fb2"),
          new THREE.Color("#7f8b96"),
        ]
      : [
          new THREE.Color("#ffffff"),
          new THREE.Color("#a8d8ff"),
          new THREE.Color("#ffd9a8"),
          new THREE.Color("#d4a437"),
          new THREE.Color("#c8b6ff"),
        ];

    for (let i = 0; i < count; i++) {
      // Uniform distribution on a sphere
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = radius * (0.85 + Math.random() * 0.3);
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      sizes[i] = Math.random() * (lightMode ? 0.55 : 0.7) + (lightMode ? 0.12 : 0.2);
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("phase", new THREE.BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAlpha: { value: lightMode ? 0.38 : 1 } },
      vertexShader: `
        attribute float size;
        attribute float phase;
        varying vec3 vColor;
        varying float vTwinkle;
        uniform float uTime;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float twinkle = 0.55 + 0.45 * sin(uTime * 1.2 + phase * 6.28);
          vTwinkle = twinkle;
          gl_PointSize = size * (320.0 / -mv.z) * twinkle;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vTwinkle;
        uniform float uAlpha;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor * vTwinkle, a * uAlpha);
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: lightMode ? THREE.NormalBlending : THREE.AdditiveBlending,
    });

    return { geometry: geo, material: mat };
  }, [count, radius, theme]);

  useFrame((state) => {
    if (material.uniforms.uTime) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
    }
    if (pointsRef.current) {
      // Very slow drift — gives the impression of cosmic motion
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.008;
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}
