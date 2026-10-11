/* RECYCLR materials database — public entry point (re-exports the chunked rows). */
import { ELEMENTS, fromEl } from "./elements";
import type { EwasteMaterial, MaterialKind, Row } from "./elements";
import { PLASTICS, SOLDERS, BATTERIES, PCB_MATS, PASSIVES } from "./rows-a";
import { SEMI, MAGNETS, DISPLAYS, FERROUS, NONFERROUS, PRECIOUS, WIRE, GLASS_CERAMIC } from "./rows-b";
import { CHEMICALS, CONNECTORS, PCB_SCRAP, FRACTIONS, CONSUMABLES, COMPONENTS } from "./rows-c";
import { HARDWARE, TOPUP, TOPUP2 } from "./rows-d";

export type { EwasteMaterial, MaterialKind, Row };

function fromRow([id, name, kind, category, eWasteRelevance, recoveryHint]: Row): EwasteMaterial {
  return { id, name, kind, category, eWasteRelevance, recoveryHint };
}

/** The full database: every element + every compound/alloy/material. */
export const MATERIALS: EwasteMaterial[] = [
  ...ELEMENTS.map(fromEl),
  ...PLASTICS.map(fromRow),
  ...SOLDERS.map(fromRow),
  ...BATTERIES.map(fromRow),
  ...PCB_MATS.map(fromRow),
  ...PASSIVES.map(fromRow),
  ...SEMI.map(fromRow),
  ...MAGNETS.map(fromRow),
  ...DISPLAYS.map(fromRow),
  ...FERROUS.map(fromRow),
  ...NONFERROUS.map(fromRow),
  ...PRECIOUS.map(fromRow),
  ...WIRE.map(fromRow),
  ...GLASS_CERAMIC.map(fromRow),
  ...CHEMICALS.map(fromRow),
  ...CONNECTORS.map(fromRow),
  ...PCB_SCRAP.map(fromRow),
  ...FRACTIONS.map(fromRow),
  ...CONSUMABLES.map(fromRow),
  ...COMPONENTS.map(fromRow),
  ...HARDWARE.map(fromRow),
  ...TOPUP.map(fromRow),
  ...TOPUP2.map(fromRow),
];

/** Distinct categories in first-seen order (controlled vocabulary). */
export const MATERIAL_CATEGORIES: string[] = Array.from(
  new Set(MATERIALS.map((m) => m.category))
);

export const MATERIAL_KINDS: MaterialKind[] = ["element", "compound", "alloy", "material"];

/** Entry counts per kind — computed, never hardcoded. */
export function countByKind(): Record<MaterialKind, number> {
  const out: Record<MaterialKind, number> = { element: 0, compound: 0, alloy: 0, material: 0 };
  for (const m of MATERIALS) out[m.kind] += 1;
  return out;
}

/** Look up a single material by id. */
export function getMaterial(id: string): EwasteMaterial | undefined {
  return MATERIALS.find((m) => m.id === id);
}

/** True when the entry has meaningful e-waste presence (vs. "no significant …."). */
export function hasEwastePresence(m: EwasteMaterial): boolean {
  return !/no significant e-waste presence/i.test(m.eWasteRelevance);
}
