"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { CanvasTexture, DoubleSide, LinearFilter, SRGBColorSpace } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { ThemeMode } from "@/components/ui/types";

type Props = { svg: string; theme: ThemeMode; flat: boolean; reset: number; onReady?: () => void; onError?: () => void };

export default function BirthChartScene(props: Props) {
  return <Canvas orthographic camera={{ position: [0, 0, 10], zoom: 75, near: 0.1, far: 100 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} aria-label="Calculated birth chart wheel" style={{ touchAction: "none" }}>
    <ChartSurface {...props} />
  </Canvas>;
}

function ChartSurface({ svg, theme, flat, reset, onReady, onError }: Props) {
  const { gl, size, camera } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const [surface, setSurface] = useState<{ texture: CanvasTexture; ratio: number; svg: string } | null>(null);
  const ready = useRef(false);
  // Canvas readiness is independent of image loading, so the app cannot be held by an SVG.
  useFrame(() => {
    if (ready.current) return;
    ready.current = true;
    requestAnimationFrame(() => onReady?.());
  });

  useEffect(() => {
    let active = true;
    let texture: CanvasTexture | undefined;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      try {
        const ratio = image.naturalWidth / image.naturalHeight || 1;
        const renderedPixels = Math.max(size.width, size.height) * Math.min(gl.getPixelRatio(), 2) * 2;
        const maxSize = Math.min(2048, gl.capabilities.maxTextureSize, Math.max(1024, 2 ** Math.ceil(Math.log2(renderedPixels))));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(ratio >= 1 ? maxSize : maxSize * ratio);
        canvas.height = Math.round(ratio >= 1 ? maxSize / ratio : maxSize);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
        texture.minFilter = LinearFilter;
        setSurface({ texture, ratio, svg });
      } catch { onError?.(); }
    };
    image.onerror = () => { if (active) onError?.(); };
    // Server-generated SVG is isolated in an image, never inserted into the page DOM.
    image.src = url;
    return () => { active = false; image.onload = null; image.onerror = null; URL.revokeObjectURL(url); texture?.dispose(); };
  }, [svg, theme, gl, size.width, size.height, onError]);

  useEffect(() => {
    controls.current?.reset();
    camera.position.set(0, 0, 10);
    camera.zoom = 75;
    camera.updateProjectionMatrix();
    controls.current?.update();
  }, [camera, reset, flat, svg]);

  const ratio = surface?.ratio ?? 1;
  const width = Math.min(size.width / 75 * 0.96, size.height / 75 * 0.96 * ratio);
  return <>
    {surface?.svg === svg && <mesh rotation={flat ? [0, 0, 0] : [-0.28, 0.08, 0]}>
      <planeGeometry args={[width, width / ratio]} />
      <meshBasicMaterial map={surface.texture} side={DoubleSide} toneMapped={false} transparent />
    </mesh>}
    <OrbitControls ref={controls} enableRotate={!flat} enableZoom enablePan minZoom={40} maxZoom={400} enableDamping dampingFactor={0.08} />
  </>;
}
