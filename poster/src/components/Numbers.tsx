import { stats } from '../content';

/**
 * Deliberately unheaded. Every other block on the poster carries a heading lifted
 * from the site, and the site's own heading for these four figures is addressed to
 * sponsors — the wrong reader for a booth. Four numbers this size need no title.
 */
export function Numbers() {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-8">
      {stats.map((stat) => (
        <div key={stat.label}>
          <p className="tnum font-mono text-[44px] font-bold leading-none tracking-tight text-ink">
            {stat.value}
          </p>
          <p className="mt-3 text-[17px] leading-[1.35] text-ink-muted">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
