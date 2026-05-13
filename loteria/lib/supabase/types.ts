// Hand-written types matching supabase/migrations/0001_init.sql.
// Regenerate with `supabase gen types typescript` once a remote project is linked.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          name: string;
          theme: string | null;
          audience: string | null;
          tone: string | null;
          deck_size: number;
          board_size: number;
          board_count: number;
          status: "draft" | "in_progress" | "ready" | "exported" | "archived";
          style_preset: string | null;
          user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          theme?: string | null;
          audience?: string | null;
          tone?: string | null;
          deck_size?: number;
          board_size?: number;
          board_count?: number;
          status?: "draft" | "in_progress" | "ready" | "exported" | "archived";
          style_preset?: string | null;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
        Relationships: [];
      };
      cards: {
        Row: {
          id: string;
          project_id: string;
          card_number: number;
          english_name: string;
          spanish_name: string;
          category: string | null;
          description: string | null;
          prompt: string | null;
          image_url: string | null;
          approved: boolean;
          version: number;
          is_custom_photo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          card_number: number;
          english_name: string;
          spanish_name: string;
          category?: string | null;
          description?: string | null;
          prompt?: string | null;
          image_url?: string | null;
          approved?: boolean;
          version?: number;
          is_custom_photo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cards"]["Insert"]>;
        Relationships: [];
      };
      boards: {
        Row: {
          id: string;
          project_id: string;
          board_number: number;
          label: string;
          card_ids: string[];
          seed: string | null;
          locked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          board_number: number;
          label: string;
          card_ids: string[];
          seed?: string | null;
          locked_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["boards"]["Insert"]>;
        Relationships: [];
      };
      validation_reports: {
        Row: {
          id: string;
          project_id: string;
          board_count: number;
          passes: boolean;
          checks_json: Json;
          card_frequencies_json: Json;
          warnings: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          board_count: number;
          passes: boolean;
          checks_json: Json;
          card_frequencies_json?: Json;
          warnings?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["validation_reports"]["Insert"]>;
        Relationships: [];
      };
      exports: {
        Row: {
          id: string;
          project_id: string;
          type: "boards_pdf" | "caller_deck_pdf" | "card_index_csv" | "rules_sheet" | "project_zip";
          file_url: string;
          metadata_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          type: "boards_pdf" | "caller_deck_pdf" | "card_index_csv" | "rules_sheet" | "project_zip";
          file_url: string;
          metadata_json?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exports"]["Insert"]>;
        Relationships: [];
      };
      card_generation_jobs: {
        Row: {
          id: string;
          card_id: string;
          project_id: string;
          mode: "text_to_image" | "image_to_image";
          provider: string;
          provider_job_id: string | null;
          prompt: string;
          reference_image_url: string | null;
          status: "queued" | "processing" | "succeeded" | "failed" | "cancelled";
          image_url: string | null;
          error: string | null;
          metadata_json: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          project_id: string;
          mode?: "text_to_image" | "image_to_image";
          provider?: string;
          provider_job_id?: string | null;
          prompt: string;
          reference_image_url?: string | null;
          status?: "queued" | "processing" | "succeeded" | "failed" | "cancelled";
          image_url?: string | null;
          error?: string | null;
          metadata_json?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["card_generation_jobs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      project_status: "draft" | "in_progress" | "ready" | "exported" | "archived";
      export_type: "boards_pdf" | "caller_deck_pdf" | "card_index_csv" | "rules_sheet" | "project_zip";
      card_generation_job_status: "queued" | "processing" | "succeeded" | "failed" | "cancelled";
      card_generation_job_mode: "text_to_image" | "image_to_image";
    };
  };
}
