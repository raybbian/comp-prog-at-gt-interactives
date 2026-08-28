import { useMediaQuery } from './useMediaQuery';

export type PointerKind = 'fine' | 'coarse';

/**
 * 'fine' means a real pointer with hover (mouse/trackpad), which lets us preview a
 * move on hover and commit on a single click. 'coarse' has no hover state, so the
 * same single tap would have to both reveal and commit the move — hence the
 * two-step confirm on touch.
 */
export function usePointerKind(): PointerKind {
  return useMediaQuery('(hover: hover) and (pointer: fine)') ? 'fine' : 'coarse';
}
