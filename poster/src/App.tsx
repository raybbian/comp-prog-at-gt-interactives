import { MicroLabel, Rule } from '@cpatgt/shared';
import logoUrl from '@cpatgt/shared/assets/logo.png';
import { Hero } from './components/Hero';
import { IcpcRecord } from './components/IcpcRecord';
import { Join } from './components/Join';
import { Numbers } from './components/Numbers';
import { Placements } from './components/Placements';
import { Reveal } from './components/Reveal';
import { WhatWeDo } from './components/WhatWeDo';
import { site } from './content';
import { useFitScale } from './hooks/useFitScale';

/**
 * The poster is composed once at 1920x1080 and scaled to whatever panel it lands on,
 * so the composition that was signed off is the composition every TV shows. Nothing
 * here reflows: a poster with a responsive layout is several posters.
 */
const CANVAS = { width: 1920, height: 1080 };

export function App() {
  const scale = useFitScale(CANVAS.width, CANVAS.height);

  return (
    <div className="fixed inset-0 grid place-items-center overflow-hidden bg-ground">
      {/*
       * Two boxes, because a transform does not change an element's layout size. The
       * outer one is the canvas at its scaled size, so centring is never asked to
       * place a box wider than the screen — which clamps to the left edge and clips
       * the right — and the letterbox bars are simply whatever is left over.
       */}
      <div
        style={{
          width: `${CANVAS.width * scale}px`,
          height: `${CANVAS.height * scale}px`,
        }}
      >
        <div
          style={{
            width: `${CANVAS.width}px`,
            height: `${CANVAS.height}px`,
            transform: `scale(${scale})`,
          }}
          className="flex origin-top-left flex-col bg-ground"
        >
          <header className="flex h-[74px] shrink-0 items-center justify-between border-b border-hairline px-14">
            <div className="flex items-center gap-4">
              <img src={logoUrl} alt="" aria-hidden="true" className="size-11" />
              <MicroLabel size="lg" className="text-ink">
                {site.name}
              </MicroLabel>
            </div>
            <MicroLabel size="lg">{site.domain}</MicroLabel>
          </header>

          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col justify-between border-r border-hairline px-14 py-12">
              <Reveal delay={0}>
                <Hero />
              </Reveal>
              <Rule />
              <Reveal delay={220}>
                <WhatWeDo />
              </Reveal>
            </div>

            <aside className="flex w-[624px] shrink-0 flex-col justify-between px-14 py-12">
              <Reveal delay={380}>
                <Numbers />
              </Reveal>
              <Rule />
              <Reveal delay={500}>
                <IcpcRecord />
              </Reveal>
              <Rule />
              <Reveal delay={620}>
                <Join />
              </Reveal>
            </aside>
          </div>

          <footer className="flex h-[128px] shrink-0 items-center border-t border-hairline px-14">
            <Reveal delay={740} className="w-full">
              <Placements />
            </Reveal>
          </footer>
        </div>
      </div>
    </div>
  );
}
