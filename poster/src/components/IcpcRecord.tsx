import { MicroLabel } from '@cpatgt/shared';
import { icpcResults, icpcTitle } from '../content';

export function IcpcRecord() {
  return (
    <section>
      <MicroLabel as="h2" size="lg" className="text-ink">
        {icpcTitle}
      </MicroLabel>

      <ol className="mt-5">
        {icpcResults.map((row) => (
          <li
            key={`${row.year}-${row.contest}`}
            className="border-t border-hairline py-3 first:border-t-0 first:pt-0"
          >
            <div className="flex items-baseline gap-3">
              <span className="tnum shrink-0 font-mono text-[15px] text-ink-faint">
                {row.year}
              </span>
              <span
                className={
                  row.highlight
                    ? 'text-[18px] font-semibold tracking-tight text-ink'
                    : 'text-[18px] tracking-tight text-ink'
                }
              >
                {row.contest}
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-3 pl-[52px]">
              {/* The site stars these same two results; it is their mark, not ours. */}
              {row.highlight === true && (
                <span aria-hidden="true" className="text-[15px] text-ink">
                  ★
                </span>
              )}
              <span className="font-mono text-[15px] text-ink-muted">{row.result}</span>
              {row.teamName !== undefined && (
                <span className="truncate font-mono text-[14px] text-ink-faint">
                  {row.teamName}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
