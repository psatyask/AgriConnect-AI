/**
 * Original, generic farm illustrations (no real people, brands or copyrighted characters).
 * A scene id comes from the active country pack; unknown ids fall back to a neutral field.
 * Replace with licensed photography later via `heroImage.src`.
 */
const SKY = '#cfe8d0'

function Sun({ cx = 320, cy = 60 }: { cx?: number; cy?: number }) {
  return <circle cx={cx} cy={cy} r="26" fill="#fde68a" />
}

function Paddy() {
  return (
    <>
      <rect width="400" height="260" fill={SKY} />
      <Sun />
      <path d="M0 150 Q100 105 200 140 T400 120 V260 H0Z" fill="#7fbf6a" />
      <path d="M0 185 Q120 150 230 180 T400 165 V260 H0Z" fill="#5aa84a" />
      <path d="M0 220 Q140 195 260 218 T400 205 V260 H0Z" fill="#3f8f3a" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M${20 + i * 66} 258 q10 -34 0 -52 q-10 18 0 52`} fill="#2f7a31" opacity=".85" />
      ))}
      {[60, 330].map((x) => (
        <g key={x}>
          <path d={`M${x} 150 q-6 -50 4 -86`} stroke="#7c5a3a" strokeWidth="5" fill="none" strokeLinecap="round" />
          {[-34, -16, 0, 16, 34].map((d) => (
            <path key={d} d={`M${x + 4} 66 q${d} -22 ${d * 1.6} 4`} stroke="#2f7a31" strokeWidth="5" fill="none" strokeLinecap="round" />
          ))}
        </g>
      ))}
      <ellipse cx="200" cy="196" rx="30" ry="9" fill="#d9c27a" />
      <path d="M170 196 q30 -18 60 0z" fill="#e9d38a" />
    </>
  )
}

function Prairie() {
  return (
    <>
      <rect width="400" height="260" fill="#cde6f2" />
      <Sun cx={70} cy={55} />
      <ellipse cx="250" cy="48" rx="46" ry="13" fill="#fff" opacity=".9" />
      <ellipse cx="285" cy="40" rx="30" ry="11" fill="#fff" opacity=".9" />
      <path d="M0 140 Q120 118 240 138 T400 128 V260 H0Z" fill="#a8cf6a" />
      <path d="M0 175 Q140 150 260 172 T400 160 V260 H0Z" fill="#7fb84c" />
      <rect x="236" y="96" width="62" height="48" fill="#b7352a" />
      <path d="M230 98 L267 70 L304 98Z" fill="#8f2a21" />
      <rect x="258" y="116" width="18" height="28" fill="#f5f0e6" />
      <rect x="312" y="78" width="22" height="66" fill="#c9ccd1" />
      <path d="M310 78 q13 -20 26 0z" fill="#9aa0a8" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path key={i} d={`M0 ${262 - i * 14} Q200 ${214 - i * 14} 400 ${240 - i * 14}`} stroke="#3f8f3a" strokeWidth="7" fill="none" opacity={0.45 + i * 0.07} />
      ))}
    </>
  )
}

function Field() {
  return (
    <>
      <rect width="400" height="260" fill={SKY} />
      <Sun />
      <path d="M0 160 Q150 130 400 155 V260 H0Z" fill="#7fb84c" />
      <path d="M0 210 Q200 180 400 205 V260 H0Z" fill="#3f8f3a" />
    </>
  )
}

const SCENES: Record<string, () => React.ReactNode> = { paddy: Paddy, prairie: Prairie }

export default function HeroArt({ scene, label }: { scene: string; label: string }) {
  const Scene = SCENES[scene] ?? Field
  return (
    <svg viewBox="0 0 400 260" role="img" aria-label={label} className="h-64 w-full rounded-2xl">
      <Scene />
    </svg>
  )
}
