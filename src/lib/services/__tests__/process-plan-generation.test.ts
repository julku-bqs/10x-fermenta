import { describe, it, expect } from "vitest";
import { generateProcessPlan, type GenerationInput } from "../process-plan-generation";

// --- Local domain constants (never imported from production) ---

const DESCRIPTION_FRAGMENTS = {
  juice: "pour juice",
  pulp: "crush fruit",
  sugar: "fermentation sugar",
  capManagement: "cap management",
  press: "separate wine from pomace",
  stabilize: "Stabilize",
  backSweeten: "Back-sweeten",
  pitchYeast: "Pitch yeast",
  bottling: "Bottling",
  monitorPrimary: "Monitor primary",
  rackSecondary: "Rack to secondary",
  monitorSecondary: "Monitor secondary",
  confirmComplete: "Confirm fermentation complete",
  rackOffLees: "Rack off lees",
  bulkAging: "Bulk aging",
  agingCheck1: "taste, check clarity",
  agingCheck2: "taste, assess readiness",
} as const;

// Day offsets from the step matrix (research ground truth)
const OFFSETS = {
  prepareMust: 0,
  addSugar: 0,
  pitchYeast: 0,
  capManagement: 1,
  monitorPrimary: 5,
  press: 10,
  rackSecondary: 14,
  monitorSecondary: 21,
  confirmComplete: 28,
  rackOffLees: 35,
  bulkAging: 60,
  agingCheck1: 120,
  agingCheck2: 240,
  stabilize: 330,
  backSweeten: 332,
  bottling: 365,
} as const;

const BATCH_DATE = "2026-01-15";

// --- Helpers ---

function makeInput(overrides: Partial<GenerationInput["batch"]> = {}): GenerationInput {
  return {
    batch: {
      batch_date: BATCH_DATE,
      process_type: "juice",
      planned_sweetness: "dry",
      fermentation_sugar_kg: 0,
      ...overrides,
    },
  };
}

function addDaysToDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// --- Tests ---

