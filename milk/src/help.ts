import type { HelpTopic } from '@cpatgt/shared';

export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    heading: 'The problem',
    lines: [
      'Farmer John has twenty buckets of milk from his cows, lined up in a row. He has just been told that one of them is contaminated and is no longer safe to drink!',
      'He has test kits. A kit can take samples from as many buckets as he likes at once, and comes back saying whether the contaminated milk was among them. Once a kit has been used on a sample, it cannot be used again. Due to how the test kits are engineered, all of them must be used at the same time!',
      'How many test kits does Farmer John need to know which bucket it is?',
    ],
  },
];
