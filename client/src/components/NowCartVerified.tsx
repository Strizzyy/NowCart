/**
 * NowCartVerified badge — shown on items that are the highest-rated,
 * most-ordered pick in their category. Inspired by Amazon's trusted-seller
 * badge: a tick shield with the NowCart green.
 */
interface Props {
  size?: 'xs' | 'sm' | 'md';
}

export default function NowCartVerified({ size = 'sm' }: Props) {
  const scales: Record<string, { shield: number; text: string; gap: string }> = {
    xs: { shield: 14, text: 'text-[9px]',  gap: 'gap-0.5' },
    sm: { shield: 16, text: 'text-[10px]', gap: 'gap-1'   },
    md: { shield: 20, text: 'text-xs',     gap: 'gap-1.5' },
  };
  const s = scales[size];

  return (
    <span
      className={`inline-flex items-center ${s.gap} bg-primary-light border border-primary/30 rounded-full px-2 py-0.5`}
      title="NowCart Verified — highest rated & most ordered in category"
    >
      {/* Shield-tick SVG — drawn inline, no external dependency */}
      <svg
        width={s.shield}
        height={s.shield}
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        {/* Shield body */}
        <path
          d="M10 2L3 5v5c0 4.418 3.134 8.211 7 9 3.866-.789 7-4.582 7-9V5L10 2z"
          fill="#3bb77e"
          fillOpacity="0.18"
          stroke="#157347"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {/* Check mark */}
        <path
          d="M7 10l2 2 4-4"
          stroke="#157347"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={`font-bold text-primary-ink leading-none ${s.text}`}>
        NowCart Verified
      </span>
    </span>
  );
}
