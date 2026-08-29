/*
 * Every word and picture on the poster comes from competitiveprogrammingatgt.com.
 * Nothing here is written for the poster: each block below records the file in the
 * website repo it was transcribed from, so a claim on a booth TV can always be
 * traced back to the page that already makes it in public. When the site changes,
 * re-transcribe from the source named above the block rather than editing prose
 * here — and re-run scripts/import-assets.mjs for the photography.
 */

import competitionPhoto from './assets/competition.jpg';
import lecturePhoto from './assets/lecture.jpg';
import practicePhoto from './assets/practice.jpg';
import amazonLogo from './assets/logos/amazon.svg';
import citadelLogo from './assets/logos/citadel.svg';
import googleLogo from './assets/logos/google.svg';
import hrtLogo from './assets/logos/hrt.svg';
import janeStreetLogo from './assets/logos/jane-street.svg';
import optiverLogo from './assets/logos/optiver.svg';

/* src/data/site.ts and src/sections/Hero.tsx */
export const site = {
  name: 'Competitive Programming @ Georgia Tech',
  domain: 'competitiveprogrammingatgt.com',
  command: '$ ./join --club competitive-programming',
  lede: 'We are a community of Yellow Jackets who love solving competitive programming problems! We are open to any skill levels: find out more about us below.',
  discordHandle: 'discord.gg/5X7UVThEhJ',
  instagram: 'instagram.com/gtcompetitiveprogramming',
  codeforces: 'codeforces.com/group/j7YsoIFtw4',
} as const;

/* src/sections/About.tsx — heading, subtitle, and the three feature cards. */
export const about = {
  title: 'What we do',
  subtitle:
    'We are a community that aims to provide a place for competitive programmers to collaborate, discuss and solve problems, regardless of their skill level!',
  features: [
    {
      title: 'Weekly practices',
      photo: practicePhoto,
      text: 'Come solve problems and eat pizza with us at weekend practices! We organize a 4-5 hour mock ICPC competitions, where you will be able to solve problems with your friends and discuss them after!',
    },
    {
      title: 'Lectures & workshops',
      photo: lecturePhoto,
      text: 'Our officers will lead deep dives into a variety of beginner-friendly algorithms and data structures, including topics like dynamic programming, graphs, flows, strings, greedy, etc.',
    },
    {
      title: 'Competition',
      photo: competitionPhoto,
      text: 'Competitive Programming at Tech also organizes team selection for the Inter-Collegiate Programming Competition! We typically host tryouts for regionals in October, with the competition occuring in early November.',
    },
  ],
} as const;

/* src/data/sponsorship.ts — `sponsorStats`. */
export const stats = [
  { value: '100+', label: 'Active members every year' },
  { value: '5 of 6', label: 'Recent years at the ICPC World Finals' },
  { value: '1st–2nd', label: 'Among universities in the southern USA' },
  { value: '13th', label: 'Best recent World Finals placement' },
] as const;

/* src/sections/Icpc.tsx — section heading. */
export const icpcTitle = 'Georgia Tech at the ICPC';

/*
 * src/data/icpc.ts — the four most recent entries, kept in the site's order and
 * wording. `highlight` is the site's own star, not a judgement made here.
 */
export type IcpcRow = {
  year: number;
  contest: string;
  teamName?: string;
  result: string;
  highlight?: boolean;
};

export const icpcResults: IcpcRow[] = [
  {
    year: 2026,
    contest: 'ICPC World Finals — Dubai',
    result: 'Qualified',
    highlight: true,
  },
  {
    year: 2026,
    contest: 'North America Championship',
    result: '7th place · Bronze medal',
  },
  {
    year: 2025,
    contest: '49th ICPC World Finals — Baku',
    teamName: 'GT Iridescent',
    result: '49th place',
  },
  {
    year: 2024,
    contest: '46th ICPC World Finals — Luxor',
    teamName: 'Days of Future Past',
    result: '13th place',
    highlight: true,
  },
];

/*
 * src/sections/Placements.tsx and src/data/companies.ts. Radix Trading ships no
 * logo file on the site and renders as a wordmark there, so it does the same here.
 */
export const placements = {
  title: 'Where members end up',
  note: '… in addition to many more.',
} as const;

export const companies: Array<{ name: string; logo?: string }> = [
  { name: 'Jane Street', logo: janeStreetLogo },
  { name: 'Radix Trading' },
  { name: 'Google', logo: googleLogo },
  { name: 'Amazon', logo: amazonLogo },
  { name: 'Optiver', logo: optiverLogo },
  { name: 'Citadel', logo: citadelLogo },
  { name: 'Hudson River Trading', logo: hrtLogo },
];
