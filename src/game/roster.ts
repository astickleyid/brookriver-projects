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
  skinColor: number;
  source: string;
  asset: string;
  previewPose?: "folded";
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
    id: "rhett",
    previewPose: "folded",
    name: "Rhett Vale",
    brand: "REDLINE",
    tagline: "All nerve. No brakes.",
    age: 27,
    sex: "m",
    hair: "parted",
    hairTint: 0x684326,
    skin: [1.08, 0.98, 0.9],
    skinColor: 0xeec4aa,
    source: "ultimate-modular-men/Casual_2",
    asset: "/models/cast/rhett.glb",
    body: "Tall · athletic V-taper · square jaw",
    fashion:
      "Scarlet and bone racing tee, dark denim, fingerless gloves and oversized red high-tops.",
    personality:
      "Cocky, quick-witted, unexpectedly loyal. Treats every traffic light like a starting gate.",
    story:
      "A former motocross prodigy who builds his own street bikes. Wants a clean win badly enough to keep finding dirty shortcuts.",
    voice: "Raspy tenor · Southern California English, fast and teasing",
    quote: "Tell me the long way. I’ll find the good way.",
    traits: ["Fearless", "Competitive", "Loyal when it counts"],
    shape: { chest: 1.12, waist: 0.88, hips: 0.96, depth: 1.0, jaw: 1.15, nose: 1.04 },
    profile: {
      role: "Street racer & bike builder",
      manner: "Loose shoulders, chin up, restless confidence",
      outfit: "tee",
      fabric: 0xcf3c30,
      trousers: 0x263747,
      accent: 0xf0debb,
      accessories: [],
      idle: "idle",
      gait: 1.04,
      height: 1.06,
      build: 1.02,
    },
  },
  {
    id: "cole",
    name: "Cole Mercer",
    brand: "KICKFLIP",
    tagline: "Make it look easy.",
    age: 29,
    sex: "m",
    hair: "parted",
    hairTint: 0xcbaa68,
    skin: [1.08, 0.98, 0.9],
    skinColor: 0xeac3aa,
    source: "ultimate-modular-men/Casual_Hoodie",
    asset: "/models/cast/cole.glb",
    body: "Lean · long-limbed · defined shoulders",
    fashion:
      "Forest and gold oversized hoodie, baggy black shorts, chunky skate shoes and headphones.",
    personality:
      "Laid-back, mischievous, quietly technical. Remembers a perfect line longer than a grudge.",
    story:
      "A skate-video filmer and board-shop regular who knows every stair set in Brookriver. Saving for a shop that stays open after midnight.",
    voice: "Warm low tenor · Pacific Northwest English, relaxed and amused",
    quote: "One more try. This one’s the keeper.",
    traits: ["Inventive", "Unhurried", "Lives for a clean landing"],
    shape: { chest: 1.04, waist: 0.9, hips: 0.96, depth: 0.96, jaw: 1.12, nose: 0.97 },
    profile: {
      role: "Skater & street filmmaker",
      manner: "Easy stance, playful nods, calm confidence",
      outfit: "hoodie",
      fabric: 0x326d57,
      trousers: 0x272e32,
      accent: 0xe8b94f,
      accessories: [],
      idle: "idle",
      gait: 1.02,
      height: 1.03,
      build: 0.99,
    },
  },
  {
    id: "briggs",
    previewPose: "folded",
    name: "Axel Briggs",
    brand: "HEAVY HITTER",
    tagline: "Big swing. Bigger grin.",
    age: 32,
    sex: "m",
    hair: "buzz",
    hairTint: 0x3b2a22,
    skin: [1.08, 0.98, 0.9],
    skinColor: 0xe1b296,
    source: "ultimate-modular-men/Punk",
    asset: "/models/cast/briggs.glb",
    body: "Broad · muscular · thick neck · tapered waist",
    fashion:
      "Cut-off charcoal vest, amber tank, torn indigo denim, wrist wraps, dark crest and steel-toe sneakers.",
    personality:
      "Loud, magnetic, protective. Laughs first, competes hard, takes losing personally.",
    story:
      "An amateur heavyweight and demolition-crew foreman. Spends his weekends fixing the skate ramps he pretends to hate.",
    voice: "Rough baritone · northern English cadence, boisterous and direct",
    quote: "Come on then. Let’s make a little noise.",
    traits: ["Protective", "Hot-headed", "Secretly a soft touch"],
    shape: { chest: 1.23, waist: 0.98, hips: 1.02, depth: 1.06, jaw: 1.22, nose: 1.08 },
    profile: {
      role: "Heavyweight & demolition foreman",
      manner: "Planted stance, expressive hands, a ready grin",
      outfit: "jacket",
      fabric: 0xe4a93c,
      trousers: 0x304050,
      accent: 0xe3ddc8,
      accessories: [],
      idle: "talk",
      gait: 0.96,
      height: 1.07,
      build: 1.09,
    },
  },
  {
    id: "mara",
    source: "ultimate-modular-women/Punk",
    asset: "/models/cast/mara.glb",
    skinColor: 0xf0cfb7,
    name: "Mara Voss",
    brand: "AFTERHOURS",
    tagline: "Quiet entrance. Last word.",
    age: 31,
    sex: "f",
    hair: "long",
    hairTint: 0xc6c5bb,
    skin: [1.08, 0.96, 0.86],
    body: "Tall · lean · angular face",
    fashion:
      "Ink and silver cropped streetwear, fitted utility trousers, heavy boots and an ice-blond crest.",
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
    source: "ultimate-modular-men/Casual_Hoodie",
    asset: "/models/cast/leon.glb",
    skinColor: 0x865339,
    name: "Leon Bell",
    brand: "DEADSTOCK",
    tagline: "Big heart. Bigger presence.",
    age: 28,
    sex: "m",
    hair: "buzz",
    hairTint: 0x211913,
    skin: [0.43, 0.27, 0.18],
    body: "Broad · strong · tapered waist",
    fashion:
      "Oxblood hoodie, oversized cream sneakers, loose denim shorts and a collector’s headphones.",
    personality:
      "Warm, competitive, a compulsive collector. Makes friends easily; holds a grudge over a bad trade.",
    story:
      "Grew up above his aunt’s record shop. Flips rare sneakers to keep its shutters open, and knows the history behind every corner.",
    voice: "Warm baritone · relaxed Brooklyn cadence",
    quote: "If we’re doing this, we’re doing it with style.",
    traits: ["Generous", "Proud", "Walking music archive"],
    shape: { chest: 1.18, waist: 0.98, hips: 1.04, depth: 1.02, jaw: 1.2, nose: 0.95 },
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
    source: "ultimate-modular-women/Soldier",
    asset: "/models/cast/imani.glb",
    skinColor: 0x925f43,
    name: "Imani Okafor",
    brand: "PULSE",
    tagline: "Always one move ahead.",
    age: 25,
    sex: "f",
    hair: "buns",
    hairTint: 0x18120f,
    skin: [0.56, 0.35, 0.23],
    body: "Athletic · strong legs · compact waist",
    fashion:
      "Cobalt and lime technical layers, fitted utility trousers, armored kneepads and strapped boots.",
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
    source: "ultimate-modular-men/Worker",
    asset: "/models/cast/rafa.glb",
    skinColor: 0xc79670,
    name: "Rafa Solis",
    brand: "TORQUE",
    tagline: "Built to stay. Ready to move.",
    age: 36,
    sex: "m",
    hair: "beard",
    hairTint: 0x37261c,
    skin: [0.86, 0.66, 0.47],
    body: "Short · solid · broad shoulders",
    fashion:
      "Copper work shirt, dark utility suspenders, reinforced olive trousers and cream work shoes.",
    personality:
      "Patient, practical, stubborn as a seized bolt. Repairs things for people who can’t pay.",
    story:
      "Runs a two-bay garage under the rail line. Came back to Brookriver to look after his father and inherited a mountain of unfinished jobs.",
    voice: "Gravelly mid register · El Paso English, fluent Spanish",
    quote: "Give me a minute. There’s always a way to fix it.",
    traits: ["Dependable", "Stubborn", "Terrible at taking a day off"],
    shape: { chest: 1.18, waist: 0.96, hips: 1.06, depth: 1.02, jaw: 1.2, nose: 1.2 },
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
    source: "ultimate-modular-men/Casual_2",
    asset: "/models/cast/jules.glb",
    skinColor: 0xe8c4a5,
    name: "Jules Park",
    brand: "OFFSCRIPT",
    tagline: "Never the expected answer.",
    age: 24,
    sex: "m",
    hair: "parted",
    hairTint: 0x9685ae,
    skin: [1.04, 0.88, 0.72],
    body: "Slender · narrow waist · sharp features",
    fashion:
      "Oversized seafoam graphic shirt, charcoal trousers, lavender hair and oversized cream sneakers.",
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
    source: "ultimate-modular-women/Casual",
    asset: "/models/cast/sana.glb",
    skinColor: 0xd4a078,
    name: "Sana Haddad",
    brand: "SUNDOWN",
    tagline: "A little warmth. A lot of nerve.",
    age: 33,
    sex: "f",
    hair: "long",
    hairTint: 0x492317,
    skin: [0.94, 0.73, 0.53],
    body: "Curvy · defined waist · strong hips",
    fashion:
      "Saffron fitted tee, ivory trousers, terracotta sneakers and side-swept auburn hair.",
    personality:
      "Affectionate, shrewd, impossible to rush. Remembers your order and exactly what you owe.",
    story:
      "A supper-club host building a restaurant from a borrowed kitchen. The ward comes to her for a meal, a favor, or a very honest opinion.",
    voice: "Rich mezzo · Melbourne English, unhurried and wry",
    quote: "Come hungry. Leave the excuses at the door.",
    traits: ["Persuasive", "Headstrong", "Feeds absolutely everyone"],
    shape: { chest: 1.04, waist: 0.94, hips: 1.15, depth: 1.02, jaw: 1.13, nose: 1.06 },
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
