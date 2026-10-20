/* Ghoul Box — Undead Horoscope lists.
   APPEND-ONLY: never reorder, delete or reword the meaning of an entry, and never change a sign's slug (share links use
   ?s=<slug>&w=YYYY-Www).
   Readings are recomputed from (sign, week), so to keep old weeks replaying exactly, each week only draws from the list
   LENGTHS recorded in HR_LISTS.versions for that week. When you append entries, ALSO add a new version line with the new
   counts and a "from" week in the future (e.g. next Monday's ISO week). Old weeks keep using the old counts. */
window.HR_LISTS = {
  signs: [
    { slug: 'shallow-grave', name: 'The Shallow Grave', from: [1, 20], trait: 'Low effort, high mystery. Easily dug up, never fully gone.', ruler: 'Grave Hog\'s shovel' },
    { slug: 'coffin-nail', name: 'The Coffin Nail', from: [2, 19], trait: 'Small, sharp and holding everything together.', ruler: 'Sir Bonecrush\'s drumsticks' },
    { slug: 'moth', name: 'The Moth', from: [3, 21], trait: 'Drawn to every bright idea, porch light and bad decision.', ruler: 'The porch light' },
    { slug: 'static', name: 'The Static', from: [4, 20], trait: 'Hard to tune in, impossible to switch off.', ruler: 'Double Future Radio' },
    { slug: 'open-casket', name: 'The Open Casket', from: [5, 21], trait: 'No secrets, all feelings, great lighting.', ruler: 'Vox\'s fog machine' },
    { slug: 'crow', name: 'The Crow', from: [6, 21], trait: 'Collects shiny things and grudges. Remembers faces.', ruler: 'The old oak' },
    { slug: 'black-candle', name: 'The Black Candle', from: [7, 23], trait: 'Dramatic, warm, and slightly cursed.', ruler: 'DieAnna Graves' },
    { slug: 'rusty-shovel', name: 'The Rusty Shovel', from: [8, 23], trait: 'Hard worker. Digs deep. Occasionally too deep.', ruler: 'The night shift' },
    { slug: 'full-moon', name: 'The Full Moon', from: [9, 23], trait: 'Changes completely once a month and owns it.', ruler: 'The werewolf next door' },
    { slug: 'cursed-vhs', name: 'The Cursed VHS', from: [10, 23], trait: 'Retro, rewatchable, gives everyone seven days.', ruler: 'The video store late fee' },
    { slug: 'skeleton-key', name: 'The Skeleton Key', from: [11, 22], trait: 'Opens every door, especially the ones marked DO NOT.', ruler: 'Riff-Rot\'s toolbox' },
    { slug: 'fog-machine', name: 'The Fog Machine', from: [12, 22], trait: 'Makes every entrance legendary. Hard to see through.', ruler: 'Taz\'s energy drinks' }
  ],
  readings: [
    'Something you buried is ready to come back. Let it. It brought snacks.',
    'A door that creaked shut last month swings open this week. Walk through it like you own the haunted house.',
    'Your aura is giving "final girl." Trust your instincts and do NOT go into the basement.',
    'Mercury is in retrograde and so is your skeleton. Stretch before you rise from the grave.',
    'The fog is thick, but your path is clear: say yes to the weird invitation.',
    'Someone is talking about you behind your tombstone. It\'s all compliments, mostly.',
    'This week favors loud music and louder opinions. The neighbors will survive. Probably.',
    'Your energy is a power chord in an empty church. Use it wisely.',
    'Rest is coming. Not the eternal kind, the nap kind. Take it.',
    'A small creature will cross your path. Respect it. It may be someone\'s grandma.',
    'Spending is risky this week. Except on horror merch. That\'s an investment.',
    'You will receive a message at 3:33 AM. It\'s spam, but spooky spam.',
    'A corporate voice will ask you to stay calm and comply. Turn the volume knob instead.',
    'Old friends resurface like zombies in the third act. Hug them. Check for bites.',
    'Your love life is a candle in a windy crypt: flickering, dramatic, still lit.',
    'The stars are aligned. The skeletons are not. Choose the skeletons.',
    'A plot twist arrives midweek. Act surprised. You saw it coming.',
    'Your luck is buried six feet under. Grab a shovel; it\'s worth digging up.',
    'You are the main character this week. Unfortunately it\'s a horror movie. Stay near the exit.',
    'A cursed object will try to follow you home. Let it in only if it can do dishes.',
    'Creativity spikes on Thursday. Write the song, draw the monster, start the band.',
    'Avoid splitting up from the group. This applies to group chats too.',
    'Your past self left you a note. It says "drink water." Listen to them.',
    'Something is scratching at the window of opportunity. Open it (the window, not the coffin).',
    'Your chaos is contagious this week. Spread it responsibly.',
    'An encore is coming. Save some energy for the last song.',
    'The dead are restless and so are you. Go for a long, spooky walk.',
    'A beige week tries to happen. Refuse. Wear the loud jacket.',
    'The universe is shuffling your playlist. Every skip is a sign. Skip nothing.',
    'Someone needs your weird advice. Give it. It will work.'
  ],
  haunts: ['an abandoned drive-in', 'the 24-hour diner at 3 AM', 'a creaky attic', 'the back row of a horror double feature', 'a fog-filled cemetery',
    'the video store\'s horror aisle', 'a thrift store mannequin corner', 'a roller rink after closing', 'Grave Hog\'s coffin shack', 'a haunted mall food court',
    'the Graveyard Gazette darkroom', 'a moonlit parking garage', 'a basement show with one working light', 'an empty laundromat', 'a pumpkin patch at dusk',
    'the last booth at the arcade', 'a library\'s restricted section', 'the Double Future Radio broadcast booth', 'a dusty music shop', 'your own porch, with the lights off'],
  avoid: ['NeuraNest software updates', 'anyone in a crisp white suit', 'reading Latin out loud', 'mirrors that blink first', 'the phrase "quick meeting"',
    'beige paint samples', 'splitting up the group', 'suspiciously cheap houses', 'dolls that sit up on their own', 'saying "I\'ll be right back"',
    'motivational posters', 'elevators in old hotels', 'Terms & Conditions', 'V1SION\'s "This Is the Cure"', 'unlabeled VHS tapes (watch them anyway)',
    'strangers asking for your password', 'mandatory fun', 'the last slice of pizza', 'basements after 9 PM', 'Taz\'s next "great idea"'],
  albums: ['The JURN', 'Second Dose', 'Third Strike', 'Four Score', 'Fear the Fifth'],
  eras: ['the First Transmission era, played loud', 'the deep cuts, at 3 AM', 'on repeat while you clean the crypt', 'in the car with the windows down',
    'from front to back, no skipping', 'the B-sides, headphones on', 'at a volume the neighbors can feel', 'as a Double Future Radio rebroadcast',
    'on a dusty cassette', 'during a thunderstorm, lights off'],
  /* Week-by-week list lengths (see header). Add a new line whenever you append to any list above. */
  versions: [
    { from: '2026-W01', n: { readings: 30, haunts: 20, avoid: 20, albums: 5, eras: 10 } }
  ]
};
