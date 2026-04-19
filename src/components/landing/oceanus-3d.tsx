"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Float, useGLTF } from "@react-three/drei";
import {
  useMotionValue,
  useSpring,
  useScroll,
  useTransform,
  motion,
  AnimatePresence,
} from "motion/react";
import * as THREE from "three";
import { TiberiusBust } from "./tiberius-bust";

const MODEL_URL = "/3d-models/oceanus.glb";

// Preload aggressively so the statue arrives at the same time as the hero.
useGLTF.preload(MODEL_URL);

export function Oceanus3D({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // Normalized pointer (-1..1) over the 3D surface.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const pxSpring = useSpring(px, { stiffness: 80, damping: 18, mass: 0.6 });
  const pySpring = useSpring(py, { stiffness: 80, damping: 18, mass: 0.6 });

  // Scroll progress 0..1 while the hero is on screen.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  const scrollSpring = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 20,
  });

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    px.set(((e.clientX - r.left) / r.width) * 2 - 1);
    py.set(((e.clientY - r.top) / r.height) * 2 - 1);
  }
  function onMouseLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={"relative " + (className ?? "")}
      aria-hidden
    >
      {/* Pulsing aura backplate */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
        animate={{
          scale: [0.9, 1.05, 0.9],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="h-[70%] w-[70%] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, oklch(0.7 0.19 285 / 0.55), transparent 65%)",
          }}
        />
      </motion.div>

      {/* Slow-moving second aura for depth */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        <div
          className="h-[80%] w-[80%] rounded-full blur-2xl opacity-40"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, oklch(0.78 0.14 325 / 0.45) 60deg, transparent 120deg, oklch(0.7 0.19 285 / 0.5) 240deg, transparent 300deg)",
          }}
        />
      </motion.div>

      {/* ASCII fallback — visible until the GLB loads in, then fades out */}
      <AnimatePresence>
        {!ready && (
          <motion.div
            key="ascii"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-10 flex items-center justify-center"
          >
            <TiberiusBust className="w-full" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D canvas */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: ready ? 1 : 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative h-full w-full"
      >
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
          camera={{ position: [0, 0.2, 3.2], fov: 38 }}
          style={{ background: "transparent" }}
          onCreated={() => setTimeout(() => setReady(true), 120)}
        >
          {/* Lights — dramatic, Apple-keynote-ish */}
          <ambientLight intensity={0.35} />
          <directionalLight
            position={[2.5, 3, 2]}
            intensity={1.1}
            color={"#ffffff"}
          />
          {/* Violet rim */}
          <directionalLight
            position={[-3, 1.5, -2]}
            intensity={2}
            color={"#a074ff"}
          />
          {/* Cyan kicker */}
          <pointLight
            position={[2.5, -0.5, -2]}
            intensity={1.5}
            color={"#6dd5ff"}
          />

          <Environment preset="studio" environmentIntensity={0.35} />

          <Suspense fallback={null}>
            <Float
              speed={1.2}
              rotationIntensity={0.25}
              floatIntensity={0.55}
              floatingRange={[-0.08, 0.08]}
            >
              <Oceanus
                pointerX={pxSpring}
                pointerY={pySpring}
                scroll={scrollSpring}
              />
            </Float>

            <ContactShadows
              position={[0, -1.15, 0]}
              opacity={0.55}
              scale={6}
              blur={2.6}
              far={3}
              color={"#000000"}
            />
          </Suspense>

          <CameraBreath />
        </Canvas>
      </motion.div>
    </div>
  );
}

function Oceanus({
  pointerX,
  pointerY,
  scroll,
}: {
  pointerX: ReturnType<typeof useSpring>;
  pointerY: ReturnType<typeof useSpring>;
  scroll: ReturnType<typeof useSpring>;
}) {
  const { scene } = useGLTF(MODEL_URL) as unknown as {
    scene: THREE.Group;
  };
  const ref = useRef<THREE.Group>(null);

  // Normalize model size + center once.
  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2.2 / maxDim;
    scene.scale.setScalar(scale);
    scene.position.sub(center.multiplyScalar(scale));

    // Nudge material for a softer, more premium look.
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (m) {
          m.envMapIntensity = 0.9;
          m.roughness = Math.max(m.roughness ?? 0.5, 0.45);
          m.metalness = Math.min(m.metalness ?? 0.0, 0.15);
        }
      }
    });
  }, [scene]);

  useFrame((_state, delta) => {
    if (!ref.current) return;
    const t = performance.now() / 1000;

    const px = pointerX.get();
    const py = pointerY.get();
    const sp = scroll.get();

    // Base idle auto-rotation (slow, continuous).
    const autoY = t * 0.18;

    // Scroll contributes an extra 180° as the hero leaves the viewport — feels
    // like the statue turns to follow you off the page.
    const scrollY = sp * Math.PI;

    // Mouse parallax lightly steers yaw/pitch.
    const targetY = autoY + scrollY + px * 0.35;
    const targetX = -py * 0.2 + sp * 0.12;

    // Spring-like blend to avoid jerky frames.
    ref.current.rotation.y = THREE.MathUtils.damp(
      ref.current.rotation.y,
      targetY,
      6,
      delta,
    );
    ref.current.rotation.x = THREE.MathUtils.damp(
      ref.current.rotation.x,
      targetX,
      6,
      delta,
    );

    // Subtle zoom-in as user scrolls.
    const targetScale = 1 + sp * 0.18;
    ref.current.scale.setScalar(
      THREE.MathUtils.damp(ref.current.scale.x, targetScale, 6, delta),
    );
  });

  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

function CameraBreath() {
  const { camera } = useThree();
  useFrame(() => {
    const t = performance.now() / 1000;
    camera.position.x = Math.sin(t * 0.35) * 0.05;
    camera.position.y = 0.2 + Math.sin(t * 0.55) * 0.03;
    camera.lookAt(0, 0, 0);
  });
  return null;
}
