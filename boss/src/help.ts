import type { HelpTopic } from '@cpatgt/shared';

export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    heading: 'How to Play',
    lines: [
      'The boss has some health. You and the bot take turns hitting it, and you hit first.',
      'A hit deals any whole amount of damage from 1 up to the limit shown on the pad.',
      'You cannot deal the same amount the bot just dealt, and the bot cannot repeat yours. The first hit of the game is free.',
      'Whoever brings the health to zero or below wins.',
    ],
  },
  {
    heading: 'Levels',
    lines: [
      'Easy, Medium and Hard change the damage limit, and nothing else.',
      'Every game can be won. The bot never makes a mistake, so if you lose, there was a better hit somewhere.',
    ],
  },
];
