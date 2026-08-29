import { MicroLabel } from '@cpatgt/shared';
import { companies, placements } from '../content';

/**
 * The wordmarks are the companies' own artwork, drawn in their own dark inks for a
 * light background — the site sets them on a pale tile for exactly this reason. So
 * the tile is a fixed light value rather than a theme token: in dark mode a themed
 * tile would swallow half of them.
 */
const TILE = 'bg-[#faf9f7] border border-hairline';

export function Placements() {
  return (
    <div className="flex items-center gap-12">
      <div className="w-[260px] shrink-0">
        <MicroLabel as="h2" size="lg" className="text-ink">
          {placements.title}
        </MicroLabel>
        <p className="mt-2.5 text-[15px] text-ink-faint">{placements.note}</p>
      </div>

      <ul className="flex flex-1 items-stretch gap-4">
        {companies.map((company) => (
          <li
            key={company.name}
            className={`flex h-[78px] flex-1 items-center justify-center px-6 ${TILE}`}
          >
            {company.logo === undefined ? (
              <span className="text-center font-mono text-[17px] font-bold tracking-tight text-[#16150f]">
                {company.name}
              </span>
            ) : (
              <img
                src={company.logo}
                alt={`${company.name} logo`}
                className="max-h-[38px] w-auto max-w-[85%]"
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
