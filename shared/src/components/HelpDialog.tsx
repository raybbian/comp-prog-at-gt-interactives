import { useEffect, useRef } from 'react';
import { Button } from './Button';
import { MicroLabel } from './MicroLabel';

export type HelpTopic = {
  heading: string;
  lines: readonly string[];
};

export type HelpDialogProps = {
  title: string;
  topics: readonly HelpTopic[];
  onClose: () => void;
};

/**
 * Native `<dialog>` rather than a hand-rolled overlay: Esc, the focus trap, and the
 * top layer all come for free, and the top layer is what puts it above the pinned
 * QR corner without another z-index to keep in sync.
 */
export function HelpDialog({ title, topics, onClose }: HelpDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // The dialog box is exactly its content, so a click that lands on the element
      // itself came from the backdrop around it.
      onClick={(event) => {
        if (event.target === ref.current) ref.current.close();
      }}
      className="m-auto w-[min(34rem,calc(100vw-3rem))] border border-hairline-strong
        bg-ground p-0 text-ink backdrop:bg-black/40"
    >
      <div className="flex max-h-[80dvh] flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-6">
          <MicroLabel as="h2" className="text-ink">
            {title}
          </MicroLabel>
          <Button variant="ghost" className="-mr-4" onClick={() => ref.current?.close()}>
            Close
          </Button>
        </header>

        <div className="flex flex-col gap-7 overflow-y-auto px-6 py-7">
          {topics.map((topic) => (
            <section key={topic.heading} className="flex flex-col gap-2.5">
              <MicroLabel as="h3">{topic.heading}</MicroLabel>
              {topic.lines.map((line) => (
                <p key={line} className="text-sm leading-relaxed text-ink">
                  {line}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </dialog>
  );
}
