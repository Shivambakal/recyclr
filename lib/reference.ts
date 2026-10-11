/* ------------------------------------------------------------------ */
/*  RECYCLR reference-database loader                                  */
/*                                                                     */
/*  Typed access to data/reference/*.json — real-world specs, standard  */
/*  dismantling BOMs, material recovery notes and (clearly-labeled)     */
/*  price estimates that the agent cites in its reasoning trace.        */
/*                                                                     */
/*  Honesty contract:                                                   */
/*   - Pricing entries carry estimate:true / asOf / source. Anything    */
/*     the agent says from pricing.json must be labeled an estimate.    */
/*   - Where data is missing, helpers return null and callers must log  */
/*     "no reference data" in the trace — never invent.                */
/* ------------------------------------------------------------------ */

import devicesRaw from "../data/reference/devices.json";
import componentsRaw from "../data/reference/components.json";
import materialsRaw from "../data/reference/materials.json";
import pricingRaw from "../data/reference/pricing.json";

export interface Range {
  min: number;
  max: number;
}

export interface WeightSpec extends Range {
  typical: number;
  typicalNote?: string;
}

export interface BatterySpec {
  chemistry: string;
  format: string;
  capacityWh: Range;
  capacityWhTypical?: number[];
  capacityMah?: Range;
  cells?: string;
  voltageV?: string;
  hazardous: boolean;
  note?: string;
}

export interface DeviceReference {
  id: string;
  name: string;
  weightKg: WeightSpec;
  dimensionsMm: Record<string, unknown> | null;
  screenIn: (Range & { typical: number }) | null;
  battery: BatterySpec | null;
  yearRange: [number, number];
  housing: string;
  notes: string;
  leadContentKg?: Range & { note?: string };
}

export interface ComponentComposition {
  materialId: string;
  note: string;
}

export interface DeviceComponent {
  name: string;
  count: number | string;
  countNote?: string;
  composition: ComponentComposition[];
  recoveryNote: string;
}

export interface MaterialNote {
  id: string;
  name: string;
  category: string;
  processFamily: string;
  recoveryNote: string;
  hazardous: boolean;
  provisionalId?: boolean;
}

export interface InrRange {
  min: number;
  max: number;
}

export interface DevicePricing {
  id: string;
  resaleRefurbInr: InrRange;
  wholeUnitScrapInr: InrRange;
  note: string;
  estimate: true;
  asOf: string;
  source: string;
}

export interface ScrapPrice {
  id: string;
  inrPerKg: InrRange;
  note: string;
  estimate: true;
  asOf: string;
  source: string;
}

/* ------------------------------ getters ----------------------------- */

const devices = (devicesRaw as unknown as { devices: Record<string, DeviceReference> }).devices;
const components = (componentsRaw as unknown as { components: Record<string, { components: DeviceComponent[] }> }).components;
const materials = (materialsRaw as unknown as { materials: Record<string, MaterialNote> }).materials;
const pricingDevices = (pricingRaw as unknown as { devices: Record<string, DevicePricing> }).devices;
const pricingScrap = (pricingRaw as unknown as { scrapPerKg: Record<string, ScrapPrice> }).scrapPerKg;

export function getDeviceRef(deviceId: string): DeviceReference | null {
  return devices[deviceId] ?? null;
}

export function getDeviceComponents(deviceId: string): DeviceComponent[] | null {
  return components[deviceId]?.components ?? null;
}

export function getMaterialNote(materialId: string): MaterialNote | null {
  return materials[materialId] ?? null;
}

export function getDevicePricing(deviceId: string): DevicePricing | null {
  return pricingDevices[deviceId] ?? null;
}

export function getScrapPrice(materialId: string): ScrapPrice | null {
  return pricingScrap[materialId] ?? null;
}

/* ----------------------- catalog-name → material id ------------------- */
/* lib/catalog.ts names materials by plain name ("Copper", "Leaded       */
/* glass", ...). This map resolves the ones we have reference notes for. */
/* Unmapped names return null: callers must log "no reference data".    */

const CATALOG_NAME_TO_ID: Record<string, string> = {
  Copper: "el-cu",
  Aluminium: "el-al",
  Steel: "fe-carbon-steel",
  "Stainless steel": "fe-ss304",
  Plastic: "pl-abs",
  "Plastic (PP)": "pl-pp",
  Glass: "gl-sodalime",
  "Leaded glass": "dp-crt-funnel",
  Silver: "el-ag",
  Gold: "el-au",
  Palladium: "el-pd",
  Lead: "el-pb",
  Lithium: "el-li",
  Cobalt: "el-co",
  Nickel: "el-ni",
  Manganese: "el-mn",
  Tin: "el-sn",
  Zinc: "el-zn",
  "PCBs": "fx-pcb-shred",
  "Populated PCBs": "fx-pcb-shred",
  "PVC cable": "pl-pvc-cable",
};

export function resolveMaterialId(catalogName: string): string | null {
  return CATALOG_NAME_TO_ID[catalogName] ?? null;
}

/* ------------------------------ formatters -------------------------- */
/* Keep trace phrasing consistent across tools.                         */

export function describeWeightRange(ref: DeviceReference): string {
  const w = ref.weightKg;
  return `expected ${w.min}–${w.max}kg for ${ref.name} class (typical ${w.typical}kg)`;
}

export function describeBattery(ref: DeviceReference): string | null {
  const b = ref.battery;
  if (!b) return null;
  const wh = `${b.capacityWh.min}–${b.capacityWh.max}Wh`;
  const flag = b.hazardous ? " — handle as hazardous" : "";
  return `contains ${b.chemistry} ${wh}${flag}`;
}

export function describePricingEstimate(p: DevicePricing): string {
  return (
    `resale/refurb ₹${p.resaleRefurbInr.min}–₹${p.resaleRefurbInr.max}, ` +
    `whole-unit scrap ₹${p.wholeUnitScrapInr.min}–₹${p.wholeUnitScrapInr.max} ` +
    `(est., as of ${p.asOf}, ${p.source})`
  );
}
