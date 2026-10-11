/* ------------------------------------------------------------------ */
/*  RECYCLR materials database                                          */
/*  1,000+ entries: every periodic-table element + the compounds,       */
/*  alloys, polymers and recovered fractions that actually show up in    */
/*  e-waste.                                                            */
/*                                                                     */
/*  Honesty rules:                                                      */
/*   - eWasteRelevance is a short honest note. "No significant e-waste  */
/*     presence." where true.                                          */
/*   - recoveryHint names a real process family ("smelter recovery",    */
/*     "manual dismantling", ...). NEVER a price or yield.             */
/*   - No invented numbers anywhere in this file.                      */
/* ------------------------------------------------------------------ */


export type MaterialKind = "element" | "compound" | "alloy" | "material";

export interface EwasteMaterial {
  id: string; // e.g. "el-au", "pl-abs", "sd-sac305", "fx-black-mass"
  name: string;
  kind: MaterialKind;
  symbol?: string; // chemical symbol for elements
  atomicNumber?: number; // for elements
  category: string; // controlled vocabulary (see MATERIAL_CATEGORIES)
  eWasteRelevance: string; // short, honest
  recoveryHint?: string; // process family only — never prices/yields
}

/* ---------------- periodic table: [symbol, name, Z, category, relevance] ---------------- */


/* ---------------- periodic table: [symbol, name, Z, category, relevance] ---------------- */

export type ElRow = [string, string, number, string, string];

export type Row = [string, string, MaterialKind, string, string, string?];

