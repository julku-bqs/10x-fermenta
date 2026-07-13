declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    supabase: import("@supabase/supabase-js").SupabaseClient | null;
  }
}
