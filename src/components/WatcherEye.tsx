import { useId } from "react";

export type EyeState = "watching" | "analyzing" | "paused" | "sleeping";

/**
 * The Board's "eye", an orb of light in a thin almond outline: watching (the orb looks around,
 * the halo breathes), analyzing (a ring of light turns around the orb), paused (the lid comes
 * halfway down) or sleeping (closed, a single curve: off, or outside business hours).
 * Decorative: the state is always said in text next to it.
 */
export function WatcherEye({ state, className = "" }: { state: EyeState; className?: string }) {
  // Ids must be unique per instance (gradients and clip paths are looked up by id).
  const id = useId().replace(/:/g, "");
  const line = `${id}-line`;
  const orb = `${id}-orb`;
  const halo = `${id}-halo`;
  const almond = `${id}-almond`;
  const eyePath = "M10 40 Q66 4 122 40 Q66 76 10 40 Z";
  const fillBox = { transformBox: "fill-box", transformOrigin: "50% 50%" } as const;

  return (
    <svg viewBox="0 0 132 80" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={line} x1="0" y1="0" x2="132" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="55%" stopColor="#d946ef" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <radialGradient id={orb} cx="38%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#f0abfc" />
          <stop offset="35%" stopColor="#a78bfa" />
          <stop offset="75%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#22d3ee" />
        </radialGradient>
        <radialGradient id={halo} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </radialGradient>
        <clipPath id={almond}>
          <path d={eyePath} />
        </clipPath>
      </defs>

      {state === "sleeping" ? (
        <path
          d="M12 38 Q66 66 120 38"
          fill="none"
          stroke={`url(#${line})`}
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : (
        <>
          <circle
            cx="66"
            cy="40"
            r="38"
            fill={`url(#${halo})`}
            className={state === "paused" ? "opacity-30" : "watcher-glow"}
          />
          <path
            d={eyePath}
            className="fill-[#0b0618]"
            stroke={`url(#${line})`}
            strokeWidth="1.6"
            strokeOpacity="0.9"
          />
          <g clipPath={`url(#${almond})`}>
            <g className={state === "watching" ? "watcher-look" : ""} style={fillBox}>
              <circle cx="66" cy="40" r="20" fill={`url(#${orb})`} />
              <circle cx="66" cy="40" r="7" className="fill-[#0b0618]" />
              <ellipse cx="58" cy="32" rx="6" ry="4" fill="white" opacity="0.85" />
            </g>
            {/* Paused: the lid comes halfway down. */}
            {state === "paused" && (
              <rect x="0" y="0" width="132" height="37" className="fill-[#1e1035]" opacity="0.96" />
            )}
          </g>
          {state === "paused" && (
            <path
              d="M14 37 Q66 30 118 37"
              fill="none"
              stroke={`url(#${line})`}
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
          {state === "analyzing" && (
            <circle
              cx="66"
              cy="40"
              r="26"
              fill="none"
              stroke={`url(#${line})`}
              strokeWidth="2.2"
              strokeDasharray="34 130"
              strokeLinecap="round"
              className="watcher-scan"
              style={fillBox}
            />
          )}
        </>
      )}
    </svg>
  );
}
