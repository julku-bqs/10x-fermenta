import { describe, expect, it } from "vitest";
import { createBatchSchema, ingredientSchema, updateBatchSchema } from "@/lib/schemas/batch";

describe("ingredientSchema", () => {
  it("validates a valid user_input ingredient", () => {
    const result = ingredientSchema.safeParse({
      type: "user_input",
      name: "Grape juice",
      amount_liters: 10,
      sugar_content_percent: 20,
      sort_order: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = ingredientSchema.safeParse({
      type: "user_input",
      name: "",
      amount_liters: 10,
      sugar_content_percent: null,
      sort_order: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount_liters", () => {
    const result = ingredientSchema.safeParse({
      type: "user_input",
      name: "Juice",
      amount_liters: -1,
      sugar_content_percent: null,
      sort_order: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts amount_liters of 0 (sugar entry with no amount yet)", () => {
    const result = ingredientSchema.safeParse({
      type: "fermentation_sugar",
      name: "Fermentation sugar",
      amount_liters: 0,
      sort_order: -2,
    });
    expect(result.success).toBe(true);
  });

  it("defaults sugar_content_percent to null when omitted", () => {
    const result = ingredientSchema.safeParse({
      type: "user_input",
      name: "Juice",
      amount_liters: 5,
      sort_order: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sugar_content_percent).toBeNull();
    }
  });

  it("rejects sugar_content_percent above 100", () => {
    const result = ingredientSchema.safeParse({
      type: "user_input",
      name: "Juice",
      amount_liters: 5,
      sugar_content_percent: 101,
      sort_order: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects sugar_content_percent below 0", () => {
    const result = ingredientSchema.safeParse({
      type: "user_input",
      name: "Juice",
      amount_liters: 5,
      sugar_content_percent: -1,
      sort_order: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts fermentation_sugar and sweetness_sugar types", () => {
    expect(
      ingredientSchema.safeParse({
        type: "fermentation_sugar",
        name: "Fermentation sugar",
        amount_liters: 2.5,
        sugar_content_percent: 100,
        sort_order: -2,
      }).success,
    ).toBe(true);
    expect(
      ingredientSchema.safeParse({
        type: "sweetness_sugar",
        name: "Sweetness sugar",
        amount_liters: 0.3,
        sugar_content_percent: 100,
        sort_order: -1,
      }).success,
    ).toBe(true);
  });

  it("rejects invalid ingredient type", () => {
    const result = ingredientSchema.safeParse({
      type: "unknown_type",
      name: "Juice",
      amount_liters: 5,
      sort_order: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("createBatchSchema ingredients", () => {
  const baseFields = { name: "Test batch", process_type: "juice" };

  it("defaults ingredients to empty array when not provided", () => {
    const result = createBatchSchema.safeParse(baseFields);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ingredients).toEqual([]);
    }
  });

  it("accepts a valid ingredients array", () => {
    const result = createBatchSchema.safeParse({
      ...baseFields,
      ingredients: [
        { type: "user_input", name: "Grape juice", amount_liters: 10, sugar_content_percent: 20, sort_order: 0 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ingredients).toHaveLength(1);
    }
  });

  it("rejects malformed ingredient — empty name", () => {
    const result = createBatchSchema.safeParse({
      ...baseFields,
      ingredients: [{ type: "user_input", name: "", amount_liters: 10, sort_order: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects malformed ingredient — negative amount", () => {
    const result = createBatchSchema.safeParse({
      ...baseFields,
      ingredients: [{ type: "user_input", name: "Juice", amount_liters: -5, sort_order: 0 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateBatchSchema ingredients", () => {
  it("does not include ingredients when not provided (preserves partial update)", () => {
    const result = updateBatchSchema.safeParse({ name: "Updated name" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ingredients).toBeUndefined();
    }
  });

  it("accepts ingredients in partial update", () => {
    const result = updateBatchSchema.safeParse({
      ingredients: [{ type: "user_input", name: "Honey", amount_liters: 2, sort_order: 0 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ingredients).toHaveLength(1);
    }
  });

  it("accepts empty ingredients array (explicitly clearing all ingredients)", () => {
    const result = updateBatchSchema.safeParse({ ingredients: [] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ingredients).toEqual([]);
    }
  });

  // 2.6 verification: when ingredients is absent, JSON.stringify strips the key entirely —
  // meaning Supabase's .update(result.data) will NOT include ingredients in the SQL UPDATE,
  // so the existing JSONB column value is preserved.
  it("serializes to JSON without ingredients key when absent — Supabase partial update safe", () => {
    const result = updateBatchSchema.safeParse({ name: "Updated name" });
    expect(result.success).toBe(true);
    if (result.success) {
      const serialized = JSON.parse(JSON.stringify(result.data)) as Record<string, unknown>;
      expect("ingredients" in serialized).toBe(false);
    }
  });

  // 2.7 verification: Zod rejects malformed ingredient payloads in PUT body
  it("rejects malformed ingredient — missing name", () => {
    const result = updateBatchSchema.safeParse({
      ingredients: [{ type: "user_input", name: "", amount_liters: 5, sort_order: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects malformed ingredient — negative amount in PUT body", () => {
    const result = updateBatchSchema.safeParse({
      ingredients: [{ type: "user_input", name: "Juice", amount_liters: -3, sort_order: 0 }],
    });
    expect(result.success).toBe(false);
  });

  // 2.4 verification: PUT with valid ingredients array is accepted and fully shaped
  it("accepts valid ingredients array and shapes all fields correctly", () => {
    const result = updateBatchSchema.safeParse({
      name: "Batch with ingredients",
      ingredients: [
        { type: "user_input", name: "Grape juice", amount_liters: 15, sugar_content_percent: 18, sort_order: 0 },
        {
          type: "fermentation_sugar",
          name: "Fermentation sugar",
          amount_liters: 2.5,
          sugar_content_percent: 100,
          sort_order: -2,
        },
        { type: "sweetness_sugar", name: "Sweetness sugar", amount_liters: 0.3, sort_order: -1 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ingredients).toHaveLength(3);
      expect(result.data.ingredients?.[2].sugar_content_percent).toBeNull();
    }
  });
});
