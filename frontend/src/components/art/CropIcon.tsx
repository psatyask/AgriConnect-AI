/** Simple original crop icons, keyed by canonical commodity id. Decorative: the name is always shown as text. */
const LEAF = '#3f8f3a'

const ICONS: Record<string, { bg: string; art: React.ReactNode }> = {
  tomato: {
    bg: '#fee2e2',
    art: (<><circle cx="24" cy="27" r="13" fill="#dc2626" /><path d="M14 17 q10 -6 20 0 q-4 5 -10 4 q-6 1 -10 -4z" fill={LEAF} /></>),
  },
  onion: {
    bg: '#f3e8ff',
    art: (<><path d="M24 12 q16 8 14 20 q-3 8 -14 8 q-11 0 -14 -8 q-2 -12 14 -20z" fill="#a855f7" /><path d="M24 12 v-6" stroke={LEAF} strokeWidth="3" strokeLinecap="round" /><path d="M24 14 q-6 8 -4 24 M24 14 q6 8 4 24" stroke="#e9d5ff" strokeWidth="1.5" fill="none" /></>),
  },
  rice: {
    bg: '#fef9c3',
    art: (<><path d="M24 40 V14" stroke={LEAF} strokeWidth="2.5" /><path d="M24 14 q-14 -2 -16 12 M24 14 q12 -4 16 8" stroke="#a16207" strokeWidth="3" fill="none" strokeLinecap="round" /><circle cx="14" cy="26" r="2.6" fill="#e9d38a" /><circle cx="34" cy="22" r="2.6" fill="#e9d38a" /><circle cx="24" cy="20" r="2.6" fill="#e9d38a" /></>),
  },
  chilli: {
    bg: '#ffe4e6',
    art: (<><path d="M14 14 q22 0 20 22 q-1 6 -4 4 q2 -14 -16 -18z" fill="#b91c1c" /><path d="M14 14 q-4 -4 -2 -8" stroke={LEAF} strokeWidth="3" fill="none" strokeLinecap="round" /></>),
  },
  maize: {
    bg: '#fef3c7',
    art: (<><ellipse cx="24" cy="26" rx="8" ry="15" fill="#eab308" />{[18, 24, 30].map((y) => <line key={y} x1="17" y1={y} x2="31" y2={y} stroke="#ca8a04" strokeWidth="1.2" />)}<path d="M16 14 q-10 12 2 28 q4 -14 6 -22z M32 14 q10 12 -2 28 q-4 -14 -6 -22z" fill={LEAF} opacity=".9" /></>),
  },
  soybeans: {
    bg: '#ecfccb',
    art: (<><path d="M8 30 q8 -16 32 -10 q-4 18 -32 10z" fill="#84cc16" /><circle cx="17" cy="27" r="3.4" fill="#d6c27a" /><circle cx="25" cy="25" r="3.4" fill="#d6c27a" /><circle cx="33" cy="24" r="3.4" fill="#d6c27a" /></>),
  },
  wheat: {
    bg: '#fef3c7',
    art: (<><path d="M24 42 V10" stroke="#a16207" strokeWidth="2.5" />{[12, 19, 26].map((y) => (<g key={y}><ellipse cx="18" cy={y} rx="3.4" ry="6" fill="#ca8a04" transform={`rotate(-30 18 ${y})`} /><ellipse cx="30" cy={y} rx="3.4" ry="6" fill="#ca8a04" transform={`rotate(30 30 ${y})`} /></g>))}</>),
  },
}

/** US "corn" and India "maize" are the same crop and share one drawing. */
ICONS.corn = ICONS.maize

export function cropBg(id: string): string {
  return ICONS[id]?.bg ?? '#e5e7eb'
}

export default function CropIcon({ id, size = 48 }: { id: string; size?: number }) {
  const icon = ICONS[id]
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="12" fill={cropBg(id)} />
      {icon?.art ?? <circle cx="24" cy="24" r="10" fill={LEAF} />}
    </svg>
  )
}