describe("generateProcessPlan", () => {
  describe("step presence/absence matrix", () => {
    const { juice, pulp, sugar, capManagement, press, stabilize, backSweeten, pitchYeast, bottling } =
      DESCRIPTION_FRAGMENTS;

    it.each<[string, GenerationInput, { expectedPresent: string[]; expectedAbsent: string[]; expectedCount: number }]>([
      [
        "P1: juice × dry × no sugar → 11 steps",
        makeInput(),
        {
          expectedPresent: [juice, pitchYeast, bottling],
          expectedAbsent: [pulp, capManagement, press, sugar, stabilize, backSweeten],
          expectedCount: 11,
        },
      ],
      [
        "P2: juice × dry × with sugar → 12 steps",
        makeInput({ fermentation_sugar_kg: 1.5 }),
        {
          expectedPresent: [juice, sugar, pitchYeast, bottling],
          expectedAbsent: [pulp, capManagement, press, stabilize, backSweeten],
          expectedCount: 12,
        },
      ],
      [
        "P3: juice × non-dry × no sugar → 13 steps",
        makeInput({ planned_sweetness: "semi_sweet" }),
        {
          expectedPresent: [juice, stabilize, backSweeten, pitchYeast, bottling],
          expectedAbsent: [pulp, capManagement, press, sugar],
          expectedCount: 13,
        },
      ],
      [
        "P4: juice × non-dry × with sugar → 14 steps",
        makeInput({ planned_sweetness: "semi_sweet", fermentation_sugar_kg: 2.0 }),
        {
          expectedPresent: [juice, sugar, stabilize, backSweeten, pitchYeast, bottling],
          expectedAbsent: [pulp, capManagement, press],
          expectedCount: 14,
        },
      ],
      [
        "P5: pulp × dry × no sugar → 13 steps",
        makeInput({ process_type: "pulp" }),
        {
          expectedPresent: [pulp, capManagement, press, pitchYeast, bottling],
          expectedAbsent: [juice, sugar, stabilize, backSweeten],
          expectedCount: 13,
        },
      ],
      [
        "P6: pulp × dry × with sugar → 14 steps",
        makeInput({ process_type: "pulp", fermentation_sugar_kg: 1.5 }),
        {
          expectedPresent: [pulp, capManagement, press, sugar, pitchYeast, bottling],
          expectedAbsent: [juice, stabilize, backSweeten],
          expectedCount: 14,
        },
      ],
      [
        "P7: pulp × non-dry × no sugar → 15 steps",
        makeInput({ process_type: "pulp", planned_sweetness: "sweet" }),
        {
          expectedPresent: [pulp, capManagement, press, stabilize, backSweeten, pitchYeast, bottling],
          expectedAbsent: [juice, sugar],
          expectedCount: 15,
        },
      ],
      [
        "P8: pulp × non-dry × with sugar → 16 steps (all conditions met)",
        makeInput({ process_type: "pulp", planned_sweetness: "sweet", fermentation_sugar_kg: 3.0 }),
        {
          expectedPresent: [pulp, capManagement, press, sugar, stabilize, backSweeten, pitchYeast, bottling],
          expectedAbsent: [juice],
          expectedCount: 16,
        },
      ],
    ])("%s", (_name, input, { expectedPresent, expectedAbsent, expectedCount }) => {
      const result = generateProcessPlan(input);
      const descriptions = result.map((s) => s.description);

      expect(result).toHaveLength(expectedCount);

      for (const fragment of expectedPresent) {
        expect(descriptions).toEqual(expect.arrayContaining([expect.stringContaining(fragment)]));
      }

      for (const fragment of expectedAbsent) {
        expect(descriptions.join("\n")).not.toContain(fragment);
      }

      // All entries must have entry_type "auto"
      for (const entry of result) {
        expect(entry.entry_type).toBe("auto");
      }
    });
  });

  describe("negative assertions", () => {
    it.each<[string, GenerationInput, string[]]>([
      [
        "P9: juice has NO pulp steps",
        makeInput({ planned_sweetness: "sweet", fermentation_sugar_kg: 2.0 }),
        [DESCRIPTION_FRAGMENTS.pulp, DESCRIPTION_FRAGMENTS.capManagement, DESCRIPTION_FRAGMENTS.press],
      ],
      [
        "P10: pulp has NO juice steps",
        makeInput({ process_type: "pulp", planned_sweetness: "sweet", fermentation_sugar_kg: 2.0 }),
        [DESCRIPTION_FRAGMENTS.juice],
      ],
      [
        "P11: dry has NO non-dry steps",
        makeInput({ process_type: "pulp", fermentation_sugar_kg: 2.0 }),
        [DESCRIPTION_FRAGMENTS.stabilize, DESCRIPTION_FRAGMENTS.backSweeten],
      ],
      [
        "P12: sugar=0 has NO sugar step",
        makeInput({ process_type: "pulp", planned_sweetness: "sweet", fermentation_sugar_kg: 0 }),
        [DESCRIPTION_FRAGMENTS.sugar],
      ],
    ])("%s", (_name, input, mustBeAbsent) => {
      const result = generateProcessPlan(input);
      const allDescriptions = result.map((s) => s.description).join("\n");

      for (const fragment of mustBeAbsent) {
        expect(allDescriptions).not.toContain(fragment);
      }
    });
  });

  describe("day offsets and ordering", () => {
    it.each<[string, GenerationInput, string, number]>([
      [
        "P13: cap_management at day 1",
        makeInput({ process_type: "pulp" }),
        DESCRIPTION_FRAGMENTS.capManagement,
        OFFSETS.capManagement,
      ],
      ["P13: press at day 10", makeInput({ process_type: "pulp" }), DESCRIPTION_FRAGMENTS.press, OFFSETS.press],
      [
        "P13: stabilize at day 330",
        makeInput({ planned_sweetness: "semi_dry" }),
        DESCRIPTION_FRAGMENTS.stabilize,
        OFFSETS.stabilize,
      ],
      [
        "P13: back_sweeten at day 332",
        makeInput({ planned_sweetness: "semi_dry" }),
        DESCRIPTION_FRAGMENTS.backSweeten,
        OFFSETS.backSweeten,
      ],
      ["P14: pitch_yeast at day 0", makeInput(), DESCRIPTION_FRAGMENTS.pitchYeast, OFFSETS.pitchYeast],
      ["P14: rack_secondary at day 14", makeInput(), DESCRIPTION_FRAGMENTS.rackSecondary, OFFSETS.rackSecondary],
      ["P14: confirm_complete at day 28", makeInput(), DESCRIPTION_FRAGMENTS.confirmComplete, OFFSETS.confirmComplete],
      ["P14: bottling at day 365", makeInput(), DESCRIPTION_FRAGMENTS.bottling, OFFSETS.bottling],
    ])("%s", (_name, input, descriptionFragment, offsetDays) => {
      const result = generateProcessPlan(input);
      const step = result.find((s) => s.description.includes(descriptionFragment));
      const expectedDate = addDaysToDate(BATCH_DATE, offsetDays);

      expect(step).toBeDefined();
      expect(step?.entry_date).toBe(expectedDate);
    });

    it("P15: all steps in ascending chronological order", () => {
      // Use maximum-steps input to get all 16 steps
      const result = generateProcessPlan(
        makeInput({ process_type: "pulp", planned_sweetness: "sweet", fermentation_sugar_kg: 3.0 }),
      );

      for (let i = 1; i < result.length; i++) {
        expect(result[i].entry_date >= result[i - 1].entry_date).toBe(true);
      }
    });

    it("P16: fermentation_sugar_kg = 0 (exact zero) → sugar step absent", () => {
      const result = generateProcessPlan(makeInput({ fermentation_sugar_kg: 0 }));
      const allDescriptions = result.map((s) => s.description).join("\n");

      expect(allDescriptions).not.toContain(DESCRIPTION_FRAGMENTS.sugar);
    });

    it("P17: fermentation_sugar_kg = 0.001 (tiny positive) → sugar step present", () => {
      const result = generateProcessPlan(makeInput({ fermentation_sugar_kg: 0.001 }));
      const descriptions = result.map((s) => s.description);

      expect(descriptions).toEqual(expect.arrayContaining([expect.stringContaining(DESCRIPTION_FRAGMENTS.sugar)]));
    });
  });
});
