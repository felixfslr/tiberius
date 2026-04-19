export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      agents: {
        Row: {
          config: Json;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          config?: Json;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          config?: Json;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      api_keys: {
        Row: {
          agent_id: string | null;
          created_at: string;
          id: string;
          key_hash: string;
          key_prefix: string;
          last_used_at: string | null;
          name: string;
        };
        Insert: {
          agent_id?: string | null;
          created_at?: string;
          id?: string;
          key_hash: string;
          key_prefix: string;
          last_used_at?: string | null;
          name: string;
        };
        Update: {
          agent_id?: string | null;
          created_at?: string;
          id?: string;
          key_hash?: string;
          key_prefix?: string;
          last_used_at?: string | null;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "api_keys_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
        ];
      };
      chunks: {
        Row: {
          agent_id: string;
          content: string;
          content_type: string;
          created_at: string;
          edited_by_user: boolean;
          embedding: string | null;
          file_id: string | null;
          fts: unknown;
          id: string;
          metadata: Json;
          position: number;
        };
        Insert: {
          agent_id: string;
          content: string;
          content_type?: string;
          created_at?: string;
          edited_by_user?: boolean;
          embedding?: string | null;
          file_id?: string | null;
          fts?: unknown;
          id?: string;
          metadata?: Json;
          position?: number;
        };
        Update: {
          agent_id?: string;
          content?: string;
          content_type?: string;
          created_at?: string;
          edited_by_user?: boolean;
          embedding?: string | null;
          file_id?: string | null;
          fts?: unknown;
          id?: string;
          metadata?: Json;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "chunks_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chunks_file_id_fkey";
            columns: ["file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          agent_id: string;
          created_at: string;
          external_id: string | null;
          id: string;
          messages: Json;
          metadata: Json;
        };
        Insert: {
          agent_id: string;
          created_at?: string;
          external_id?: string | null;
          id?: string;
          messages?: Json;
          metadata?: Json;
        };
        Update: {
          agent_id?: string;
          created_at?: string;
          external_id?: string | null;
          id?: string;
          messages?: Json;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback: {
        Row: {
          agent_id: string;
          analyzed_at: string | null;
          applied_chunk_id: string | null;
          created_at: string;
          draft_reply: string | null;
          error: string | null;
          feedback_text: string;
          id: string;
          locked_at: string | null;
          processed_at: string | null;
          reply_log_id: string | null;
          retrieved_chunk_ids: string[];
          status: string;
          suggested_action: Json | null;
          trigger_message: string | null;
        };
        Insert: {
          agent_id: string;
          analyzed_at?: string | null;
          applied_chunk_id?: string | null;
          created_at?: string;
          draft_reply?: string | null;
          error?: string | null;
          feedback_text: string;
          id?: string;
          locked_at?: string | null;
          processed_at?: string | null;
          reply_log_id?: string | null;
          retrieved_chunk_ids?: string[];
          status?: string;
          suggested_action?: Json | null;
          trigger_message?: string | null;
        };
        Update: {
          agent_id?: string;
          analyzed_at?: string | null;
          applied_chunk_id?: string | null;
          created_at?: string;
          draft_reply?: string | null;
          error?: string | null;
          feedback_text?: string;
          id?: string;
          locked_at?: string | null;
          processed_at?: string | null;
          reply_log_id?: string | null;
          retrieved_chunk_ids?: string[];
          status?: string;
          suggested_action?: Json | null;
          trigger_message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedback_applied_chunk_id_fkey";
            columns: ["applied_chunk_id"];
            isOneToOne: false;
            referencedRelation: "chunks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedback_reply_log_id_fkey";
            columns: ["reply_log_id"];
            isOneToOne: false;
            referencedRelation: "reply_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      files: {
        Row: {
          agent_id: string;
          error: string | null;
          file_type: string;
          filename: string;
          folder_id: string | null;
          id: string;
          metadata: Json;
          mime_type: string | null;
          processed_at: string | null;
          size_bytes: number | null;
          status: string;
          storage_path: string;
          uploaded_at: string;
        };
        Insert: {
          agent_id: string;
          error?: string | null;
          file_type?: string;
          filename: string;
          folder_id?: string | null;
          id?: string;
          metadata?: Json;
          mime_type?: string | null;
          processed_at?: string | null;
          size_bytes?: number | null;
          status?: string;
          storage_path: string;
          uploaded_at?: string;
        };
        Update: {
          agent_id?: string;
          error?: string | null;
          file_type?: string;
          filename?: string;
          folder_id?: string | null;
          id?: string;
          metadata?: Json;
          mime_type?: string | null;
          processed_at?: string | null;
          size_bytes?: number | null;
          status?: string;
          storage_path?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "files_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "files_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      folders: {
        Row: {
          agent_id: string;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          parent_id: string | null;
          updated_at: string;
        };
        Insert: {
          agent_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          parent_id?: string | null;
          updated_at?: string;
        };
        Update: {
          agent_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          parent_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "folders_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "folders_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      reply_logs: {
        Row: {
          agent_id: string;
          confidence: number | null;
          confidence_breakdown: Json | null;
          created_at: string;
          debug: Json | null;
          detected_intent: string | null;
          draft: string | null;
          history: Json;
          id: string;
          reasoning: string | null;
          retrieved_chunk_ids: string[];
          suggested_tool: string | null;
          tool_args: Json | null;
          trigger_message: string;
        };
        Insert: {
          agent_id: string;
          confidence?: number | null;
          confidence_breakdown?: Json | null;
          created_at?: string;
          debug?: Json | null;
          detected_intent?: string | null;
          draft?: string | null;
          history?: Json;
          id?: string;
          reasoning?: string | null;
          retrieved_chunk_ids?: string[];
          suggested_tool?: string | null;
          tool_args?: Json | null;
          trigger_message: string;
        };
        Update: {
          agent_id?: string;
          confidence?: number | null;
          confidence_breakdown?: Json | null;
          created_at?: string;
          debug?: Json | null;
          detected_intent?: string | null;
          draft?: string | null;
          history?: Json;
          id?: string;
          reasoning?: string | null;
          retrieved_chunk_ids?: string[];
          suggested_tool?: string | null;
          tool_args?: Json | null;
          trigger_message?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reply_logs_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      chunk_retrieval_counts: {
        Args: { p_agent_id: string };
        Returns: {
          chunk_id: string;
          retrieval_count: number;
        }[];
      };
      claim_applying_feedback: {
        Args: never;
        Returns: {
          fb_agent_id: string;
          fb_id: string;
          fb_suggested_action: Json;
        }[];
      };
      claim_pending_feedback: {
        Args: never;
        Returns: {
          fb_agent_id: string;
          fb_draft_reply: string;
          fb_feedback_text: string;
          fb_id: string;
          fb_retrieved_chunk_ids: string[];
          fb_trigger_message: string;
        }[];
      };
      claim_pending_file: {
        Args: never;
        Returns: {
          file_agent_id: string;
          file_file_type: string;
          file_id: string;
          file_mime_type: string;
          file_storage_path: string;
        }[];
      };
      co_retrieval_edges: {
        Args: { p_agent_id: string };
        Returns: {
          a: string;
          b: string;
          weight: number;
        }[];
      };
      graph_neighbors: {
        Args: { p_agent_id: string; p_k?: number };
        Returns: {
          similarity: number;
          source_id: string;
          target_id: string;
        }[];
      };
      hybrid_search: {
        Args: {
          p_agent_id: string;
          p_content_types?: string[];
          p_embedding: string;
          p_filter?: Json;
          p_k?: number;
          p_query: string;
          p_rrf_k?: number;
        };
        Returns: {
          content: string;
          content_type: string;
          file_id: string;
          fts_rank: number;
          id: string;
          metadata: Json;
          score: number;
          vector_rank: number;
        }[];
      };
      search_chunks_fts: {
        Args: {
          p_agent_id: string;
          p_content_types?: string[];
          p_filter?: Json;
          p_k?: number;
          p_query: string;
        };
        Returns: {
          content: string;
          content_type: string;
          file_id: string;
          id: string;
          metadata: Json;
          rank: number;
        }[];
      };
      search_chunks_vector: {
        Args: {
          p_agent_id: string;
          p_content_types?: string[];
          p_embedding: string;
          p_filter?: Json;
          p_k?: number;
        };
        Returns: {
          content: string;
          content_type: string;
          distance: number;
          file_id: string;
          id: string;
          metadata: Json;
        }[];
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
