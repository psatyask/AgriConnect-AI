import type { ReactNode } from 'react'

/** Original icon templates for the long tail of crops. Each crop gets one shape in its own colour. Decorative only. */
const LEAF = '#3f8f3a'
type Kind = 'round' | 'citrus' | 'berry' | 'melon' | 'leaf' | 'root' | 'stalk' | 'pear' | 'bulb' | 'pepper' | 'banana' | 'pineapple'
  | 'coconut' | 'dragon' | 'long' | 'ridged' | 'head' | 'strawberry' | 'cob'

function mix(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * amount))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function art(kind: Kind, c: string, a: string): ReactNode {
  switch (kind) {
    case 'round':
      return <><circle cx="24" cy="27" r="13" fill={c} /><path d="M24 15 q-1 -6 4 -8" stroke="#6b4f2a" strokeWidth="2.5" fill="none" strokeLinecap="round" /><path d="M24 16 q8 -6 12 0 q-6 4 -12 0z" fill={LEAF} /></>
    case 'citrus':
      return <><circle cx="24" cy="24" r="15" fill={c} /><circle cx="24" cy="24" r="12" fill={a} />{[0, 60, 120].map((r) => <line key={r} x1="24" y1="12" x2="24" y2="36" stroke={c} strokeWidth="1.6" transform={`rotate(${r} 24 24)`} />)}</>
    case 'berry':
      return <><circle cx="17" cy="28" r="6" fill={c} /><circle cx="29" cy="28" r="6" fill={c} /><circle cx="23" cy="20" r="6" fill={c} /><circle cx="23" cy="34" r="6" fill={c} /><path d="M16 12 q8 -6 16 0 q-8 6 -16 0z" fill={LEAF} /></>
    case 'melon':
      return <><circle cx="24" cy="25" r="15" fill={c} />{[-8, 0, 8].map((d) => <path key={d} d={`M${24 + d} 10 q${d > 0 ? 5 : d < 0 ? -5 : 0} 15 0 30`} stroke={a} strokeWidth="2" fill="none" />)}</>
    case 'leaf':
      return <><path d="M24 40 C8 34 6 16 24 8 C42 16 40 34 24 40z" fill={c} /><path d="M24 40 V14 M24 30 l-8 -6 M24 24 l8 -6" stroke={a} strokeWidth="1.8" fill="none" strokeLinecap="round" /></>
    case 'root':
      return <><path d="M12 18 q12 -6 24 0 q-4 20 -12 24 q-8 -4 -12 -24z" fill={c} /><path d="M24 18 q-6 -8 -10 -10 M24 18 q0 -9 0 -12 M24 18 q6 -8 10 -10" stroke={LEAF} strokeWidth="3" fill="none" strokeLinecap="round" /></>
    case 'stalk':
      return <>{[14, 24, 34].map((x, i) => <rect key={x} x={x - 3} y={10 + i * 2} width="6" height={30 - i * 2} rx="3" fill={i === 1 ? a : c} />)}</>
    case 'pear':
      return <><path d="M24 12 q8 0 8 10 q10 4 8 14 q-2 6 -16 6 q-14 0 -16 -6 q-2 -10 8 -14 q0 -10 8 -10z" fill={c} /><path d="M24 12 q0 -4 3 -6" stroke="#6b4f2a" strokeWidth="2.5" fill="none" strokeLinecap="round" /><circle cx="24" cy="32" r="3.2" fill={a} /></>
    case 'bulb':
      return <><path d="M24 12 q16 8 14 20 q-3 8 -14 8 q-11 0 -14 -8 q-2 -12 14 -20z" fill={c} /><path d="M24 12 v-6" stroke={LEAF} strokeWidth="3" strokeLinecap="round" /><path d="M24 14 q-6 8 -4 24 M24 14 q6 8 4 24" stroke={a} strokeWidth="1.5" fill="none" /></>
    case 'pepper':
      return <><path d="M14 14 q22 0 20 22 q-1 6 -4 4 q2 -14 -16 -18z" fill={c} /><path d="M14 14 q-4 -4 -2 -8" stroke={LEAF} strokeWidth="3" fill="none" strokeLinecap="round" /></>
    case 'banana':
      return <><path d="M8 18 q4 24 32 22 q-4 -4 -4 -6 q-18 0 -22 -18z" fill={c} /><path d="M8 18 q-2 -6 2 -8" stroke="#6b4f2a" strokeWidth="3" fill="none" strokeLinecap="round" /></>
    case 'pineapple':
      return <><ellipse cx="24" cy="29" rx="11" ry="14" fill={c} />{[22, 28, 34].map((y) => <path key={y} d={`M15 ${y} l9 6 l9 -6`} stroke={a} strokeWidth="1.4" fill="none" />)}<path d="M24 16 l-6 -10 l6 4 l6 -4z" fill={LEAF} /></>
    case 'coconut':
      return <><circle cx="24" cy="25" r="15" fill={c} /><circle cx="19" cy="21" r="2" fill={a} /><circle cx="27" cy="21" r="2" fill={a} /><circle cx="23" cy="27" r="2" fill={a} /></>
    case 'dragon':
      return <><ellipse cx="24" cy="26" rx="12" ry="15" fill={c} />{[[12, 18], [36, 18], [11, 28], [37, 28], [14, 38], [34, 38]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x} ${y} l${x < 24 ? -6 : 6} -4`} stroke={LEAF} strokeWidth="3" strokeLinecap="round" />)}<circle cx="21" cy="26" r="1.3" fill={a} /><circle cx="27" cy="30" r="1.3" fill={a} /></>
    case 'long':
      return <><rect x="8" y="19" width="32" height="12" rx="6" fill={c} transform="rotate(-25 24 25)" /><circle cx="35" cy="14" r="2.4" fill={a} /></>
    case 'ridged':
      return <><ellipse cx="24" cy="27" rx="15" ry="13" fill={c} />{[-8, 0, 8].map((d) => <path key={d} d={`M${24 + d} 15 q${d * 0.6} 12 0 24`} stroke={a} strokeWidth="1.6" fill="none" />)}<path d="M24 14 q0 -6 4 -8" stroke={LEAF} strokeWidth="3" fill="none" strokeLinecap="round" /></>
    case 'strawberry':
      return <><path d="M10 18 q14 -6 28 0 q-2 14 -14 24 q-12 -10 -14 -24z" fill={c} />{[[18, 24], [30, 24], [24, 30], [20, 34], [28, 34]].map(([x, y]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx="1.2" ry="1.8" fill="#fde68a" />)}<path d="M13 17 l5 -5 l6 4 l6 -4 l5 5 q-11 -4 -22 0z" fill={LEAF} /></>
    case 'cob':
      return <><ellipse cx="24" cy="25" rx="8" ry="15" fill={c} />{[18, 24, 30].map((y) => <line key={y} x1="17" y1={y} x2="31" y2={y} stroke={a} strokeWidth="1.2" />)}<path d="M16 16 q-10 12 2 26 q4 -14 6 -22z M32 16 q10 12 -2 26 q-4 -14 -6 -22z" fill={LEAF} opacity=".9" /></>
    case 'head':
      return <><circle cx="16" cy="24" r="8" fill={c} /><circle cx="24" cy="17" r="9" fill={c} /><circle cx="32" cy="24" r="8" fill={c} /><circle cx="24" cy="29" r="9" fill={c} /><path d="M12 32 q12 12 24 0 q-6 2 -12 2 q-6 0 -12 -2z" fill={a} /></>
  }
}

// [id, shape, main colour, accent]
const TABLE: [string, Kind, string, string][] = [
  ['apple', 'round', '#dc2626', ''], ['orange', 'citrus', '#f97316', '#fdba74'], ['pear', 'pear', '#a3b83a', '#6b7d1a'],
  ['lemon', 'citrus', '#facc15', '#fef08a'], ['lime', 'citrus', '#65a30d', '#bef264'], ['mango', 'round', '#f59e0b', ''],
  ['banana', 'banana', '#facc15', ''], ['avocado', 'pear', '#3f6212', '#7c4a1d'], ['grape', 'berry', '#7c3aed', ''],
  ['grapefruit', 'citrus', '#fb7185', '#fecdd3'], ['kiwifruit', 'citrus', '#8b6b3d', '#84cc16'], ['pineapple', 'pineapple', '#eab308', '#a16207'],
  ['tangerine', 'citrus', '#fb923c', '#fed7aa'], ['papaya', 'long', '#fb923c', '#a16207'], ['persimmon', 'round', '#ea580c', ''],
  ['watermelon', 'melon', '#16a34a', '#14532d'], ['honeydew', 'melon', '#bef264', '#84cc16'], ['cantaloupe', 'melon', '#fdba74', '#c2410c'],
  ['pomegranate', 'round', '#be123c', ''], ['plantain', 'banana', '#a3b83a', ''], ['dragon_fruit', 'dragon', '#ec4899', '#111827'],
  ['blueberry', 'berry', '#3b5bdb', ''], ['strawberry', 'strawberry', '#ef4444', ''], ['raspberry', 'berry', '#e11d48', ''],
  ['blackberry', 'berry', '#312e81', ''], ['coconut', 'coconut', '#8b5a2b', '#3b2412'], ['fig', 'pear', '#7c3aed', '#f9a8d4'],
  ['plum', 'round', '#6d28d9', ''], ['peach', 'round', '#fb9a6a', ''], ['apple_pear', 'round', '#d9c36a', ''], ['pummelo', 'citrus', '#a3e635', '#ecfccb'],
  ['cauliflower', 'head', '#e8dfb8', '#7da05a'], ['beet', 'root', '#9f1239', ''], ['celery', 'stalk', '#86efac', '#4ade80'],
  ['radish', 'root', '#e11d48', ''], ['lettuce', 'leaf', '#86efac', '#16a34a'], ['parsley', 'leaf', '#15803d', '#bbf7d0'],
  ['spinach', 'leaf', '#166534', '#86efac'], ['asparagus', 'stalk', '#4d7c0f', '#84cc16'], ['green_onion', 'stalk', '#cfe8b8', '#16a34a'],
  ['ginger', 'long', '#d6a86a', '#a16207'], ['squash', 'long', '#65a30d', '#fde68a'], ['leafy_greens', 'leaf', '#14532d', '#4ade80'],
  ['chayote', 'pear', '#a3d977', '#4d7c0f'], ['hot_pepper', 'pepper', '#ea580c', ''], ['cilantro', 'leaf', '#4ade80', '#166534'],
  ['sweet_corn', 'cob', '#facc15', '#ca8a04'], ['bok_choy', 'stalk', '#bfe3a4', '#15803d'], ['tomatillo', 'round', '#84cc16', ''],
  ['basil', 'leaf', '#22c55e', '#14532d'], ['shallot', 'bulb', '#b45309', '#fcd34d'], ['endive', 'leaf', '#d9f99d', '#84cc16'],
  ['dill', 'leaf', '#a3e635', '#3f6212'], ['pumpkin', 'ridged', '#f97316', '#c2410c'],
]

export const EXTRA_ICONS: Record<string, { bg: string; art: ReactNode }> = Object.fromEntries(
  TABLE.map(([id, kind, c, a]) => [id, { bg: mix(c, 0.82), art: art(kind, c, a) }]),
)
