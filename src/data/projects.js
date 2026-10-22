// ─────────────────────────────────────────────────────────────
//  ALL PROJECTS LIVE HERE.
//  To add one: copy a block, change the fields, save. That's it.
//  The "more coming soon" card is added automatically at the end.
//
//  name         project title
//  url          where the card links (opens in a new tab)
//  icon         path to an image in /public (e.g. '/projects/my-thing.png')
//               leave it out and the card shows the first letter instead
//  description  one or two short sentences
//  tags         a few short words
//  status       'live' | 'beta' | 'wip'
// ─────────────────────────────────────────────────────────────

export const projects = [
  {
    name: 'Orbs AI',
    url: 'https://orbsai.app',
    icon: '/projects/orbsai.ico',
    description: 'A chat site where you talk to multiple AI orbs at once.',
    tags: ['web', 'ai', 'chat'],
    status: 'live'
  }
];

// ─────────────────────────────────────────────────────────────
//  SMALL PROJECTS: toys, experiments, one-page things.
//  Same idea: copy a block, change the fields, save.
//
//  name         title (shown in italic serif)
//  url          where the card links (opens in a new tab)
//  image        a screenshot in /public, ideally 16:9 (e.g. '/projects/thing.jpg')
//  description  one short sentence
//  tags         a few short words
// ─────────────────────────────────────────────────────────────

export const smallProjects = [
  {
    name: 'Jelly / Dice',
    url: 'https://theabyssme.com/jellydice',
    image: '/projects/jellydice.jpg',
    description: 'Gummy dice with real physics. Throw them, poke them, watch them wobble.',
    tags: ['webgl', 'toy']
  }
];
