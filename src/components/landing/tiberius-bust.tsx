"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

// ASCII line-art of a Greek-style profile bust. Hand-crafted, fixed-width;
// every line padded to 44 glyphs so the silhouette stays clean at any zoom.
const ASCII = `
             ______
          ,-'      '-.
        ,'            '._
       /                 \\
      |    _.--.           \\
      |  ,'     '.          \\
      | /         \\         |
      ||   o       \\        |
      ||            )        |
      | \\    __    /         |
      |  \\  '--'  /         /
       \\  '.____.'         /
        \\                 /
         '.              /
           '._         _/
              '-._____/|
              /        |
             /_________|
            /           \\
           /             \\
         ,'               '.
       ,'                   '.
     ,'_____________________  '._
    |________________________|___)
`.trim();

const LINES = ASCII.split("\n");

export function TiberiusBust({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Mouse-parallax tilt
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 80, damping: 14 });
  const sy = useSpring(my, { stiffness: 80, damping: 14 });
  const rotateY = useTransform(sx, [-1, 1], [-6, 6]);
  const rotateX = useTransform(sy, [-1, 1], [4, -4]);
  const glowX = useTransform(sx, [-1, 1], [-20, 20]);

  useEffect(() => setMounted(true), []);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
    my.set(((e.clientY - r.top) / r.height) * 2 - 1);
  }
  function onLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <div
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={
        "relative flex items-center justify-center " + (className ?? "")
      }
      style={{ perspective: "1200px" }}
      aria-hidden
    >
      <span className="sr-only">Tiberius</span>

      {/* Ambient glow — tracks cursor subtly */}
      <motion.div
        style={{ x: glowX }}
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
      >
        <div className="h-[70%] w-[70%] rounded-full bg-[radial-gradient(circle,oklch(0.7_0.19_285/0.35),transparent_65%)] blur-2xl" />
      </motion.div>

      {/* The bust itself, three stacked layers for RGB-split glitch */}
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative"
      >
        <GlitchLayer color="rgba(236,72,153,0.55)" offset={-1.5} delay={0.05} />
        <GlitchLayer color="rgba(0,229,255,0.55)" offset={1.5} delay={0.1} />

        <pre
          className="relative font-mono text-[10px] leading-[1.05] tracking-[-0.02em] text-foreground sm:text-[12px] md:text-[14px]"
          style={{ whiteSpace: "pre" }}
        >
          {LINES.map((line, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
              transition={{
                duration: 0.35,
                delay: 0.3 + i * 0.035,
                ease: "easeOut",
              }}
              className="block"
            >
              {line}
            </motion.span>
          ))}
        </pre>

        {/* Scanline shimmer */}
        <motion.div
          aria-hidden
          initial={{ y: "-100%" }}
          animate={{ y: "120%" }}
          transition={{
            duration: 5.5,
            repeat: Infinity,
            ease: "linear",
            delay: 1.2,
          }}
          className="pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-primary/20 to-transparent mix-blend-screen"
        />
      </motion.div>

      {/* Pulsing violet ring */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-full"
        animate={{
          boxShadow: [
            "0 0 60px 10px oklch(0.7 0.19 285 / 0.0)",
            "0 0 80px 18px oklch(0.7 0.19 285 / 0.22)",
            "0 0 60px 10px oklch(0.7 0.19 285 / 0.0)",
          ],
        }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function GlitchLayer({
  color,
  offset,
  delay,
}: {
  color: string;
  offset: number;
  delay: number;
}) {
  return (
    <motion.pre
      aria-hidden
      initial={{ x: 0, opacity: 0 }}
      animate={{
        x: [0, offset, -offset, 0, offset * 1.2, 0],
        opacity: [0, 0.5, 0.3, 0.55, 0.2, 0.4],
      }}
      transition={{
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
      className="absolute inset-0 font-mono text-[10px] leading-[1.05] tracking-[-0.02em] sm:text-[12px] md:text-[14px]"
      style={{
        color,
        whiteSpace: "pre",
        mixBlendMode: "screen",
      }}
    >
      {ASCII}
    </motion.pre>
  );
}
