"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

/**
 * Animated, faintly-glowing edge. A dashed overlay scrolls along the path
 * (the `fluxo-dash` keyframes live in globals.css) to give the "token flowing"
 * dev-tool look without per-frame React work.
 */
export function FluxoEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={path} />
      <path
        d={path}
        fill="none"
        stroke={selected ? "var(--primary)" : "var(--primary)"}
        strokeWidth={1.5}
        strokeOpacity={selected ? 0.9 : 0.55}
        strokeDasharray="3 7"
        style={{ animation: "fluxo-dash 0.7s linear infinite" }}
      />
    </>
  );
}
