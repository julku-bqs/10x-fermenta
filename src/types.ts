export interface Batch {
  id: string;
  user_id: string;
  name: string;
  batch_date: string | null;
  process_type: "pulp" | "juice";
  target_volume_liters: number | null;
  target_abv: number | null;
  planned_sweetness: "dry" | "semi_dry" | "semi_sweet" | "sweet";
  yeast_name: string | null;
  yeast_alcohol_tolerance: number | null;
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

export type ApiResponse<T> = { data: T } | { error: string; details?: Record<string, string[]> };
