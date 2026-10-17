/* Ghoul Box — Horror Punk Band Name Generator word lists.
   APPEND-ONLY: shared links store list indices, so never reorder or delete entries (add new ones at the end).
   All original; checked against BLOCKLIST below so no real band names come out. */
window.BN_WORDS = {
  adj: ['Rotten','Radioactive','Haunted','Undead','Cursed','Mutant','Embalmed','Moldy','Feral','Glow-in-the-Dark',
    'Exhumed','Possessed','Unholy','Disgruntled','Overcaffeinated','Slimy','Bloodshot','Gutless','Spooky','Leaky',
    'Moonlit','Haggard','Unlicensed','Bootleg','Neon','Sewer-Born','Toxic','Freeze-Dried','Unfriendly','Cryptic',
    'Petrified','Mummified','Hellbound','Unsupervised','Reanimated','Discount','Half-Buried','Vengeful','Midnight','Graveyard',
    'Overdue','Shrieking','Clammy','Velvet','Pickled','Feverish','Sinister','Lumpy','Electric','Hollow',
    'Fog-Machine','Kinda Evil','Mostly Dead','Unemployed','Tax-Exempt','Off-Brand','Tormented','Cranky','Ectoplasmic','Bargain-Bin'],
  noun: ['Coffin','Casket','Ghoul','Zombie','Skull','Femur','Tombstone','Crypt','Werewolf','Mummy',
    'Vampire','Banshee','Gargoyle','Corpse','Phantom','Ghost','Witch','Goblin','Mutant','Cadaver',
    'Hearse','Mausoleum','Pumpkin','Tarantula','Leech','Maggot','Kneecap','Jawbone','Ribcage','Eyeball',
    'Gravedigger','Undertaker','Hellhound','Swamp Thing','Possum','Raccoon','Pizza','Lunchbox','Toaster','Taxidermist',
    'Bowling Ball','Lava Lamp','Mixtape','VHS','Moped','Accordion','Lawn Gnome','Mall Cop','Lunch Lady','Crossing Guard',
    'Sewer Rat','Turtle','Chainsaw','Ouija Board','Candelabra','Butler','Hand','Cousin','Séance','Fog Machine'],
  plural: ['Ghouls','Corpses','Coffin Kids','Grave Dentists','Lawn Zombies','Bone Bandits','Crypt Janitors','Tomb Raiders of Ohio','Casket Kittens','Wolfmen',
    'Mummies','Leeches','Banshees','Goblins','Werewolves','Skeletons','Gravediggers','Zombies','Phantoms','Hellcats',
    'Swamp Creatures','Sewer Dwellers','Mutants','Gargoyles','Cadavers','Undertakers','Maggots','Pallbearers','Exorcists','Necromancers',
    'Possums','Cousins','Lunch Ladies','Hall Monitors','Substitute Teachers','Mall Rats','Mall Cops','Accountants','Orthodontists','Lifeguards',
    'Crossing Guards','Dentists','Babysitters','Paperboys','Weathermen','Eyeballs','Kneecaps','Femurs','Jawbones','Ribcages',
    'Butlers','Hearses','Lava Lamps','Mixtapes','Pizza Rats','Space Truckers','Night Owls','Spare Ribs','Bad Omens','Trick-or-Treaters'],
  verb: ['Embalm','Exhume','Haunt','Resurrect','Bury','Possess','Devour','Mosh','Scream','Shamble',
    'Slam-Dance','Moonwalk','Hex','Curse','Bite','Rattle','Howl','Dig Up','Reanimate','Ghost'],
  place: ['the Graveyard','the Morgue','Crypt 13','the Sewer','the Laundromat','the Roller Rink','the Mall Food Court','Lake Bloodwater','Camp Kill-a-Lot','the Drive-In',
    'the Mausoleum','the Bowling Alley','the Pit Stop','Amityville','the Graveyard Dimension','the Swamp','the Haunted Arcade','Room 666','the Basement','the Hearse',
    'the Pumpkin Patch','the Funeral Home','the Video Store','Grandma\'s Attic','the Abandoned Mall','the Gas Station','Planet Zombo','the Wax Museum','the Cul-de-Sac','the Cemetery Gates'],
  name: ['Wanda Wolfsbane','Count Chad','Dr. Femur','Little Lurch','Baron Von Skeeve','Grandpa Rot','Mama Coffin','Ricky Ribcage','Sister Séance','Uncle Embalm',
    'Cousin Creepers','Johnny Jawbone','Lady Leech','Vinnie Vomit','Captain Cadaver','DJ Dirt Nap','Tina Tombstone','Big Mausoleum Mike','Ghoulia','Professor Plasm'],
  num: ['13','666','7','99','3','1986','1313','1999','4','2'],
  /* name templates: tokens in {braces} */
  nameT: [
    'The {adj} {plural}', '{noun} {plural}', 'The {plural} of {place}', '{adj} {noun}', '{name} and the {plural}',
    '{noun} Party {num}', 'The {noun} {num}', '{adj} {noun} Brigade', 'Teenage {adj} {plural}', 'The {noun} Club',
    '{name} & The {adj} {plural}', '{noun}-O-Rama', 'Dead {noun} Society', 'The Night {noun}', '{num} {adj} {plural}',
    'Mutant {noun} Patrol', '{noun} Dimension', 'The {adj} {noun}s', 'Club {noun}', 'Return of the {adj} {plural}'
  ],
  albumT: [
    'Songs to {verb} Your {noun} To', 'Live at {place}', '{verb} Me Gently', 'Greatest Hits (Vol. {num})', 'Night of the {adj} {noun}',
    'Welcome to {place}', 'My {noun} Is {adj}', '{adj} and Loving It', 'Do Not {verb} After Midnight', 'Return to {place}',
    'Unplugged in {place}', 'Party at {place}', 'I Was a Teenage {noun}', 'Keep Your Ribs Open', 'The {noun} Tapes',
    'Coffin Break', 'Graveyard Shift Vol. {num}', 'Bad Day at {place}', '{num} {plural} Can\'t Be Wrong', 'Postcards from {place}',
    'Totally {adj}', 'Rest in Pieces (Deluxe Edition)', 'Dawn of the {adj}', 'Attack of the {num} Ft. {noun}', 'Tales from {place}'
  ],
  genre: ['Horror Punk','Psychobilly','Deathrock','Goth Punk','Ghoulabilly','Surf Horror','Crypt-Core','Skate Horror','Monster Rock','B-Movie Hardcore',
    'Coffin Pop','Zombie Ska','Synth Horror','VHS-Wave','Garage Ghoul','Swamp Rock','Deathbilly','Cowpunk from Hell','Cemetery New Wave','Sewer Punk',
    'Pizza Thrash','Spooky Surf','Graveyard Glam','Necro Hair Metal','Cartoon Doom','Mall Goth Pop','Haunted Doo-Wop','Ectoplasm Funk','Cryptwave','Drive-In Punk']
};
/* Real-world band names we must never output (lower-case). The generator re-rolls if any match. */
window.BN_BLOCKLIST = ['the misfits','misfits','the cramps','the damned','samhain','danzig','calabrese','nekromantix','the meteors','christian death',
  'bauhaus','mad sin','ghoul','the ghouls','wednesday 13','murderdolls','blitzkid','koffin kats','tiger army','horrorpops',
  'the creepshow','demented are go','frankenstein drag queens','ghoultown','the other','balzac','the spook','zombie ghost train','the brains','the coffin draggers',
  'the deadites','the mummies','the phantom surfers','the gravediggaz','gravediggaz','the vampires','the zombies','the ghosts','skeletons','the skeletons',
  'the goblins','goblin','the werewolves','the hellcats','the necromancers','the undertakers','the mutants','gargoyles','the gargoyles','the cadavers',
  'night of the living dead','the lunachicks','alkaline trio','cancerslug','the independents','the 69 eyes','the sisters of mercy','the cure','the birthday party','45 grave',
  'tsol','t.s.o.l.','the nomads','the grave robbers','grave robber','the body snatchers','bodysnatchers','the leeches','crypt kickers','the night crawlers'];
