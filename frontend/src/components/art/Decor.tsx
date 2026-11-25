/** Decorative farm graphics. All aria-hidden: they carry no information. */

/** Rolling field rows with sprouts, used as a section divider. */
export function FieldBand() {
  return (
    <svg viewBox="0 0 1200 90" preserveAspectRatio="none" aria-hidden="true" focusable="false" className="mt-14 block h-16 w-full md:h-20">
      <path d="M0 40 Q150 10 300 38 T600 34 T900 40 T1200 28 V90 H0Z" fill="#b9dca0" />
      <path d="M0 58 Q180 32 360 56 T720 52 T1080 58 T1200 50 V90 H0Z" fill="#8fc46c" />
      <path d="M0 76 Q200 56 400 74 T800 72 T1200 70 V90 H0Z" fill="#5aa84a" />
      {Array.from({ length: 24 }, (_, i) => (
        <g key={i} transform={`translate(${30 + i * 50} ${72 + (i % 3) * 4})`} fill="#2f7a31">
          <path d="M0 14 q-7 -6 -8 -14 q8 2 8 14z" /><path d="M0 14 q7 -6 8 -14 q-8 2 -8 14z" />
        </g>
      ))}
    </svg>
  )
}

/** Small relationship-graph picture for the knowledge preview. */
export function MiniGraph({ center, nodes }: { center: string; nodes: string[] }) {
  const pos = [[60, 22], [260, 22], [60, 112], [260, 112]]
  return (
    <svg viewBox="0 0 320 160" aria-hidden="true" focusable="false" className="h-40 w-full max-w-sm">
      {nodes.slice(0, 4).map((n, i) => (
        <g key={n}>
          <line x1="160" y1="80" x2={pos[i][0]} y2={pos[i][1]} stroke="#15803d" strokeWidth="1.5" opacity=".45" />
          <circle cx={pos[i][0]} cy={pos[i][1]} r="14" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="1.5" />
          <text x={pos[i][0]} y={pos[i][1] + 30} textAnchor="middle" fontSize="10" fill="currentColor">{n}</text>
        </g>
      ))}
      <circle cx="160" cy="80" r="30" fill="#15803d" />
      <text x="160" y="84" textAnchor="middle" fontSize="11" fill="#fff" fontWeight="600">{center}</text>
    </svg>
  )
}

/** Soft wheat/leaf pattern for dark hero backgrounds. */
export function HeroPattern() {
  return (
    <svg aria-hidden="true" focusable="false" className="pointer-events-none absolute inset-0 h-full w-full opacity-[.07]">
      <defs>
        <pattern id="leaf" width="64" height="64" patternUnits="userSpaceOnUse">
          <path d="M32 54 V26 M32 34 q-12 -2 -14 -14 q12 0 14 14z M32 28 q12 -2 14 -14 q-12 0 -14 14z" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#leaf)" />
    </svg>
  )
}
