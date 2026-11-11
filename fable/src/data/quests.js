// Quest definitions. `text(stage, S)` returns the HUD line for the current stage.
const count = (S) => ['hollow', 'pip', 'zip', 'waffle', 'june'].filter((id) => S.roster.includes(id)).length;

export const QUESTS = {
  five: {
    main: true, title: 'Find five people willing to play',
    text: (stage, S) => {
      const n = count(S);
      if (stage === 0) return 'Check out the clubhouse you inherited.';
      if (n >= 5) return 'You have a team! Talk to Coach Hollow at the clubhouse.';
      const hints = [];
      if (!S.roster.includes('pip')) hints.push('a possum stuck on a roof in Backyard Borough');
      if (!S.roster.includes('zip')) hints.push('a rabbit at the Borough block party');
      if (!S.roster.includes('waffle')) hints.push('the cook at the diner');
      if (!S.roster.includes('june') && n >= 4) hints.push('something fluttering at the clubhouse porch light');
      return `Recruits: ${n}/5 — look for ${hints[0] || 'one more player'}.`;
    },
  },
  first_match: {
    main: true, title: 'The Crooked Field',
    steps: [
      'Rest up, then challenge the Cul-de-Sac Gnomes at the crooked field in Backyard Borough.',
      'Beat the Cul-de-Sac Gnomes!',
      'Head back to Huddle Hollow. Something is glowing at the old stadium.',
    ],
  },
  welcome_back: {
    main: true, title: 'Welcome Back, Captain',
    steps: [
      'Look at the scoreboard at the abandoned stadium.',
      'Ask Coach Hollow what the scoreboard means.',
      'Talk to Gus at the bus stop to reach Harvest Fairgrounds.',
    ],
  },
  fair: {
    main: true, title: 'The Harvest Haymakers',
    steps: [
      'Explore Harvest Fairgrounds and find the Haymakers\' field past the corn maze.',
      'Beat the Harvest Haymakers!',
      'Report back to Coach Hollow.',
    ],
  },
  frost: {
    main: true, title: 'The Falls Flurries',
    steps: [
      'Take the bus to Frostbite Falls and cross the frozen river.',
      'Beat the Falls Flurries!',
      'Report back to Coach Hollow.',
    ],
  },
  neon: {
    main: true, title: 'The Boardwalk Buzzers',
    steps: [
      'Take the bus to Neon Boardwalk and find a way into the Buzzer Dome.',
      'Beat the Boardwalk Buzzers!',
      'Report back to Coach Hollow.',
    ],
  },
  bowl: {
    main: true, title: 'The Midnight Bowl',
    steps: [
      'Raise the stadium to Level 2 at the town notice board, then wait for sunset.',
      'After dark, enter the stadium. The Midnight Bowl is waiting.',
      'Finish the game that never ended.',
      'You did it, Captain.',
    ],
  },
  // ---- side quests
  rebuild: { title: 'Fixer-Upper', steps: ['Use the notice board in the town square to rebuild Huddle Hollow.'] },
  argue: { title: 'Settle It Off The Field', steps: ['Pip and Zip are arguing in the diner booth. Go hear them out.'] },
  lights: { title: 'Midnight Maintenance', steps: ['After dark, fix the stadium lights (talk to the fuse box by the stadium gate).'] },
  blitz: { title: 'Backyard Blitz', steps: ['Challenge the Acorn twins to Backyard Blitz in the Borough.'] },
  fishing: { title: 'Gone Fishin\'', steps: ['Old Croaker by the pond might lend you a rod.'] },
};
