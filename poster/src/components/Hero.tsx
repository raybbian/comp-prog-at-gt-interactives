import { useReducedMotion } from '@cpatgt/shared';
import { site } from '../content';
import { useTypewriter } from '../hooks/useTypewriter';

export function Hero() {
  const shown = useTypewriter(site.command, !useReducedMotion());

  return (
    <div>
      {/* Accent is spent here and on the QR block, and nowhere else: on a poster the
          visitor's one pending action is joining, so that is what ochre marks. */}
      {/* Fixed height: the text span collapses to nothing at the bottom of the erase,
          and without a height here the whole column below would jump up with it. */}
      <p className="flex h-[32px] items-center gap-2 font-mono text-[22px] text-accent">
        <span>{site.command.slice(0, shown)}</span>
        <span
          aria-hidden="true"
          className="inline-block h-[24px] w-[11px] shrink-0 animate-caret bg-accent"
        />
      </p>

      <h1 className="mt-5 text-[72px] font-bold leading-[1.04] tracking-tight text-ink">
        <span className="block">Competitive Programming</span>
        <span className="block text-ink-muted">@ Georgia Tech</span>
      </h1>

      <p className="mt-6 max-w-[1000px] text-[23px] leading-[1.5] text-ink-muted">{site.lede}</p>
    </div>
  );
}
