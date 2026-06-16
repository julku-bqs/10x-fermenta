import type { Batch, SweetnessLevel } from "@/types";
import type { CalculationResult } from "./sugar-calculation";

export interface GenerationInput {
  batch: Pick<Batch, "batch_date" | "process_type" | "planned_sweetness" | "fermentation_sugar_kg">;
  calculationResult?: CalculationResult;
}

export interface DiaryEntryDraft {
  description: string;
  entry_date: string;
  entry_type: "auto";
}

interface StepTemplate {
  key: string;
  description: string;
  offsetDays: number;
  condition: (input: GenerationInput) => boolean;
}

// Step description constants (extractable for future i18n)
const STEP_PREPARE_MUST_JUICE = "Prepare must — pour juice into fermenter, add nutrients";
const STEP_PREPARE_MUST_PULP = "Prepare must — crush fruit, destem, add to fermenter, add nutrients";
const STEP_ADD_FERMENTATION_SUGAR = "Add fermentation sugar (if above 25°Blg — split into portions)";
const STEP_PITCH_YEAST = "Pitch yeast";
const STEP_CAP_MANAGEMENT = "Begin cap management — punch down 2–3× daily until pressing";
const STEP_MONITOR_PRIMARY = "Monitor primary fermentation";
const STEP_PRESS = "Press — separate wine from pomace";
const STEP_RACK_SECONDARY = "Rack to secondary fermenter";
const STEP_MONITOR_SECONDARY = "Monitor secondary fermentation";
const STEP_CONFIRM_COMPLETE = "Confirm fermentation complete (2× same reading)";
const STEP_RACK_OFF_LEES = "Rack off lees — transfer to clean vessel";
const STEP_BULK_AGING = "Bulk aging — check clarity, rack if needed";
const STEP_AGING_CHECK_1 = "Aging check — taste, check clarity";
const STEP_AGING_CHECK_2 = "Aging check — taste, assess readiness";
const STEP_STABILIZE = "Stabilize wine";
const STEP_BACK_SWEETEN = "Back-sweeten to target sweetness";
const STEP_BOTTLING = "Bottling";

const isJuice = (input: GenerationInput): boolean => input.batch.process_type === "juice";

const isPulp = (input: GenerationInput): boolean => input.batch.process_type === "pulp";

const hasFermentationSugar = (input: GenerationInput): boolean => input.batch.fermentation_sugar_kg > 0;

const isNotDry = (input: GenerationInput): boolean => input.batch.planned_sweetness !== ("dry" as SweetnessLevel);

const always = (): boolean => true;

export const STEP_TEMPLATES: StepTemplate[] = [
  {
    key: "prepare_must_juice",
    description: STEP_PREPARE_MUST_JUICE,
    offsetDays: 0,
    condition: isJuice,
  },
  {
    key: "prepare_must_pulp",
    description: STEP_PREPARE_MUST_PULP,
    offsetDays: 0,
    condition: isPulp,
  },
  {
    key: "add_fermentation_sugar",
    description: STEP_ADD_FERMENTATION_SUGAR,
    offsetDays: 0,
    condition: hasFermentationSugar,
  },
  {
    key: "pitch_yeast",
    description: STEP_PITCH_YEAST,
    offsetDays: 0,
    condition: always,
  },
  {
    key: "cap_management",
    description: STEP_CAP_MANAGEMENT,
    offsetDays: 1,
    condition: isPulp,
  },
  {
    key: "monitor_primary",
    description: STEP_MONITOR_PRIMARY,
    offsetDays: 5,
    condition: always,
  },
  {
    key: "press",
    description: STEP_PRESS,
    offsetDays: 10,
    condition: isPulp,
  },
  {
    key: "rack_secondary",
    description: STEP_RACK_SECONDARY,
    offsetDays: 14,
    condition: always,
  },
  {
    key: "monitor_secondary",
    description: STEP_MONITOR_SECONDARY,
    offsetDays: 21,
    condition: always,
  },
  {
    key: "confirm_complete",
    description: STEP_CONFIRM_COMPLETE,
    offsetDays: 28,
    condition: always,
  },
  {
    key: "rack_off_lees",
    description: STEP_RACK_OFF_LEES,
    offsetDays: 35,
    condition: always,
  },
  {
    key: "bulk_aging",
    description: STEP_BULK_AGING,
    offsetDays: 60,
    condition: always,
  },
  {
    key: "aging_check_1",
    description: STEP_AGING_CHECK_1,
    offsetDays: 120,
    condition: always,
  },
  {
    key: "aging_check_2",
    description: STEP_AGING_CHECK_2,
    offsetDays: 240,
    condition: always,
  },
  {
    key: "stabilize",
    description: STEP_STABILIZE,
    offsetDays: 330,
    condition: isNotDry,
  },
  {
    key: "back_sweeten",
    description: STEP_BACK_SWEETEN,
    offsetDays: 332,
    condition: isNotDry,
  },
  {
    key: "bottling",
    description: STEP_BOTTLING,
    offsetDays: 365,
    condition: always,
  },
];

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function generateProcessPlan(input: GenerationInput): DiaryEntryDraft[] {
  return STEP_TEMPLATES.filter((step) => step.condition(input)).map((step) => ({
    description: step.description,
    entry_date: addDays(input.batch.batch_date, step.offsetDays),
    entry_type: "auto" as const,
  }));
}
