export { cn } from './cn';
export { formatDuration } from './format';

export { ActionBar, type ActionBarProps } from './components/ActionBar';
export { AppShell, type AppShellProps } from './components/AppShell';
export { AttractScreen, type AttractScreenProps } from './components/AttractScreen';
export { BoothAttract, type BoothAttractProps } from './components/BoothAttract';
export { BoothControls, type BoothControlsProps } from './components/BoothControls';
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './components/Button';
export { DiscordQR, type DiscordQRProps } from './components/DiscordQR';
export { GameOverPanel, type GameOverPanelProps } from './components/GameOverPanel';
export { HelpDialog, type HelpDialogProps, type HelpTopic } from './components/HelpDialog';
export { Leaderboard, type LeaderboardProps } from './components/Leaderboard';
export {
  MicroLabel,
  type MicroLabelProps,
  type MicroLabelSize,
} from './components/MicroLabel';
export { Rule, type RuleProps } from './components/Rule';

export {
  useBoothSession,
  type BoothSession,
  type UseBoothSessionOptions,
} from './booth/useBoothSession';

export { useElapsed } from './hooks/useElapsed';
export { useFitScale } from './hooks/useFitScale';
export { useIdle, type UseIdleOptions } from './hooks/useIdle';
export { useMediaQuery } from './hooks/useMediaQuery';
export { usePointerKind, type PointerKind } from './hooks/usePointerKind';
export { useReducedMotion } from './hooks/useReducedMotion';

export {
  createLeaderboard,
  type Leaderboard as LeaderboardStore,
  type LeaderboardEntry,
  type LeaderboardOptions,
  type SubmittedRun,
} from './leaderboard/store';

export {
  checkName,
  normalizeName,
  MAX_NAME_LENGTH,
  type NameCheck,
} from './leaderboard/name';
