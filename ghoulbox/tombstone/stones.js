/* Ghoul Box — Tombstone Maker config + random wording.
   TS_CONFIG is rewritten by tools/make_tombstones.py (keep the LAYOUT/END markers). "crop" is the 4:5 portrait window
   (fractions of the 1792x1008 originals) that make_tombstones.py cuts around the stone. Box values are fractions of the
   CROPPED image (x, y = top-left of the carving area; w, h = size). "overrides" maps a stone number to its own box.
   Measured 2026-10-17: in all 10 originals the stone spans x 40.6-59.5%, arch top y 31.3%, shoulders 39.8%, base 85.5%.
   Stone numbers 1..count are used in share links (?s=), so never reorder or remove backgrounds; add new ones at the end.
   While "ready" is false (art not processed yet) the tool draws procedural stones instead of the photo backgrounds. */
window.TS_CONFIG = /*LAYOUT*/{"ready": true, "count": 10, "crop": {"x": 0.275, "y": 0, "w": 0.45, "h": 1}, "box": {"x": 0.344, "y": 0.37, "w": 0.311, "h": 0.41}, "overrides": {}}/*END*/;
/* Random-button wording. These only fill the text boxes (links store the text itself), so editing is safe. */
window.TS_RANDOM = {
  names: ['Count Snackula', 'Ghoulie McGraveface', 'Barry D. Alive', 'Ima Goner', 'Dee Composed', 'Morty Fied', 'Phil Graves',
    'Rick O\'Mortis', 'Paul Bearer', 'Anita Coffin', 'Rusty Nails', 'Cass Kett', 'Lady Formaldehyde', 'Sir Spooksalot',
    'Vinnie Vampiro', 'Moe Selium', 'Crypt Keeper Kevin', 'Bonnie Marrow', 'Lil Ectoplasm', 'Duke of Dread'],
  born: ['1986', '1313', 'Friday the 13th', 'Halloween \'85', 'The Year of the VHS', 'Before Cable', 'Last Thursday', 'Midnight',
    'The \'80s (All of Them)', 'Prom Night \'87', 'A Dark & Stormy Night', 'Second Dose Era', 'The Graveyard Shift'],
  died: ['Next Tuesday', 'Too Soon', 'Not Yet (Allegedly)', 'Mid-Sentence', 'During the Guitar Solo', 'Opening Night', 'Before the Encore',
    'On a Monday, Obviously', 'Halfway Through the Movie', 'After the Credits', 'Last Call', 'The Double Future', 'Fear the Fifth Day'],
  causes: ['Said "I\'ll be right back"', 'Investigated the strange noise', 'Split up to cover more ground', 'Ate gas station sushi at 3 AM',
    'Taz\'s "great idea"', 'Riff-Rot\'s sarcasm, at close range', 'Stood too close to Sir Bonecrush\'s drum solo', 'Vox\'s 47-minute monologue',
    'Read the Latin out loud', 'Didn\'t be kind, didn\'t rewind', 'Said Bloody Mary three times for the content', 'Moved into the cheap house by the cemetery',
    'Ran upstairs instead of out the front door', 'Clicked "Accept All" at NeuraNest', 'A V1SION concert (terminal boredom)',
    'Tripped over Grave Hog\'s cursed junk', 'Opened the basement door', 'Picked up the hitchhiker', 'Skipped the safety briefing at the haunted hayride',
    'Too many energy drinks before the encore', 'Hugged a mummy without asking', 'Took the shortcut through the woods', 'Lost a staring contest with a gargoyle',
    'Petted the werewolf on a full moon', 'Laughed at the curse'],
  epitaphs: ['I told you I was sick.', 'Be right back.', 'Finally, some peace and quiet.', 'Gone, but not for long.', 'Out to lunch. Forever.',
    'Keep your ribs open.', 'This is not the encore.', 'Ask me about my afterlife.', 'I\'d rather be moshing.', 'Plot twist.', 'Will haunt for snacks.',
    'Do not disturb. Seriously.', 'Rest in pieces.', 'Died doing what they loved: ignoring the warning signs.', 'Not dead. Just resting my eyes.',
    'Some songs survive longer than the worlds that created them.', 'Must have gotten better.', 'Still owes the video store a late fee.',
    'See you at the reunion tour.', 'Tune in tomorrow. Literally.', 'Worth it.', 'Left the group chat.', 'Currently haunting your playlist.']
};
