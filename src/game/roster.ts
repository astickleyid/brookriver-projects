import type { CharacterProfile } from "./wardrobe.ts";

export type PlayableCharacter = {
  id: string;
  name: string;
  brand: string;
  tagline: string;
  age: number;
  sex: "m" | "f";
  hair: string;
  hairTint: number;
  skin: number[];
  body: string;
  fashion: string;
  personality: string;
  story: string;
  voice: string;
  quote: string;
  traits: string[];
  shape: { chest: number; waist: number; hips: number; depth: number; jaw: number; nose: number };
  profile: Omit<CharacterProfile, "id" | "name">;
};

/** Authored protagonists. Identity is independent of combat stats and save economy. */
export const PLAYABLES: readonly PlayableCharacter[] = [
  {
    id: "mara",
    name: "Mara Voss",
    brand: "AFTERHOURS",
    tagline: "Quiet entrance. Last word.",
    age: 31,
    sex: "f",
    hair: "long",
    hairTint: 0xc6c5bb,
    skin: [1.08, 0.96, 0.86],
    body: "Tall · lean · angular face",
    fashion: "Ink tailoring, a split longline coat, silver hardware and pointed boots.",
    personality: "Dry, observant, fiercely private. Saves every receipt; forgets every birthday.",
    story:
      "A former hotel concierge who learned that the best information arrives after midnight. Wants a place in the city that nobody can take from her.",
    voice: "Low register · clipped South London cadence",
    quote: "Everybody leaves a door open. You just have to notice.",
    traits: ["Unflappable", "Secretive", "Soft spot for strays"],
    shape: { chest: 0.9, waist: 0.83, hips: 0.94, depth: 0.9, jaw: 0.88, nose: 1.16 },
    profile: {
      role: "After-hours concierge",
      manner: "Stillness, sharp wit, immaculate details",
      outfit: "suit",
      fabric: 0x242b35,
      trousers: 0x171c26,
      accent: 0xcbd3ce,
      accessories: ["earrings"],
      idle: "idle",
      gait: 0.98,
      height: 1.08,
      build: 0.96,
    },
  },
  {
    id: "leon",
    name: "Leon Bell",
    brand: "DEADSTOCK",
    tagline: "Big heart. Bigger presence.",
    age: 28,
    sex: "m",
    hair: "buzz",
    hairTint: 0x211913,
    skin: [0.43, 0.27, 0.18],
    body: "Broad · heavyset · rounded cheeks",
    fashion: "Oxblood varsity jacket, cream sleeves, loose denim and collectible high-tops.",
    personality:
      "Warm, competitive, a compulsive collector. Makes friends easily; holds a grudge over a bad trade.",
    story:
      "Grew up above his aunt’s record shop. Flips rare sneakers to keep its shutters open, and knows the history behind every corner.",
    voice: "Warm baritone · relaxed Brooklyn cadence",
    quote: "If we’re doing this, we’re doing it with style.",
    traits: ["Generous", "Proud", "Walking music archive"],
    shape: { chest: 1.28, waist: 1.48, hips: 1.2, depth: 1.4, jaw: 1.2, nose: 0.95 },
    profile: {
      role: "Collector & record-shop lifeline",
      manner: "Open gestures and an easy laugh",
      outfit: "jacket",
      fabric: 0x742d3b,
      trousers: 0x304659,
      accent: 0xe2cfaa,
      accessories: ["chain"],
      idle: "talk",
      gait: 0.88,
      height: 0.99,
      build: 1.04,
    },
  },
  {
    id: "imani",
    name: "Imani Okafor",
    brand: "PULSE",
    tagline: "Always one move ahead.",
    age: 25,
    sex: "f",
    hair: "buns",
    hairTint: 0x18120f,
    skin: [0.56, 0.35, 0.23],
    body: "Athletic · strong thighs · defined cheekbones",
    fashion: "Cropped cobalt track jacket, wide cargo trousers, lime piping and sculpted loc buns.",
    personality:
      "Magnetic, restless, brutally honest. Hypes everyone else up; struggles to ask for help.",
    story:
      "A dance teacher and night-shift courier saving for her own studio. Measures the city in shortcuts and eight-counts.",
    voice: "Bright alto · Manchester cadence with quick, playful timing",
    quote: "Keep up. The good part’s around the corner.",
    traits: ["Inventive", "Impatient", "Looks after her people"],
    shape: { chest: 1.04, waist: 0.9, hips: 1.23, depth: 1.08, jaw: 0.95, nose: 1.05 },
    profile: {
      role: "Dancer & night courier",
      manner: "Rhythmic, expressive, always in motion",
      outfit: "jacket",
      fabric: 0x205bd0,
      trousers: 0x29313a,
      accent: 0xb9dd53,
      accessories: ["earrings"],
      idle: "dance",
      gait: 1.08,
      height: 1,
      build: 1.01,
    },
  },
  {
    id: "rafa",
    name: "Rafa Solis",
    brand: "TORQUE",
    tagline: "Built to stay. Ready to move.",
    age: 36,
    sex: "m",
    hair: "beard",
    hairTint: 0x37261c,
    skin: [0.86, 0.66, 0.47],
    body: "Short · sturdy · broad jaw",
    fashion:
      "Copper canvas work vest, rolled cream sleeves, reinforced olive trousers and heavy boots.",
    personality:
      "Patient, practical, stubborn as a seized bolt. Repairs things for people who can’t pay.",
    story:
      "Runs a two-bay garage under the rail line. Came back to Brookriver to look after his father and inherited a mountain of unfinished jobs.",
    voice: "Gravelly mid register · El Paso English, fluent Spanish",
    quote: "Give me a minute. There’s always a way to fix it.",
    traits: ["Dependable", "Stubborn", "Terrible at taking a day off"],
    shape: { chest: 1.18, waist: 1.16, hips: 1.06, depth: 1.22, jaw: 1.2, nose: 1.2 },
    profile: {
      role: "Mechanic & neighborhood problem solver",
      manner: "Economical movements, patient delivery",
      outfit: "worker",
      fabric: 0xa35b35,
      trousers: 0x4b5141,
      accent: 0xe3c99d,
      accessories: ["toolbelt"],
      idle: "idle",
      gait: 0.93,
      height: 0.91,
      build: 1.05,
    },
  },
  {
    id: "jules",
    name: "Jules Park",
    brand: "OFFSCRIPT",
    tagline: "Never the expected answer.",
    age: 24,
    sex: "m",
    hair: "parted",
    hairTint: 0x9685ae,
    skin: [1.04, 0.88, 0.72],
    body: "Slender · narrow shoulders · soft jaw",
    fashion:
      "Oversized seafoam shirt, asymmetric charcoal vest, cropped wide trousers and a crossbody bag.",
    personality:
      "Curious, theatrical, disarmingly perceptive. Turns every awkward silence into a bit.",
    story:
      "A printmaker who pastes unsigned comics around the ward. Keeps a day job at the copy shop and a notebook full of everyone’s secrets.",
    voice: "Light tenor · Vancouver English, quick deadpan delivery",
    quote: "That’s a terrible idea. I already have a better terrible idea.",
    traits: ["Resourceful", "Mischievous", "Can’t leave a mystery alone"],
    shape: { chest: 0.85, waist: 0.85, hips: 0.95, depth: 0.86, jaw: 0.83, nose: 0.9 },
    profile: {
      role: "Printmaker & midnight storyteller",
      manner: "Asymmetric pose, playful timing",
      outfit: "tee",
      fabric: 0x85b8a9,
      trousers: 0x34303f,
      accent: 0xddd1b9,
      accessories: ["satchel", "earrings"],
      idle: "talk",
      gait: 1.02,
      height: 1.03,
      build: 0.94,
    },
  },
  {
    id: "sana",
    name: "Sana Haddad",
    brand: "SUNDOWN",
    tagline: "A little warmth. A lot of nerve.",
    age: 33,
    sex: "f",
    hair: "long",
    hairTint: 0x492317,
    skin: [0.94, 0.73, 0.53],
    body: "Full figure · broad hips · rounded face",
    fashion: "Saffron longline knit, ivory wide-leg trousers, terracotta boots and gold hoops.",
    personality:
      "Affectionate, shrewd, impossible to rush. Remembers your order and exactly what you owe.",
    story:
      "A supper-club host building a restaurant from a borrowed kitchen. The ward comes to her for a meal, a favor, or a very honest opinion.",
    voice: "Rich mezzo · Melbourne English, unhurried and wry",
    quote: "Come hungry. Leave the excuses at the door.",
    traits: ["Persuasive", "Headstrong", "Feeds absolutely everyone"],
    shape: { chest: 1.2, waist: 1.28, hips: 1.42, depth: 1.3, jaw: 1.13, nose: 1.06 },
    profile: {
      role: "Supper-club host & dealmaker",
      manner: "Grounded posture, warm directness",
      outfit: "jacket",
      fabric: 0xbd8136,
      trousers: 0xd7cdb5,
      accent: 0xc58c59,
      accessories: ["earrings", "chain"],
      idle: "talk",
      gait: 0.94,
      height: 0.96,
      build: 1.02,
    },
  },
];
export const CHARACTER_SAVE_KEY = "brookriver-character-v1";
export function playableById(id: unknown): PlayableCharacter {
  return PLAYABLES.find((p) => p.id === id) ?? PLAYABLES[0]!;
}
export function playableProfile(hero: PlayableCharacter): CharacterProfile {
  return {
    ...hero.profile,
    accessories: [...hero.profile.accessories],
    id: hero.id,
    name: hero.name,
  };
}
