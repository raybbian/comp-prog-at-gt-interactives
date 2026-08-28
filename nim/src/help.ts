import type { HelpTopic } from '@cpatgt/shared';

export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    heading: 'How to Play',
    lines: [
      'There are 3 rows of stones, with varying number of stones.',
      'You choose one row of stones, and take any number of stones from that row.',
      'Your opponent then does the same, choosing a row and taking any number of stones from that row.',
      'Whoever takes the last stone wins.',
    ],
  },
  {
    heading: 'Hint',
    lines: [
      'The hint button shows you one good move, if you are stuck!',
    ],
  },
];
