import { DiscordQR, MicroLabel } from '@cpatgt/shared';
import { site } from '../content';

const LINKS = [site.discordHandle, site.instagram, site.codeforces];

export function Join() {
  return (
    <section className="flex items-center gap-7">
      {/* Not a link, and nothing to click — see DiscordQR. It is for pointing a phone at. */}
      <DiscordQR className="w-[132px] shrink-0" />

      <div className="min-w-0">
        <MicroLabel
          size="lg"
          as="h2"
          className="animate-[pulse-label_3s_ease-in-out_infinite] text-accent"
        >
          Join the Discord
        </MicroLabel>
        <ul className="mt-4 space-y-1.5">
          {LINKS.map((link) => (
            <li key={link} className="truncate font-mono text-[15px] text-ink-muted">
              {link}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
