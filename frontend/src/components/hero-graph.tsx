"use client";

import { useTranslations } from "next-intl";
import { Webhook, Globe, GitBranch, Database } from "lucide-react";

/**
 * A live mini node-graph: a token flows trigger -> action -> branch -> store
 * along glowing edges. Pure SVG + CSS offset-path animation, no React Flow.
 */
export function HeroGraph() {
  const t = useTranslations("landing");

  // node centers in the 440x300 viewBox
  const nodes = [
    { key: "graphTrigger", x: 70, y: 60, Icon: Webhook, tint: "var(--primary-strong)" },
    { key: "graphAction", x: 250, y: 60, Icon: Globe, tint: "var(--accent)" },
    { key: "graphBranch", x: 250, y: 200, Icon: GitBranch, tint: "var(--accent)" },
    { key: "graphStore", x: 70, y: 200, Icon: Database, tint: "var(--signal)" },
  ] as const;

  const NODE_W = 120;
  const NODE_H = 52;

  // edge paths (from right/bottom of a node to the next), used both for the
  // visible stroke and as the motion-path for the flowing token.
  const edges = [
    "M 130 60 H 250", // trigger -> action
    "M 250 86 V 174", // action -> branch
    "M 190 200 H 130", // branch -> store
  ];

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-[radial-gradient(60%_60%_at_50%_40%,var(--glow),transparent_70%)] opacity-60" />
      <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-grid p-4 shadow-2xl">
        <div className="mb-3 flex items-center gap-1.5 px-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--err)]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--ok)]/70" />
          <span className="ml-2 font-mono text-[11px] text-faint">workflow.flux</span>
        </div>

        <svg viewBox="0 0 320 260" className="w-full" role="img" aria-label={t("graphAria")}>
          {/* edges */}
          {edges.map((d, i) => (
            <g key={i}>
              <path d={d} fill="none" stroke="var(--border)" strokeWidth="1.5" />
              <path
                d={d}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="1.5"
                strokeDasharray="4 8"
                opacity="0.55"
                style={{ animation: "fluxo-dash 1.2s linear infinite" }}
              />
            </g>
          ))}

          {/* flowing token (loops along the 3 edges) */}
          {edges.map((d, i) => (
            <circle
              key={`tok-${i}`}
              r="4"
              fill="var(--signal)"
              style={{
                offsetPath: `path('${d}')`,
                animation: `fluxo-flow 3.6s ${i * 1.2}s linear infinite`,
                filter: "drop-shadow(0 0 5px var(--signal))",
              }}
            />
          ))}

          {/* nodes */}
          {nodes.map(({ key, x, y, Icon, tint }) => (
            <foreignObject
              key={key}
              x={x - NODE_W / 2}
              y={y - NODE_H / 2}
              width={NODE_W}
              height={NODE_H}
            >
              <div className="flex h-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 shadow-md">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
                  style={{ background: `color-mix(in srgb, ${tint} 18%, transparent)`, color: tint }}
                >
                  <Icon size={15} />
                </span>
                <span className="font-mono text-[12px] font-medium text-fg">{t(key)}</span>
              </div>
            </foreignObject>
          ))}
        </svg>

        <p className="mt-2 px-1 text-center font-mono text-[11px] text-faint">{t("graphCaption")}</p>
      </div>
    </div>
  );
}
