import { describe, expect, it } from "vitest";
import { createBatchSchema, ingredientSchema, updateBatchSchema } from "@/lib/schemas/batch";

describe("ingredientSchema", () => {
  it("validates a valid ingredient", () => {
    const result = ingredientSchema.safeParse({
      name: "Grape juice",
      amount_liters: 10,
      sugar_content_percent: 20,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = ingredientSchema.safeParse({
      name: "",
      amount_liters: 10,
      sugar_content_percent: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount_liters", () => {
    const result = ingredientSchema.safeParse({
      name: "Juice",
      amount_liters: -1,
      sugar_content_percent: null,
    });
    expect(result.success).toBe(false);
  });

  it("accepts amount_liters of 0", () => {
    const result = ingredientSchema.safeParse({
      name: "Juice",
      amount_liters: 0,
    });
    expect(result.success).toBe(true);
  });

  it("defaults sugar_content_percent to null when omitted", () => {
    const result = ingredientSchema.safeParse({
      name: "Juice",
      amount_liters: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sugar_content_percent).toBeNull();
    }
  });

  it("rejects sugar_content_percent above 100", () => {
    const result = ingredientSchema.safeParse({
      name: "Juice",
      amount_liters: 5,
      sugar_content_percent: 101,
    });
    expect(result.success).toBe(false);
  });

  it("rejects sugar_content_percent below 0", () => {
    const result = ingredientSchema.safeParse({
      name: "Juice",
      amount_liters: 5,
      sugar_content_percent: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("createBatchSchema", () => {
  const baseFields = { name: "Test batch", process_type: "juice" };

  it("defaults ingredients to empty array when not provided", () => {
    const result = createBatchSchema.safeParse(baseFields);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ingredients).toEqual([]);
    }
  });

  it("defaults fermentation_sugar_kg to 0 when not provided", () => {
    const result = createBatchSchema.safeParse(baseFields);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fermentation_sugar_kg).toBe(0);
    }
  });

  it("defaults sweetness_sugar_kg to 0 when not provided", () => {
    const result = createBatchSchema.safeParse(baseFields);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sweetness_sugar_kg).toBe(0);
    }
  });

  it("rejects negative fermentation_sugar_kg", () => {
    const result = createBatchSchema.safeParse({ ...baseFields, fermentation_sugar_kg: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects negative sweetness_sugar_kg", () => {
    const result = createBatchSchema.safeParse({ ...baseFields, sweetness_sugar_kg: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts a valid ingredients array", () => {
    const result = createBatchSchema.safeParse({
      ...baseFields,
      ingredients: [{ name: "Grape juice", amount_liters: 10, sugar_content_percent: 20 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ingredients).toHaveLength(1);
    }
  });

  it("rejects malformed ingredient — empty name", () => {
    const result = createBatchSchema.safeParse({
      ...baseFields,
      ingredients: [{ name: "", amount_liters: 10 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects malformed ingredient — negative amount", () => {
    const result = createBatchSchema.safeParse({
      ...baseFields,
      ingredients: [{ name: "Juice", amount_liters: -5 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateBatchSchema", () => {
  it("does not include ingredients when not provided (preserves partial update)", () => {
    const result = updateBatchSchema.safeParse({ name: "Updated name" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ingredients).toBeUndefined();
    }
  });

  it("does not include fermentation_sugar_kg when not provided", () => {
    const result = updateBatchSchema.safeParse({ name: "Updated name" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fermentation_sugar_kg).toBeUndefined();
    }
  });

  it("does not include sweetness_sugar_kg when not provided", () => {
    const result = updateBatchSchema.safeParse({ name: "Updated name" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sweetness_sugar_kg).toBeUndefined();
    }
  });

  it("accepts sugar fields in partial update", () => {
    const result = updateBatchSchema.safeParse({
      fermentation_sugar_kg: 2.5,
      sweetness_sugar_kg: 0.3,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fermentation_sugar_kg).toBe(2.5);
      expect(result.data.sweetness_sugar_kg).toBe(0.3);
    }
  });

  it("accepts ingredients in partial update", () => {
    const result = updateBatchSchema.safeParse({
      ingredients: [{ name: "Honey", amount_liters: 2 }],
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

  it("serializes to JSON without optional keys when absent — Supabase partial update safe", () => {
    const result = updateBatchSchema.safeParse({ name: "Updated name" });
    expect(result.success).toBe(true);
    if (result.success) {
      const serialized = JSON.parse(JSON.stringify(result.data)) as Record<string, unknown>;
      expect("ingredients" in serialized).toBe(false);
      expect("fermentation_sugar_kg" in serialized).toBe(false);
      expect("sweetness_sugar_kg" in serialized).toBe(false);
      expect("batch_date" in serialized).toBe(false);
      expect("target_volume_liters" in serialized).toBe(false);
      expect("target_abv" in serialized).toBe(false);
      expect("planned_sweetness" in serialized).toBe(false);
      expect("yeast_name" in serialized).toBe(false);
      expect("yeast_alcohol_tolerance" in serialized).toBe(false);
    }
  });

  it("rejects malformed ingredient — missing name", () => {
    const result = updateBatchSchema.safeParse({
      ingredients: [{ name: "", amount_liters: 5 }],
    });
    expect(result.success).toBe(false);
  });
});
