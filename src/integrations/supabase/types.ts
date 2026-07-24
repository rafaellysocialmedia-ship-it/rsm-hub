export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      _vault_master: {
        Row: {
          created_at: string
          id: number
          key: string
        }
        Insert: {
          created_at?: string
          id?: number
          key: string
        }
        Update: {
          created_at?: string
          id?: number
          key?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: Json
          created_at: string
          id: string
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      briefing_template: {
        Row: {
          created_at: string
          id: string
          name: string
          sections: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          sections?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sections?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      briefings: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          meeting_date: string | null
          notes: string | null
          sections: Json
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_date?: string | null
          notes?: string | null
          sections?: Json
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_date?: string | null
          notes?: string | null
          sections?: Json
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_baselines: {
        Row: {
          avg_comments: number
          avg_impressions: number
          avg_likes: number
          avg_reach: number
          avg_saves: number
          avg_shares: number
          captured_at: string
          client_id: string
          created_at: string
          created_by: string | null
          engagement_rate: number
          followers: number
          id: string
          network: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          avg_comments?: number
          avg_impressions?: number
          avg_likes?: number
          avg_reach?: number
          avg_saves?: number
          avg_shares?: number
          captured_at?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          engagement_rate?: number
          followers?: number
          id?: string
          network?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          avg_comments?: number
          avg_impressions?: number
          avg_likes?: number
          avg_reach?: number
          avg_saves?: number
          avg_shares?: number
          captured_at?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          engagement_rate?: number
          followers?: number
          id?: string
          network?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_baselines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contracts: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          file_name: string | null
          id: string
          mime_type: string | null
          notes: string | null
          signed_at: string | null
          size_bytes: number | null
          status: string
          storage_path: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          signed_at?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          signed_at?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_journey_events: {
        Row: {
          changed_by: string | null
          client_id: string
          created_at: string
          id: string
          note: string | null
          stage: Database["public"]["Enums"]["client_journey_stage"]
        }
        Insert: {
          changed_by?: string | null
          client_id: string
          created_at?: string
          id?: string
          note?: string | null
          stage: Database["public"]["Enums"]["client_journey_stage"]
        }
        Update: {
          changed_by?: string | null
          client_id?: string
          created_at?: string
          id?: string
          note?: string | null
          stage?: Database["public"]["Enums"]["client_journey_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "client_journey_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_settings: {
        Row: {
          can_approve: boolean
          can_comment: boolean
          can_request_changes: boolean
          can_view_captions: boolean
          can_view_comments: boolean
          can_view_history: boolean
          can_view_media: boolean
          can_view_posts: boolean
          client_id: string
          updated_at: string
          updated_by: string | null
          visible_statuses: string[]
        }
        Insert: {
          can_approve?: boolean
          can_comment?: boolean
          can_request_changes?: boolean
          can_view_captions?: boolean
          can_view_comments?: boolean
          can_view_history?: boolean
          can_view_media?: boolean
          can_view_posts?: boolean
          client_id: string
          updated_at?: string
          updated_by?: string | null
          visible_statuses?: string[]
        }
        Update: {
          can_approve?: boolean
          can_comment?: boolean
          can_request_changes?: boolean
          can_view_captions?: boolean
          can_view_comments?: boolean
          can_view_history?: boolean
          can_view_media?: boolean
          can_view_posts?: boolean
          client_id?: string
          updated_at?: string
          updated_by?: string | null
          visible_statuses?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          cnpj: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          journey_stage: Database["public"]["Enums"]["client_journey_stage"]
          journey_updated_at: string
          legal_name: string | null
          logo_url: string | null
          monthly_post_quota: number | null
          name: string
          notes: string | null
          phone: string | null
          plan: string | null
          responsible: string | null
          segment: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          journey_stage?: Database["public"]["Enums"]["client_journey_stage"]
          journey_updated_at?: string
          legal_name?: string | null
          logo_url?: string | null
          monthly_post_quota?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          plan?: string | null
          responsible?: string | null
          segment?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          journey_stage?: Database["public"]["Enums"]["client_journey_stage"]
          journey_updated_at?: string
          legal_name?: string | null
          logo_url?: string | null
          monthly_post_quota?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          plan?: string | null
          responsible?: string | null
          segment?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      commemorative_dates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          day: number
          emoji: string | null
          id: string
          is_national: boolean
          month: number
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          day: number
          emoji?: string | null
          id?: string
          is_national?: boolean
          month: number
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          day?: number
          emoji?: string | null
          id?: string
          is_national?: boolean
          month?: number
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      course_lessons: {
        Row: {
          content_type: string
          course_id: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          file_url: string | null
          id: string
          is_free_preview: boolean
          module_id: string
          sort_order: number
          text_content: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          content_type?: string
          course_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          file_url?: string | null
          id?: string
          is_free_preview?: boolean
          module_id: string
          sort_order?: number
          text_content?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          content_type?: string
          course_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          file_url?: string | null
          id?: string
          is_free_preview?: boolean
          module_id?: string
          sort_order?: number
          text_content?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_purchases: {
        Row: {
          amount_cents: number
          course_id: string
          created_at: string
          currency: string
          external_id: string | null
          id: string
          note: string | null
          paid_at: string | null
          provider: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          course_id: string
          created_at?: string
          currency?: string
          external_id?: string | null
          id?: string
          note?: string | null
          paid_at?: string | null
          provider?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          course_id?: string
          created_at?: string
          currency?: string
          external_id?: string | null
          id?: string
          note?: string | null
          paid_at?: string | null
          provider?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_purchases_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_published: boolean
          level: string | null
          price_cents: number
          short_description: string | null
          slug: string
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean
          level?: string | null
          price_cents?: number
          short_description?: string | null
          slug: string
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean
          level?: string | null
          price_cents?: number
          short_description?: string | null
          slug?: string
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      file_folders: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_folders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "file_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          category: Database["public"]["Enums"]["file_category"]
          client_id: string | null
          created_at: string
          description: string | null
          folder_id: string | null
          id: string
          mime_type: string | null
          name: string
          size_bytes: number
          storage_path: string
          tags: string[]
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["file_category"]
          client_id?: string | null
          created_at?: string
          description?: string | null
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name: string
          size_bytes?: number
          storage_path: string
          tags?: string[]
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["file_category"]
          client_id?: string | null
          created_at?: string
          description?: string | null
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number
          storage_path?: string
          tags?: string[]
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "file_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          amount: number
          category: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          due_date: string | null
          id: string
          issue_date: string
          notes: string | null
          paid_date: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["finance_status"]
          type: Database["public"]["Enums"]["finance_type"]
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["finance_status"]
          type?: Database["public"]["Enums"]["finance_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["finance_status"]
          type?: Database["public"]["Enums"]["finance_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          id: string
          location: string | null
          meeting_date: string
          meeting_time: string | null
          meeting_url: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          meeting_date: string
          meeting_time?: string | null
          meeting_url?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          meeting_date?: string
          meeting_time?: string | null
          meeting_url?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          notify_approvals: boolean
          notify_comments: boolean
          notify_files: boolean
          notify_publish: boolean
          notify_tasks: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          notify_approvals?: boolean
          notify_comments?: boolean
          notify_files?: boolean
          notify_publish?: boolean
          notify_tasks?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          notify_approvals?: boolean
          notify_comments?: boolean
          notify_files?: boolean
          notify_publish?: boolean
          notify_tasks?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      post_activity_log: {
        Row: {
          action: string
          actor_id: string | null
          client_id: string | null
          created_at: string
          detail: string | null
          id: string
          metadata: Json | null
          post_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          client_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          metadata?: Json | null
          post_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          client_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          metadata?: Json | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_activity_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_activity_log_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_approvals: {
        Row: {
          client_id: string
          created_at: string
          decided_by: string | null
          decision: Database["public"]["Enums"]["approval_decision"]
          feedback: string | null
          id: string
          post_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"]
          feedback?: string | null
          id?: string
          post_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"]
          feedback?: string | null
          id?: string
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_approvals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_approvals_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          post_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          post_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          post_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_files_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_metrics: {
        Row: {
          clicks: number
          collected_at: string
          comments: number
          created_at: string
          created_by: string | null
          followers_gained: number
          id: string
          impressions: number
          likes: number
          network: string | null
          notes: string | null
          post_id: string
          profile_visits: number
          reach: number
          saves: number
          shares: number
          updated_at: string
          video_views: number
        }
        Insert: {
          clicks?: number
          collected_at?: string
          comments?: number
          created_at?: string
          created_by?: string | null
          followers_gained?: number
          id?: string
          impressions?: number
          likes?: number
          network?: string | null
          notes?: string | null
          post_id: string
          profile_visits?: number
          reach?: number
          saves?: number
          shares?: number
          updated_at?: string
          video_views?: number
        }
        Update: {
          clicks?: number
          collected_at?: string
          comments?: number
          created_at?: string
          created_by?: string | null
          followers_gained?: number
          id?: string
          impressions?: number
          likes?: number
          network?: string | null
          notes?: string | null
          post_id?: string
          profile_visits?: number
          reach?: number
          saves?: number
          shares?: number
          updated_at?: string
          video_views?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_metrics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_versions: {
        Row: {
          change_note: string | null
          changed_by: string | null
          created_at: string
          id: string
          post_id: string
          snapshot: Json
          version_number: number
        }
        Insert: {
          change_note?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          post_id: string
          snapshot: Json
          version_number: number
        }
        Update: {
          change_note?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          post_id?: string
          snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_versions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          cta: string | null
          format: string | null
          hashtags: string | null
          headline: string | null
          id: string
          objective: string | null
          pillar: string | null
          position: number
          recurrence: Json | null
          scheduled_date: string | null
          scheduled_time: string | null
          social_network: string | null
          social_networks: string[]
          status: Database["public"]["Enums"]["post_status"]
          theme: string | null
          title: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          cta?: string | null
          format?: string | null
          hashtags?: string | null
          headline?: string | null
          id?: string
          objective?: string | null
          pillar?: string | null
          position?: number
          recurrence?: Json | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          social_network?: string | null
          social_networks?: string[]
          status?: Database["public"]["Enums"]["post_status"]
          theme?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          cta?: string | null
          format?: string | null
          hashtags?: string | null
          headline?: string | null
          id?: string
          objective?: string | null
          pillar?: string | null
          position?: number
          recurrence?: Json | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          social_network?: string | null
          social_networks?: string[]
          status?: Database["public"]["Enums"]["post_status"]
          theme?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      task_checklist: {
        Row: {
          content: string
          created_at: string
          done: boolean
          id: string
          position: number
          task_id: string
        }
        Insert: {
          content: string
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          task_id: string
        }
        Update: {
          content?: string
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_files: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_files_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          recurrence: Json | null
          source_post_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence?: Json | null
          source_post_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence?: Json | null
          source_post_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_post_id_fkey"
            columns: ["source_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vault_attachments: {
        Row: {
          created_at: string
          credential_id: string
          file_name: string
          id: string
          label: string | null
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          credential_id: string
          file_name: string
          id?: string
          label?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          credential_id?: string
          file_name?: string
          id?: string
          label?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_attachments_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "vault_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_credential_history: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          credential_id: string
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          credential_id: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          credential_id?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_credential_history_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "vault_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_credentials: {
        Row: {
          backup_codes_encrypted: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          has_2fa: boolean
          id: string
          notes: string | null
          password_encrypted: string
          platform: string
          updated_at: string
          url: string | null
          username: string
        }
        Insert: {
          backup_codes_encrypted?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          has_2fa?: boolean
          id?: string
          notes?: string | null
          password_encrypted: string
          platform: string
          updated_at?: string
          url?: string | null
          username: string
        }
        Update: {
          backup_codes_encrypted?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          has_2fa?: boolean
          id?: string
          notes?: string | null
          password_encrypted?: string
          platform?: string
          updated_at?: string
          url?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_credentials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          created_at: string
          id: number
          logo_url: string | null
          name: string
          primary_color: string | null
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_publish_scheduled_posts: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      notify_overdue_and_upcoming: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_owns_course: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      vault_create_credential:
        | {
            Args: {
              _client_id?: string
              _notes?: string
              _password: string
              _platform: string
              _url?: string
              _username: string
            }
            Returns: string
          }
        | {
            Args: {
              _backup_codes?: string
              _client_id?: string
              _has_2fa?: boolean
              _notes?: string
              _password: string
              _platform: string
              _url?: string
              _username: string
            }
            Returns: string
          }
      vault_reveal_backup_codes: { Args: { _id: string }; Returns: string }
      vault_reveal_password: { Args: { _id: string }; Returns: string }
      vault_update_credential:
        | {
            Args: {
              _client_id: string
              _id: string
              _notes: string
              _password: string
              _platform: string
              _url: string
              _username: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _backup_codes?: string
              _client_id: string
              _has_2fa?: boolean
              _id: string
              _notes: string
              _password: string
              _platform: string
              _url: string
              _username: string
            }
            Returns: undefined
          }
    }
    Enums: {
      app_role: "administrator" | "team" | "client"
      approval_decision:
        | "pending"
        | "approved"
        | "rejected"
        | "changes_requested"
      client_journey_stage:
        | "closing"
        | "kickoff"
        | "onboarding"
        | "ongoing"
        | "renewal"
        | "offboarded"
      client_status: "active" | "inactive" | "paused" | "prospect"
      file_category:
        | "logos"
        | "fotos"
        | "videos"
        | "criativos"
        | "documentos"
        | "branding"
        | "briefing"
        | "contrato"
        | "relatorios"
      finance_status: "pending" | "paid" | "overdue" | "cancelled"
      finance_type: "income" | "expense"
      post_status:
        | "idea"
        | "production"
        | "recording"
        | "review"
        | "approved"
        | "to_schedule"
        | "scheduled"
        | "published"
        | "rejected"
        | "archived"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "production" | "waiting_client" | "review" | "done"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["administrator", "team", "client"],
      approval_decision: [
        "pending",
        "approved",
        "rejected",
        "changes_requested",
      ],
      client_journey_stage: [
        "closing",
        "kickoff",
        "onboarding",
        "ongoing",
        "renewal",
        "offboarded",
      ],
      client_status: ["active", "inactive", "paused", "prospect"],
      file_category: [
        "logos",
        "fotos",
        "videos",
        "criativos",
        "documentos",
        "branding",
        "briefing",
        "contrato",
        "relatorios",
      ],
      finance_status: ["pending", "paid", "overdue", "cancelled"],
      finance_type: ["income", "expense"],
      post_status: [
        "idea",
        "production",
        "recording",
        "review",
        "approved",
        "to_schedule",
        "scheduled",
        "published",
        "rejected",
        "archived",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "production", "waiting_client", "review", "done"],
    },
  },
} as const
