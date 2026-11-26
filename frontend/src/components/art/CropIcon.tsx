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
  potato: {
    bg: '#fef3c7',
    art: (<><ellipse cx="24" cy="26" rx="16" ry="12" fill="#b9854a" transform="rotate(-15 24 26)" /><circle cx="18" cy="24" r="1.6" fill="#8a5d2b" /><circle cx="27" cy="29" r="1.6" fill="#8a5d2b" /><circle cx="30" cy="22" r="1.6" fill="#8a5d2b" /></>),
  },
  sweet_potato: {
    bg: '#ffedd5',
    art: (<><path d="M8 30 q4 -14 18 -14 q14 0 14 8 q-2 10 -16 10 q-12 0 -16 -4z" fill="#c2562b" /><path d="M14 28 q8 -6 20 -4" stroke="#e8946a" strokeWidth="1.6" fill="none" strokeLinecap="round" /></>),
  },
  mushroom: {
    bg: '#f5f5f4',
    art: (<><path d="M8 26 q16 -22 32 0z" fill="#a8744f" /><rect x="19" y="26" width="10" height="12" rx="4" fill="#f1e6d6" /><circle cx="18" cy="21" r="2" fill="#f1e6d6" /><circle cx="28" cy="18" r="2" fill="#f1e6d6" /></>),
  },
  bell_pepper: {
    bg: '#fee2e2',
    art: (<><path d="M13 20 q-2 -6 6 -5 q5 -3 10 0 q8 -1 6 5 q2 14 -11 19 q-13 -5 -11 -19z" fill="#e11d48" /><path d="M24 15 v-6" stroke={LEAF} strokeWidth="3.2" strokeLinecap="round" /></>),
  },
  carrot: {
    bg: '#ffedd5',
    art: (<><path d="M14 16 q14 -6 20 6 q-4 10 -22 22 q-4 -16 2 -28z" fill="#ea7a1a" /><path d="M16 12 q-4 -6 -2 -8 M20 11 q0 -7 3 -8 M24 12 q4 -6 7 -4" stroke={LEAF} strokeWidth="3" fill="none" strokeLinecap="round" /></>),
  },
  cucumber: {
    bg: '#dcfce7',
    art: (<><rect x="6" y="18" width="36" height="13" rx="6.5" fill="#2f8f3a" transform="rotate(-18 24 24)" /><g fill="#7fcf88">{[14, 22, 30].map((x) => <circle key={x} cx={x} cy={24 - (x - 24) * 0.32} r="1.3" />)}</g></>),
  },
  garlic: {
    bg: '#f5f5f4',
    art: (<><path d="M24 10 q-4 6 -12 12 q-4 12 12 18 q16 -6 12 -18 q-8 -6 -12 -12z" fill="#f8f5ee" stroke="#d6cfbf" strokeWidth="1.5" /><path d="M24 11 q-6 12 0 28 M24 11 q6 12 0 28" stroke="#d6cfbf" strokeWidth="1.4" fill="none" /></>),
  },
  cabbage: {
    bg: '#ecfccb',
    art: (<><circle cx="24" cy="25" r="15" fill="#7cc576" /><path d="M24 10 q-9 14 0 30 M24 10 q9 14 0 30 M10 24 q14 6 28 0" stroke="#bfe6b6" strokeWidth="1.6" fill="none" /></>),
  },
  eggplant: {
    bg: '#f3e8ff',
    art: (<><path d="M14 18 q-4 12 6 20 q12 6 18 -6 q2 -10 -10 -16z" fill="#6d28d9" /><path d="M14 18 q4 -8 12 -6 q-2 4 -4 6z" fill={LEAF} /></>),
  },
  broccoli: {
    bg: '#dcfce7',
    art: (<><rect x="21" y="26" width="6" height="14" rx="2" fill="#8bbf6a" /><circle cx="16" cy="22" r="7" fill="#2f8f3a" /><circle cx="24" cy="16" r="8" fill="#2f8f3a" /><circle cx="32" cy="22" r="7" fill="#2f8f3a" /></>),
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
