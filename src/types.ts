export type SweetnessLevel = "dry" | "semi_dry" | "semi_sweet" | "sweet";

export interface Ingredient {
  name: string;
  amount_liters: number;
  sugar_content_percent: number | null;
}

export interface Batch {
  id: string;
  user_id: string;
  name: string;
  batch_date: string;
  process_type: "pulp" | "juice";
  target_volume_liters: number | null;
  target_abv: number | null;
  planned_sweetness: SweetnessLevel;
  yeast_name: string | null;
  yeast_alcohol_tolerance: number | null;
  fermentation_sugar_kg: number;
  sweetness_sugar_kg: number;
  ingredients: Ingredient[];
  created_at: string;
  updated_at: string;
}

export interface BatchListItem {
  id: string;
  name: string;
  batch_date: string | null;
  process_type: "pulp" | "juice";
  target_volume_liters: number | null;
  target_abv: number | null;
  planned_sweetness: "dry" | "semi_dry" | "semi_sweet" | "sweet";
}

export type DiaryEntryType = "auto" | "user";

export interface DiaryEntry {
  id: string;
  batch_id: string;
  description: string;
  notes: string | null;
  entry_date: string;
  completed: boolean;
  entry_type: DiaryEntryType;
  created_at: string;
  updated_at: string;
}

export interface BatchParams {
  name: string;
  batch_date: string;
  process_type: "pulp" | "juice" | "";
  target_volume_liters: number | null;
  target_abv: number | null;
  planned_sweetness: SweetnessLevel;
  yeast_name: string | null;
  yeast_alcohol_tolerance: number | null;
  fermentation_sugar_kg: number;
  sweetness_sugar_kg: number;
  ingredients: Ingredient[];
}

export type ApiResponse<T> = { data: T } | { error: string; details?: Record<string, string[]> };