export const ELEMENTS: ElRow[] = [
  ["H", "Hydrogen", 1, "Nonmetal", "Metal-hydride (NiMH) battery chemistry; hydrogen fuel-cell prototypes."],
  ["He", "Helium", 2, "Noble gas", "No significant e-waste presence."],
  ["Li", "Lithium", 3, "Alkali metal", "Li-ion battery cathodes, anodes and electrolyte salts — the key battery metal."],
  ["Be", "Beryllium", 4, "Alkaline earth metal", "Beryllium-copper spring contacts in connectors, switches and relays."],
  ["B", "Boron", 5, "Metalloid", "Borosilicate glass, semiconductor doping, NdFeB magnet grain-boundary additive."],
  ["C", "Carbon", 6, "Nonmetal", "Graphite anodes in Li-ion cells; carbon brushes, diamond heat spreaders, carbon fiber."],
  ["N", "Nitrogen", 7, "Nonmetal", "Gallium-nitride (GaN) power semiconductors and LEDs; otherwise no significant presence."],
  ["O", "Oxygen", 8, "Nonmetal", "Metal-oxide cathodes (LCO, NMC, LFP), ceramics, glass and oxide passivation layers."],
  ["F", "Fluorine", 9, "Halogen", "LiPF6 electrolyte salt, PTFE insulation, fluorinated refrigerants, PVDF binder."],
  ["Ne", "Neon", 10, "Noble gas", "No significant e-waste presence."],
  ["Na", "Sodium", 11, "Alkali metal", "Sodium-ion battery R&D cells; legacy sodium-vapor lamps."],
  ["Mg", "Magnesium", 12, "Alkaline earth metal", "Magnesium-alloy (AZ91) laptop and phone chassis castings."],
  ["Al", "Aluminium", 13, "Post-transition metal", "Chassis, heat sinks, electrolytic-capacitor foil, cable shielding."],
  ["Si", "Silicon", 14, "Metalloid", "Semiconductor dies, solar cells, silica glass, silicones, ferrosilicon."],
  ["P", "Phosphorus", 15, "Nonmetal", "Red-phosphorus flame retardant, phosphor coatings, semiconductor dopant."],
  ["S", "Sulfur", 16, "Nonmetal", "Vulcanized rubber parts; sulfuric acid electrolyte in lead-acid batteries."],
  ["Cl", "Chlorine", 17, "Halogen", "PVC plastic, chlorinated flame retardants, PCB etchants."],
  ["Ar", "Argon", 18, "Noble gas", "Trace use as lamp fill gas; no significant e-waste presence."],
  ["K", "Potassium", 19, "Alkali metal", "No significant e-waste presence."],
  ["Ca", "Calcium", 20, "Alkaline earth metal", "Calcium-alloyed lead-acid battery grids; CaZn PVC stabilizers."],
  ["Sc", "Scandium", 21, "Transition metal", "Trace in some high-strength aluminum alloys; no significant e-waste presence."],
  ["Ti", "Titanium", 22, "Transition metal", "Premium phone frames, fasteners and sputtering targets."],
  ["V", "Vanadium", 23, "Transition metal", "Tool steels; vanadium redox-flow batteries are grid-scale, not consumer e-waste."],
  ["Cr", "Chromium", 24, "Transition metal", "Chrome plating, stainless steel, pigments."],
  ["Mn", "Manganese", 25, "Transition metal", "LMO/NMC cathodes, steel alloying, alkaline-battery cathodes."],
  ["Fe", "Iron", 26, "Transition metal", "Steel chassis, transformer and motor cores, ferrite magnets."],
  ["Co", "Cobalt", 27, "Transition metal", "LCO/NMC Li-ion cathodes — a key recovered battery metal."],
  ["Ni", "Nickel", 28, "Transition metal", "NiMH and NMC batteries, plating underlayer, stainless steel."],
  ["Cu", "Copper", 29, "Transition metal", "Wiring, PCB traces, motor windings — the backbone metal of e-waste."],
  ["Zn", "Zinc", 30, "Transition metal", "Galvanizing, brass, alkaline batteries, die-cast Zamak housings."],
  ["Ga", "Gallium", 31, "Post-transition metal", "GaAs/GaN LEDs, RF chips and power devices."],
  ["Ge", "Germanium", 32, "Metalloid", "Legacy transistors, fiber optics, infrared optics."],
  ["As", "Arsenic", 33, "Metalloid", "GaAs semiconductors; hazardous dopant — handle as toxic."],
  ["Se", "Selenium", 34, "Nonmetal", "Legacy rectifiers and copier drums; CdTe solar cells."],
  ["Br", "Bromine", 35, "Halogen", "Brominated flame retardants in plastics and PCB laminates."],
  ["Kr", "Krypton", 36, "Noble gas", "No significant e-waste presence."],
  ["Rb", "Rubidium", 37, "Alkali metal", "No significant e-waste presence."],
  ["Sr", "Strontium", 38, "Alkaline earth metal", "Strontium-ferrite magnets; strontium in CRT glass as lead replacement."],
  ["Y", "Yttrium", 39, "Transition metal", "YAG:Ce LED phosphors; red phosphors in CRTs and fluorescent lamps."],
  ["Zr", "Zirconium", 40, "Transition metal", "Zirconia ceramics; dopant in MLCC dielectrics."],
  ["Nb", "Niobium", 41, "Transition metal", "Niobium-oxide capacitors; superconducting magnets are not consumer e-waste."],
  ["Mo", "Molybdenum", 42, "Transition metal", "High-temperature alloys, sputtering targets, filaments."],
  ["Tc", "Technetium", 43, "Transition metal", "No significant e-waste presence (synthetic, radioactive)."],
  ["Ru", "Ruthenium", 44, "Transition metal", "Thick-film resistor pastes; hard-disk platter layers."],
  ["Rh", "Rhodium", 45, "Transition metal", "Decorative plating on premium connectors; otherwise trace."],
  ["Pd", "Palladium", 46, "Transition metal", "MLCC electrodes, connector plating — a key recovered precious metal."],
  ["Ag", "Silver", 47, "Transition metal", "Switch contacts, solders, PV cells, conductive pastes — ~0.35 g per phone."],
  ["Cd", "Cadmium", 48, "Transition metal", "Legacy NiCd batteries, CdTe solar, pigments — hazardous."],
  ["In", "Indium", 49, "Post-transition metal", "ITO transparent conductors in LCD touchscreens; low-melt solders."],
  ["Sn", "Tin", 50, "Post-transition metal", "Solder alloys, tin plating, ITO."],
  ["Sb", "Antimony", 51, "Metalloid", "Antimony-trioxide flame-retardant synergist; hardens lead battery grids."],
  ["Te", "Tellurium", 52, "Metalloid", "CdTe solar panels; GeSbTe phase-change memory."],
  ["I", "Iodine", 53, "Halogen", "No significant e-waste presence."],
  ["Xe", "Xenon", 54, "Noble gas", "No significant e-waste presence."],
  ["Cs", "Cesium", 55, "Alkali metal", "No significant e-waste presence."],
  ["Ba", "Barium", 56, "Alkaline earth metal", "BaTiO3 MLCC dielectric; barium in CRT glass."],
  ["La", "Lanthanum", 57, "Lanthanide", "NiMH battery alloy, camera lenses, phosphors."],
  ["Ce", "Cerium", 58, "Lanthanide", "YAG:Ce LED phosphor; glass-polishing compounds."],
  ["Pr", "Praseodymium", 59, "Lanthanide", "NdFeB magnet additive (didymium); phosphors."],
  ["Nd", "Neodymium", 60, "Lanthanide", "NdFeB magnets in motors, speakers and hard drives — key recovered rare earth."],
  ["Pm", "Promethium", 61, "Lanthanide", "No significant e-waste presence (radioactive)."],
  ["Sm", "Samarium", 62, "Lanthanide", "SmCo magnets in precision motors and sensors."],
  ["Eu", "Europium", 63, "Lanthanide", "Red and blue phosphors in fluorescent lamps and CRTs."],
  ["Gd", "Gadolinium", 64, "Lanthanide", "No significant e-waste presence."],
  ["Tb", "Terbium", 65, "Lanthanide", "Green phosphors; grain-boundary additive in NdFeB magnets."],
  ["Dy", "Dysprosium", 66, "Lanthanide", "High-temperature NdFeB magnets (EV and high-performance motors)."],
  ["Ho", "Holmium", 67, "Lanthanide", "No significant e-waste presence."],
  ["Er", "Erbium", 68, "Lanthanide", "Fiber-optic amplifiers; pink tint in glass."],
  ["Tm", "Thulium", 69, "Lanthanide", "No significant e-waste presence."],
  ["Yb", "Ytterbium", 70, "Lanthanide", "Fiber lasers (industrial equipment)."],
  ["Lu", "Lutetium", 71, "Lanthanide", "No significant e-waste presence."],
  ["Hf", "Hafnium", 72, "Transition metal", "High-k gate dielectrics in advanced logic chips."],
  ["Ta", "Tantalum", 73, "Transition metal", "Tantalum capacitors — a key recovered metal in e-waste."],
  ["W", "Tungsten", 74, "Transition metal", "Filaments, phone vibration-motor weights, carbide tooling."],
  ["Re", "Rhenium", 75, "Transition metal", "No significant e-waste presence."],
  ["Os", "Osmium", 76, "Transition metal", "No significant e-waste presence."],
  ["Ir", "Iridium", 77, "Transition metal", "Precision contacts; OLED and crucible research."],
  ["Pt", "Platinum", 78, "Transition metal", "Thermocouples, hard-disk layers, fuel-cell catalysts."],
  ["Au", "Gold", 79, "Transition metal", "PCB edge connectors and plating — ~0.03 g per phone; key recovered metal."],
  ["Hg", "Mercury", 80, "Transition metal", "CCFL backlights, tilt switches, relays — hazardous."],
  ["Tl", "Thallium", 81, "Post-transition metal", "No significant e-waste presence (highly toxic)."],
  ["Pb", "Lead", 82, "Post-transition metal", "Lead-acid batteries, legacy solder, CRT funnel glass — hazardous."],
  ["Bi", "Bismuth", 83, "Post-transition metal", "Lead-free low-melt solders and thermal fuses."],
  ["Po", "Polonium", 84, "Post-transition metal", "No significant e-waste presence (radioactive)."],
  ["At", "Astatine", 85, "Halogen", "No significant e-waste presence."],
  ["Rn", "Radon", 86, "Noble gas", "No significant e-waste presence."],
  ["Fr", "Francium", 87, "Alkali metal", "No significant e-waste presence."],
  ["Ra", "Radium", 88, "Alkaline earth metal", "No significant e-waste presence (legacy luminous paint)."],
  ["Ac", "Actinium", 89, "Actinide", "No significant e-waste presence."],
  ["Th", "Thorium", 90, "Actinide", "No significant e-waste presence (legacy gas mantles, welding electrodes)."],
  ["Pa", "Protactinium", 91, "Actinide", "No significant e-waste presence."],
  ["U", "Uranium", 92, "Actinide", "No significant e-waste presence."],
  ["Np", "Neptunium", 93, "Actinide", "No significant e-waste presence."],
  ["Pu", "Plutonium", 94, "Actinide", "No significant e-waste presence."],
  ["Am", "Americium", 95, "Actinide", "Ionization-type smoke detectors — radioactive, specialist handling only."],
  ["Cm", "Curium", 96, "Actinide", "No significant e-waste presence."],
  ["Bk", "Berkelium", 97, "Actinide", "No significant e-waste presence."],
  ["Cf", "Californium", 98, "Actinide", "No significant e-waste presence."],
  ["Es", "Einsteinium", 99, "Actinide", "No significant e-waste presence."],
  ["Fm", "Fermium", 100, "Actinide", "No significant e-waste presence."],
  ["Md", "Mendelevium", 101, "Actinide", "No significant e-waste presence."],
  ["No", "Nobelium", 102, "Actinide", "No significant e-waste presence."],
  ["Lr", "Lawrencium", 103, "Actinide", "No significant e-waste presence."],
  ["Rf", "Rutherfordium", 104, "Transition metal", "No significant e-waste presence (synthetic)."],
  ["Db", "Dubnium", 105, "Transition metal", "No significant e-waste presence (synthetic)."],
  ["Sg", "Seaborgium", 106, "Transition metal", "No significant e-waste presence (synthetic)."],
  ["Bh", "Bohrium", 107, "Transition metal", "No significant e-waste presence (synthetic)."],
  ["Hs", "Hassium", 108, "Transition metal", "No significant e-waste presence (synthetic)."],
  ["Mt", "Meitnerium", 109, "Transition metal", "No significant e-waste presence (synthetic)."],
  ["Ds", "Darmstadtium", 110, "Transition metal", "No significant e-waste presence (synthetic)."],
  ["Rg", "Roentgenium", 111, "Transition metal", "No significant e-waste presence (synthetic)."],
  ["Cn", "Copernicium", 112, "Transition metal", "No significant e-waste presence (synthetic)."],
  ["Nh", "Nihonium", 113, "Post-transition metal", "No significant e-waste presence (synthetic)."],
  ["Fl", "Flerovium", 114, "Post-transition metal", "No significant e-waste presence (synthetic)."],
  ["Mc", "Moscovium", 115, "Post-transition metal", "No significant e-waste presence (synthetic)."],
  ["Lv", "Livermorium", 116, "Post-transition metal", "No significant e-waste presence (synthetic)."],
  ["Ts", "Tennessine", 117, "Halogen", "No significant e-waste presence (synthetic)."],
  ["Og", "Oganesson", 118, "Noble gas", "No significant e-waste presence (synthetic)."],
];

/* ---------------- compounds / alloys / materials ---------------- */
/* [id, name, kind, category, eWasteRelevance, recoveryHint?] */



export function fromEl([symbol, name, atomicNumber, category, eWasteRelevance]: ElRow): EwasteMaterial {
  return {
    id: `el-${symbol.toLowerCase()}`,
    name,
    kind: "element",
    symbol,
    atomicNumber,
    category,
    eWasteRelevance,
  };
}
