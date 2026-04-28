"use client";

import { motion } from "framer-motion";
import type { AiState } from "./types";

interface AudioVisualizerProps {
  state: AiState;
  connected: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { wrapper: "h-16 w-16", core: "h-10 w-10" },
  md: { wrapper: "h-24 w-24", core: "h-14 w-14" },
  lg: { wrapper: "h-36 w-36", core: "h-20 w-20" },
};

export function AudioVisualizer({ state, connected, size = "lg" }: AudioVisualizerProps) {
  const { wrapper, core } = sizeMap[size];
  const isActive = connected && (state === "speaking" || state === "listening");

  // Color configurations per state
  const colors = {
    idle: {
      from: "from-indigo-500",
      to: "to-violet-600",
      shadow: "rgba(99,102,241,0.35)",
      ring: "border-indigo-300/30",
    },
    preparing: {
      from: "from-amber-400",
      to: "to-indigo-500",
      shadow: "rgba(245,158,11,0.4)",
      ring: "border-amber-300/40",
    },
    speaking: {
      from: "from-blue-400",
      to: "to-indigo-500",
      shadow: "rgba(96,165,250,0.4)",
      ring: "border-blue-300/40",
    },
    listening: {
      from: "from-emerald-400",
      to: "to-teal-500",
      shadow: "rgba(52,211,153,0.35)",
      ring: "border-emerald-300/40",
    },
  };

  const current = colors[state];

  return (
    <div className={`relative ${wrapper} flex items-center justify-center`}>
      {/* Outer glow ring */}
      <motion.div
        className={`absolute inset-0 rounded-full border-2 ${current.ring}`}
        animate={
          state === "preparing"
            ? {
                scale: [1, 1.15, 1],
                opacity: [0.5, 0.2, 0.5],
              }
            : state === "speaking"
              ? {
                  scale: [1, 1.2, 1.1, 1],
                  opacity: [0.3, 0.6, 0.4, 0.3],
                }
              : state === "listening"
                ? {
                    scale: [1, 1.08, 1],
                    opacity: [0.4, 0.3, 0.4],
                  }
                : {
                    scale: [1, 1.05, 1],
                    opacity: [0.3, 0.2, 0.3],
                  }
        }
        transition={
          state === "preparing"
            ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
            : state === "speaking"
              ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" }
              : { duration: 3, repeat: Infinity, ease: "easeInOut" }
        }
      />

      {/* Secondary ring for preparing state */}
      {state === "preparing" && (
        <motion.div
          className="absolute inset-0 rounded-full border border-amber-400/20"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.6, 0, 0.6],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Core orb */}
      <motion.div
        className={`relative ${core} rounded-full bg-gradient-to-br ${current.from} ${current.to} flex items-center justify-center`}
        animate={
          state === "preparing"
            ? {
                scale: [1, 1.05, 1],
                rotate: [0, 180, 360],
              }
            : state === "speaking"
              ? {
                  scale: [1, 1.08, 0.95, 1.06, 1],
                }
              : state === "listening"
                ? {
                    scale: [1, 1.04, 1],
                  }
                : {
                    scale: [1, 1.03, 1],
                  }
        }
        transition={
          state === "preparing"
            ? { duration: 2, repeat: Infinity, ease: "linear" }
            : state === "speaking"
              ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
              : { duration: 3, repeat: Infinity, ease: "easeInOut" }
        }
        style={{
          boxShadow: isActive
            ? `0 0 40px ${current.shadow}, 0 0 80px ${current.shadow}`
            : `0 0 20px ${current.shadow}`,
        }}
      >
        {/* Inner highlight */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/20 to-transparent" />
      </motion.div>

      {/* Ripple dots for preparing */}
      {state === "preparing" && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-amber-400/30"
              style={{ inset: -8 }}
              animate={{
                scale: [1, 1.4],
                opacity: [0.5, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.4,
                ease: "easeOut",
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
