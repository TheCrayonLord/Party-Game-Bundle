/** Ghost train rooms. Each has two ways on; which one is dangerous is rolled fresh every game. */
export const ROOMS: { text: string; a: string; b: string; safe: string; hurt: string }[] = [
  { text: 'The track splits in the dark. Left smells of candy floss. Right smells of… wet dog?', a: 'Go left', b: 'Go right', safe: 'Just a sticky cobweb or two. Onward!', hurt: 'A werewolf in a ticket-collector’s hat. It bites.' },
  { text: 'A skeleton in a waistcoat offers the cart a drink from two bottles.', a: 'The green bottle', b: 'The purple bottle', safe: 'Lemonade! Flat, but lemonade.', hurt: 'It was embalming fluid. Everyone feels unwell.' },
  { text: 'Two doors. One is painted with a smiling moon. The other with a frowning sun.', a: 'The smiling moon', b: 'The frowning sun', safe: 'An empty corridor of mirrors. Phew.', hurt: 'The floor was painted on. It’s a long way down.' },
  { text: 'A ghostly organist asks for a request.', a: 'Something cheerful', b: 'Something spooky', safe: 'A lovely tune. The ghosts sway and let you pass.', hurt: 'The ghosts HATE that one. They throw pipes.' },
  { text: 'The cart stops at a lever marked “DO NOT” in dripping red paint.', a: 'Pull the lever', b: 'Leave the lever', safe: 'The cart rolls quietly on.', hurt: 'The ceiling opens. So many spiders.' },
  { text: 'A portrait’s eyes follow you. A whisper: “Bow to me, or meet my gaze.”', a: 'Bow', b: 'Stare it down', safe: 'The portrait nods, satisfied.', hurt: 'The frame lunges. It has teeth.' },
  { text: 'A fortune-telling machine lights up and offers two cards.', a: 'Take the left card', b: 'Take the right card', safe: 'It reads: “You will be fine.” And you are.', hurt: 'It reads: “DUCK.” Nobody ducks in time.' },
  { text: 'The tunnel fills with mist. Bells ring ahead; behind you, footsteps.', a: 'Speed up', b: 'Stop and hide', safe: 'Whatever it was, it passes by.', hurt: 'The mannequins found you. They are not mannequins.' },
  { text: 'A banquet table, candles lit, two covered silver dishes.', a: 'Lift the round lid', b: 'Lift the square lid', safe: 'Jelly. Slightly haunted, but edible.', hurt: 'A swarm of bats, and they’re furious.' },
  { text: 'A bride in a cobwebbed veil blocks the track and asks you to dance.', a: 'Accept the dance', b: 'Politely decline', safe: 'She sighs happily and fades away.', hurt: 'Wrong answer. She has been waiting ninety years.' },
  { text: 'The cart reaches a lake of black water. There is a rowing boat and a rope bridge.', a: 'Take the boat', b: 'Cross the bridge', safe: 'A calm crossing. Something waves from the deep.', hurt: 'It was holding on underneath the whole time.' },
  { text: 'A child’s music box sits on the track, playing by itself.', a: 'Close the lid', b: 'Let it play', safe: 'Silence. The lights flicker back on.', hurt: 'The dolls on the shelves all turn their heads.' },
  { text: 'A butler with no face holds out two keys.', a: 'The rusty key', b: 'The shiny key', safe: 'The gate creaks open.', hurt: 'The key bites back, and so does the gate.' },
  { text: 'Graffiti on the wall: “THE EXIT IS A LIE”. An arrow points up a staircase; the track heads down.', a: 'Climb the stairs', b: 'Stay on the track', safe: 'A shortcut! Well spotted.', hurt: 'A trapdoor, a chute, and a very angry ghoul.' },
];
