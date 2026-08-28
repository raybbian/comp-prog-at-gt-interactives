import { DiscordQR } from './DiscordQR';

/**
 * Pinned to the bottom-right corner of every screen, above the attract overlay so
 * it stays put through every game state. Framed on two sides so it reads as part of
 * the rail system rather than something floating on top of the page.
 */
export function DiscordCorner() {
  return (
    <div className="fixed right-0 bottom-0 z-[60] border-t border-l border-hairline bg-ground p-4">
      <DiscordQR className="w-24" />
    </div>
  );
}
