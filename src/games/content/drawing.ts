/** Starter ideas shown as placeholders in Sketch & Switch (and used by bots). */
export const SKETCH_SEEDS = [
  'a clown stuck on a Ferris wheel', 'a hot dog winning a race', 'a ghost afraid of the dark', 'a goldfish driving a bumper car',
  'an elephant on a tightrope', 'a strongman lifting a feather', 'a seagull stealing fries', 'a rollercoaster made of spaghetti',
  'a bear selling balloons', 'a cat reading fortunes', 'a snowman at the beach', 'a pirate afraid of water',
  'a giraffe in a tiny car', 'a robot eating cotton candy', 'a dog walking its human', 'a penguin in a top hat',
];

/** Fake Artist: one word is picked; the faker only learns the category. */
export const FAKE_WORDS: Record<string, string[]> = {
  'At the fair': ['Ferris wheel', 'carousel', 'cotton candy', 'ticket booth', 'bumper car', 'popcorn', 'rollercoaster', 'balloon', 'clown', 'fireworks'],
  Animals: ['elephant', 'giraffe', 'octopus', 'penguin', 'snail', 'kangaroo', 'peacock', 'crocodile', 'hedgehog', 'flamingo'],
  Food: ['pizza', 'hot dog', 'ice cream cone', 'taco', 'pancakes', 'spaghetti', 'doughnut', 'burger', 'sushi', 'pineapple'],
  'Things at home': ['toaster', 'bathtub', 'umbrella', 'ladder', 'lamp', 'toilet', 'guitar', 'scissors', 'fridge', 'alarm clock'],
  Places: ['lighthouse', 'pyramid', 'igloo', 'castle', 'volcano', 'desert island', 'windmill', 'skyscraper', 'bridge', 'campsite'],
  Transport: ['submarine', 'hot air balloon', 'helicopter', 'sailboat', 'bicycle', 'rocket', 'tractor', 'train', 'skateboard', 'school bus'],
};
