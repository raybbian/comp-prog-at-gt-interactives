import { cn } from '../cn';

export type RuleProps = {
  className?: string;
};

/** A 1px hairline. Structure in this system comes from rules, not shadows. */
export function Rule({ className }: RuleProps) {
  return <div role="presentation" className={cn('h-px w-full bg-hairline', className)} />;
}
