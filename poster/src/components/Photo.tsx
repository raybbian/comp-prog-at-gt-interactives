import { cn } from '@cpatgt/shared';

export type PhotoProps = {
  src: string;
  alt: string;
  className?: string;
  /** Seconds into the drift to start at. Negative values stagger a row of frames. */
  offset?: number;
};

/** A framed photograph that drifts. Framed on all four sides, like every other block. */
export function Photo({ src, alt, className, offset = 0 }: PhotoProps) {
  return (
    <div className={cn('overflow-hidden border border-hairline bg-ground-sunken', className)}>
      <img
        src={src}
        alt={alt}
        className="size-full animate-drift object-cover"
        style={{ animationDelay: `${offset}s` }}
      />
    </div>
  );
}
