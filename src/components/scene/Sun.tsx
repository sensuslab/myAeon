"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { ThemeMode } from "@/components/ui/types";

/**
 * Emissive Sun at the origin — casts the only meaningful light in the scene
 * so the planets have dramatic shadow side / lit side.
 */
export default function Sun({ theme }: { theme: ThemeMode }) {
  const ref = useRef<THREE.Mesh>(null);
  const coronaRef = useRef<THREE.Mesh>(null);
  const lightMode = theme === "light";

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
    if (coronaRef.current) {
      const t = state.clock.elapsedTime;
      const s = 1 + Math.sin(t * 0.7) * 0.04;
      coronaRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group>
      {/* Corona — soft glow halo */}
      <mesh ref={coronaRef}>
        <sphereGeometry args={[2.3, 32, 32]} />
        <meshBasicMaterial color="#f6c64a" transparent opacity={lightMode ? 0.24 : 0.18} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.0, 32, 32]} />
        <meshBasicMaterial color="#f6a23a" transparent opacity={lightMode ? 0.32 : 0.25} depthWrite={false} />
      </mesh>
      {/* Sun body */}
      <mesh ref={ref}>
        <sphereGeometry args={[1.4, 64, 64]} />
        <meshStandardMaterial
          color="#fbd86b"
          emissive="#f6c64a"
          emissiveIntensity={2.5}
          roughness={0.4}
          metalness={0.1}
          toneMapped={false}
        />
      </mesh>
      {/* The actual point light source */}
      <pointLight color="#fde9b0" intensity={lightMode ? 3.4 : 3.0} distance={120} decay={1.2} castShadow={false} />
    </group>
  );
}
