import { describe, it, expect } from "vitest";
import { generateProcessPlan, STEP_TEMPLATES, type GenerationInput } from "../process-plan-generation";

function makeInput(overrides: Partial<GenerationInput["batch"]> = {}): GenerationInput {
  return {
    batch: {
      batch_date: "2026-01-15",
      process_type: "juice",
      planned_sweetness: "dry",
      fermentation_sugar_kg: 0,
      ...overrides,
    },
  };
}

describe("generateProcessPlan", () => {
  describe("juice process", () => {
    it("juice + dry + no sugar → 11 steps", () => {
      const result = generateProcessPlan(makeInput());
      expect(result).toHaveLength(11);
      expect(result[0].description).toContain("pour juice");
      expect(result.every((e) => !e.description.includes("crush fruit"))).toBe(true);
      expect(result.every((e) => !e.description.includes("cap management"))).toBe(true);
      expect(result.every((e) => !e.description.includes("Press"))).toBe(true);
    });

    it("juice + dry + fermentation_sugar_kg > 0 → 12 steps", () => {
      const result = generateProcessPlan(makeInput({ fermentation_sugar_kg: 1.5 }));
      expect(result).toHaveLength(12);
      expect(result.some((e) => e.description.includes("fermentation sugar"))).toBe(true);
    });

    it("juice + semi_sweet + fermentation_sugar_kg > 0 → 14 steps", () => {
      const result = generateProcessPlan(
        makeInput({
          planned_sweetness: "semi_sweet",
          fermentation_sugar_kg: 2.0,
        }),
      );
      expect(result).toHaveLength(14);
      expect(result.some((e) => e.description.includes("Stabilize"))).toBe(true);
      expect(result.some((e) => e.description.includes("Back-sweeten"))).toBe(true);
    });
  });

  describe("pulp process", () => {
    it("pulp + dry + no sugar → 13 steps", () => {
      const result = generateProcessPlan(makeInput({ process_type: "pulp", fermentation_sugar_kg: 0 }));
      expect(result).toHaveLength(13);
      expect(result[0].description).toContain("crush fruit");
      expect(result.some((e) => e.description.includes("cap management"))).toBe(true);
      expect(result.some((e) => e.description.includes("Press"))).toBe(true);
    });

    it("pulp + sweet + fermentation_sugar_kg > 0 → 16 steps (all conditions met)", () => {
      const result = generateProcessPlan(
        makeInput({
          process_type: "pulp",
          planned_sweetness: "sweet",
          fermentation_sugar_kg: 3.0,
        }),
      );
      expect(result).toHaveLength(16);
    });
  });

  describe("date computation", () => {
    it("batch_date 2026-01-15 + offset 14 → entry_date 2026-01-29", () => {
      const result = generateProcessPlan(makeInput());
      const rackStep = result.find((e) => e.description.includes("Rack to secondary"));
      expect(rackStep?.entry_date).toBe("2026-01-29");
    });

    it("computes correct dates for day 0 steps", () => {
      const result = generateProcessPlan(makeInput());
      const day0Steps = result.filter((e) => e.entry_date === "2026-01-15");
      expect(day0Steps.length).toBeGreaterThanOrEqual(2);
    });

    it("computes bottling at day 365", () => {
      const result = generateProcessPlan(makeInput());
      const bottling = result.find((e) => e.description.includes("Bottling"));
      expect(bottling?.entry_date).toBe("2027-01-15");
    });
  });

  describe("entry_type", () => {
    it("all generated entries have entry_type 'auto'", () => {
      const result = generateProcessPlan(
        makeInput({
          process_type: "pulp",
          planned_sweetness: "sweet",
          fermentation_sugar_kg: 3.0,
        }),
      );
      for (const entry of result) {
        expect(entry.entry_type).toBe("auto");
      }
    });
  });

  describe("mutual exclusivity", () => {
    it("juice batch never gets pulp-only steps (1b, cap management, press)", () => {
      const result = generateProcessPlan(makeInput());
      expect(result.every((e) => !e.description.includes("crush fruit"))).toBe(true);
      expect(result.every((e) => !e.description.includes("cap management"))).toBe(true);
      expect(result.every((e) => !e.description.includes("separate wine from pomace"))).toBe(true);
    });

    it("pulp batch never gets juice-only step (1a)", () => {
      const result = generateProcessPlan(makeInput({ process_type: "pulp" }));
      expect(result.every((e) => !e.description.includes("pour juice"))).toBe(true);
    });
  });

  describe("STEP_TEMPLATES", () => {
    it("exports step templates for testability", () => {
      expect(STEP_TEMPLATES).toBeDefined();
      expect(STEP_TEMPLATES.length).toBe(17);
    });

    it("each template has required fields", () => {
      for (const template of STEP_TEMPLATES) {
        expect(template.key).toBeTruthy();
        expect(template.description).toBeTruthy();
        expect(typeof template.offsetDays).toBe("number");
        expect(typeof template.condition).toBe("function");
      }
    });
  });
});
