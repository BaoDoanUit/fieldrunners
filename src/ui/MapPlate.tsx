import { gameConfig } from "../shared/gameConfig";

/**
 * MapPlate — a topographical survey of the 20-round path.
 *
 * Pure SVG, no images. Drawn in the Tactical Field Manual palette:
 *  - path traced in `--path-line` (sepia), with the same coordinate
 *    system as `gameConfig.path` (xz world coords -> SVG y, x scaled).
 *  - 16 build zones as small ink crosses.
 *  - Round markers 01..20 along the path; BOSS chips at 10 and 20.
 *
 * Used as a hero plate on the HomeMenu and (smaller) as a MiniMap
 * in the battle topbar.
 */
export function MapPlate(props: { size?: "large" | "small"; title?: string }) {
  const size = props.size ?? "large";
  const isLarge = size === "large";
  // Map the gameConfig world [-7..8] x [-5..6] to a 0..100 SVG viewBox
  // (so the plate scales cleanly inside its parent).
  const VW = 100;
  const VH = 100;
  const X_MIN = -7, X_MAX = 8;
  const Z_MIN = -5, Z_MAX = 6;
  const sx = (x: number) => ((x - X_MIN) / (X_MAX - X_MIN)) * VW;
  const sy = (z: number) => ((Z_MAX - z) / (Z_MAX - Z_MIN)) * VH;

  const pathD = gameConfig.path
    .map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x).toFixed(1)} ${sy(p.z).toFixed(1)}`)
    .join(" ");

  // Place round markers evenly along the path; 20 round chips
  const roundChips: { i: number; x: number; z: number }[] = [];
  for (let i = 0; i < 20; i++) {
    const t = (i + 1) / 21;
    const point = samplePath(gameConfig.path, t);
    if (point) roundChips.push({ i: i + 1, x: point.x, z: point.z });
  }

  return (
    <svg
      className={`map-plate ${isLarge ? "large" : "small"}`}
      viewBox={`0 0 ${VW} ${VH}`}
      role="img"
      aria-label={props.title ?? "Map of the 20-round enemy path"}
    >
      {/* paper backdrop */}
      <rect x="0" y="0" width={VW} height={VH} fill="var(--parchment-2)" />
      {/* contour lines (decorative — every 10 units in world) */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line
          key={`h${i}`}
          x1="0"
          y1={(i / 5) * VH}
          x2={VW}
          y2={(i / 5) * VH}
          stroke="var(--rule)"
          strokeOpacity="0.18"
          strokeWidth="0.15"
          strokeDasharray="0.6 0.6"
        />
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <line
          key={`v${i}`}
          x1={(i / 8) * VW}
          y1="0"
          x2={(i / 8) * VW}
          y2={VH}
          stroke="var(--rule)"
          strokeOpacity="0.18"
          strokeWidth="0.15"
          strokeDasharray="0.6 0.6"
        />
      ))}
      {/* frame */}
      <rect
        x="1.5"
        y="1.5"
        width={VW - 3}
        height={VH - 3}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="0.4"
      />
      {/* build zones (small ink crosses) */}
      {gameConfig.buildZones.map((z, i) => (
        <g key={`zone-${i}`} transform={`translate(${sx(z.x).toFixed(1)} ${sy(z.z).toFixed(1)})`}>
          <line x1="-1.4" y1="0" x2="1.4" y2="0" stroke="var(--ink)" strokeWidth="0.3" />
          <line x1="0" y1="-1.4" x2="0" y2="1.4" stroke="var(--ink)" strokeWidth="0.3" />
        </g>
      ))}
      {/* enemy path (sepia) */}
      <path
        d={pathD}
        fill="none"
        stroke="var(--path-line)"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* start dot */}
      <circle
        cx={sx(gameConfig.path[0].x)}
        cy={sy(gameConfig.path[0].z)}
        r="1.6"
        fill="var(--verdigris)"
        stroke="var(--ink)"
        strokeWidth="0.4"
      />
      {/* end dot */}
      <circle
        cx={sx(gameConfig.path[gameConfig.path.length - 1].x)}
        cy={sy(gameConfig.path[gameConfig.path.length - 1].z)}
        r="1.8"
        fill="var(--rust)"
        stroke="var(--ink)"
        strokeWidth="0.4"
      />
      {/* round chips */}
      {roundChips.map(({ i, x, z }) => {
        const isBoss = i === 10 || i === 20;
        return (
          <g key={`r${i}`} transform={`translate(${sx(x).toFixed(1)} ${sy(z).toFixed(1)})`}>
            <circle
              r={isBoss ? 3.2 : 2.4}
              fill={isBoss ? "var(--flare)" : "var(--parchment)"}
              stroke="var(--ink)"
              strokeWidth="0.4"
            />
            <text
              x="0"
              y="0.9"
              fontSize={isBoss ? 2.4 : 1.8}
              textAnchor="middle"
              fill={isBoss ? "var(--ink)" : "var(--ink)"}
              fontFamily="var(--font-display)"
              style={{ textTransform: "uppercase" }}
            >
              {isBoss ? `B${i}` : String(i).padStart(2, "0")}
            </text>
          </g>
        );
      })}
      {/* corner brackets */}
      {([["TL", 1.5, 1.5, 0, 0], ["TR", VW - 1.5, 1.5, 1, 0], ["BL", 1.5, VH - 1.5, 0, 1], ["BR", VW - 1.5, VH - 1.5, 1, 1]] as const).map(
        ([id, x, y, dx, dy]) => (
          <path
            key={id}
            d={`M ${x} ${y + (dy ? -3 : 3)} L ${x} ${y} L ${x + (dx ? -3 : 3)} ${y}`}
            stroke="var(--flare)"
            strokeWidth="0.7"
            fill="none"
          />
        )
      )}
    </svg>
  );
}

/** Sample a point at parameter t in [0..1] along the path polyline. */
function samplePath(
  pts: { x: number; z: number }[],
  t: number
): { x: number; z: number } | null {
  if (pts.length < 2) return null;
  // total length
  const segs = pts.slice(1).map((p, i) => {
    const q = pts[i];
    return Math.hypot(p.x - q.x, p.z - q.z);
  });
  const total = segs.reduce((a, b) => a + b, 0);
  if (total === 0) return pts[0];
  const target = t * total;
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= target) {
      const localT = (target - acc) / segs[i];
      const a = pts[i], b = pts[i + 1];
      return { x: a.x + (b.x - a.x) * localT, z: a.z + (b.z - a.z) * localT };
    }
    acc += segs[i];
  }
  return pts[pts.length - 1];
}
