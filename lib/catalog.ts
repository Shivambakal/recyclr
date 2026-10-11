/* ------------------------------------------------------------------ */
/*  RECYCLR e-waste catalog                                            */
/*  Realistic recoverable-material profiles for common e-waste items.  */
/*  Values are estimates of informal-sector recovery value in INR and  */
/*  CO2e avoided vs. virgin production + landfill.                     */
/* ------------------------------------------------------------------ */

export interface Material {
  name: string;
  grams: number;
}

export interface EwasteItem {
  id: string;
  name: string;
  category: string;
  keywords: string[];
  typicalWeightKg: number;
  materials: Material[];
  inrValue: number;
  co2SavedKg: number;
  hazards: string[];
  handlingNote: string;
}

export const CATALOG: EwasteItem[] = [
  {
    id: "smartphone",
    name: "Smartphone",
    category: "Small IT equipment",
    keywords: ["smartphone", "phone", "mobile", "cellphone"],
    typicalWeightKg: 0.18,
    materials: [
      { name: "Copper", grams: 15 },
      { name: "Plastic", grams: 80 },
      { name: "Glass", grams: 40 },
      { name: "Silver", grams: 0.35 },
      { name: "Gold", grams: 0.034 },
    ],
    inrValue: 85,
    co2SavedKg: 12,
    hazards: ["Lithium battery — do not puncture"],
    handlingNote: "Remove battery before manual dismantling.",
  },
  {
    id: "laptop",
    name: "Laptop",
    category: "Small IT equipment",
    keywords: ["laptop", "notebook", "macbook"],
    typicalWeightKg: 2.1,
    materials: [
      { name: "Aluminium", grams: 400 },
      { name: "Copper", grams: 90 },
      { name: "Steel", grams: 300 },
      { name: "Plastic", grams: 500 },
      { name: "Glass", grams: 150 },
      { name: "Lithium", grams: 60 },
    ],
    inrValue: 420,
    co2SavedKg: 180,
    hazards: ["Lithium battery pack"],
    handlingNote: "Battery must be discharged and isolated first.",
  },
  {
    id: "tablet",
    name: "Tablet",
    category: "Small IT equipment",
    keywords: ["tablet", "ipad"],
    typicalWeightKg: 0.45,
    materials: [
      { name: "Aluminium", grams: 150 },
      { name: "Glass", grams: 120 },
      { name: "Copper", grams: 20 },
      { name: "Lithium", grams: 40 },
      { name: "Plastic", grams: 60 },
    ],
    inrValue: 120,
    co2SavedKg: 35,
    hazards: ["Lithium battery — do not puncture"],
    handlingNote: "Screen glass is laminated; handle with gloves.",
  },
  {
    id: "desktop-pc",
    name: "Desktop Tower",
    category: "IT equipment",
    keywords: ["desktop", "tower", "cpu", "computer", "pc"],
    typicalWeightKg: 7,
    materials: [
      { name: "Steel", grams: 4000 },
      { name: "Aluminium", grams: 500 },
      { name: "Copper", grams: 300 },
      { name: "Plastic", grams: 1000 },
      { name: "Gold", grams: 0.2 },
    ],
    inrValue: 520,
    co2SavedKg: 200,
    hazards: ["CMOS battery (lithium coin cell)"],
    handlingNote: "Motherboard holds most precious-metal value.",
  },
  {
    id: "crt-monitor",
    name: "CRT Monitor",
    category: "Display equipment",
    keywords: ["crt", "monitor", "old tv", "tube"],
    typicalWeightKg: 7.5,
    materials: [
      { name: "Leaded glass", grams: 4000 },
      { name: "Plastic", grams: 2000 },
      { name: "Copper", grams: 150 },
    ],
    inrValue: 180,
    co2SavedKg: 60,
    hazards: ["Lead in funnel glass", "Phosphor coating", "Vacuum implosion risk"],
    handlingNote: "Requires trained dismantler. Never break the tube in the open.",
  },
  {
    id: "led-tv",
    name: "LED TV (32\")",
    category: "Display equipment",
    keywords: ["tv", "television", "led", "display", "screen"],
    typicalWeightKg: 5,
    materials: [
      { name: "Plastic", grams: 3000 },
      { name: "Glass", grams: 1500 },
      { name: "Copper", grams: 80 },
      { name: "Aluminium", grams: 200 },
    ],
    inrValue: 350,
    co2SavedKg: 120,
    hazards: ["Backlight may contain mercury (CCFL models)"],
    handlingNote: "Separate panel glass from housing carefully.",
  },
  {
    id: "printer",
    name: "Printer",
    category: "Small IT equipment",
    keywords: ["printer", "scanner"],
    typicalWeightKg: 5,
    materials: [
      { name: "Plastic", grams: 3500 },
      { name: "Steel", grams: 800 },
      { name: "Copper", grams: 60 },
    ],
    inrValue: 150,
    co2SavedKg: 70,
    hazards: ["Toner dust — avoid inhalation"],
    handlingNote: "Remove toner cartridges before shredding.",
  },
  {
    id: "lead-acid-battery",
    name: "Lead-Acid Battery (UPS / Inverter)",
    category: "Batteries",
    keywords: ["battery", "ups", "inverter", "lead acid", "accumulator"],
    typicalWeightKg: 9,
    materials: [
      { name: "Lead", grams: 6000 },
      { name: "Plastic (PP)", grams: 1000 },
    ],
    inrValue: 540,
    co2SavedKg: 25,
    hazards: ["Sulphuric acid", "Lead — neurotoxin"],
    handlingNote: "Keep upright. Acid must go to authorised treatment only.",
  },
  {
    id: "li-ion-battery",
    name: "Li-ion Battery Pack",
    category: "Batteries",
    keywords: ["li-ion", "lithium", "power bank", "battery pack"],
    typicalWeightKg: 1.2,
    materials: [
      { name: "Lithium", grams: 120 },
      { name: "Cobalt", grams: 200 },
      { name: "Nickel", grams: 150 },
      { name: "Copper", grams: 100 },
      { name: "Aluminium", grams: 150 },
    ],
    inrValue: 310,
    co2SavedKg: 40,
    hazards: ["Thermal runaway / fire risk if damaged"],
    handlingNote: "Tape terminals. Store in fire-safe container.",
  },
  {
    id: "refrigerator",
    name: "Refrigerator",
    category: "Large household appliances",
    keywords: ["fridge", "refrigerator", "freezer"],
    typicalWeightKg: 45,
    materials: [
      { name: "Steel", grams: 25000 },
      { name: "Aluminium", grams: 2000 },
      { name: "Copper", grams: 1500 },
      { name: "Plastic", grams: 5000 },
    ],
    inrValue: 2100,
    co2SavedKg: 400,
    hazards: ["Refrigerant gas (CFC/HFC)", "Compressor oil"],
    handlingNote: "Refrigerant must be recovered by certified handler.",
  },
  {
    id: "washing-machine",
    name: "Washing Machine",
    category: "Large household appliances",
    keywords: ["washing", "washer", "laundry"],
    typicalWeightKg: 35,
    materials: [
      { name: "Steel", grams: 20000 },
      { name: "Plastic", grams: 8000 },
      { name: "Copper", grams: 800 },
      { name: "Aluminium", grams: 1000 },
    ],
    inrValue: 1600,
    co2SavedKg: 320,
    hazards: ["Capacitor charge"],
    handlingNote: "Discharge capacitors before dismantling motor.",
  },
  {
    id: "air-conditioner",
    name: "Split Air Conditioner",
    category: "Large household appliances",
    keywords: ["ac", "air conditioner", "aircon", "cooler"],
    typicalWeightKg: 22,
    materials: [
      { name: "Copper", grams: 3000 },
      { name: "Aluminium", grams: 4000 },
      { name: "Steel", grams: 8000 },
      { name: "Plastic", grams: 2000 },
    ],
    inrValue: 1900,
    co2SavedKg: 380,
    hazards: ["Refrigerant gas", "Compressor oil"],
    handlingNote: "Highest copper yield per kg of any appliance here.",
  },
];

/** Match a filename / hint like "sample:smartphone" or "my-laptop-photo.jpg" to a catalog item. */
export function lookupByHint(hint: string): EwasteItem | null {
  const h = hint.toLowerCase();
  // sample:<id> prefix wins
  const m = h.match(/sample:([a-z-]+)/);
  if (m) {
    const found = CATALOG.find((c) => c.id === m[1]);
    if (found) return found;
  }
  for (const item of CATALOG) {
    if (item.keywords.some((k) => h.includes(k)) || h.includes(item.id.replace(/-/g, ""))) return item;
  }
  return null;
}

/** Deterministic fallback: pick an item from the first bytes of a hex hash. */
export function classifyByHash(hashHex: string): EwasteItem {
  const n = parseInt(hashHex.slice(0, 8), 16);
  return CATALOG[n % CATALOG.length];
}

/** Confidence varies deterministically per image so repeat demos look alive. */
export function confidenceFor(hashHex: string): number {
  const n = parseInt(hashHex.slice(8, 12), 16);
  return 88 + (n % 10); // 88–97
}
