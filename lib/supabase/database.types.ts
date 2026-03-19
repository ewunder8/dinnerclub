// ============================================================
// DinnerClub — Database Types
// Kept in sync with all migrations manually.
// Migrations: 001_initial_schema, 002_poll_themes,
//             003_vote_uniqueness, 004_ratings_and_countdown,
//             005_rls_policies
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          avatar_url: string | null;
          city: string | null;
          beli_connected: boolean;
          beli_username: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "created_at">;
        Update: Partial<Omit<Database["public"]["Tables"]["users"]["Row"], "id" | "created_at">>;
        Relationships: [];
      };

      clubs: {
        Row: {
          id: string;
          name: string;
          emoji: string | null;
          city: string | null;
          vibe: string | null;
          frequency: string | null;
          owner_id: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["clubs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["clubs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "clubs_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };

      club_members: {
        Row: {
          id: string;
          club_id: string;
          user_id: string;
          role: "owner" | "member";
          joined_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["club_members"]["Row"], "id" | "joined_at">;
        Update: Partial<Database["public"]["Tables"]["club_members"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };

      invite_links: {
        Row: {
          id: string;
          club_id: string;
          created_by: string;
          token: string;
          expires_at: string;
          used_count: number;
          status: "active" | "expired" | "revoked";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["invite_links"]["Row"], "id" | "created_at" | "used_count">;
        Update: Partial<Omit<Database["public"]["Tables"]["invite_links"]["Row"], "id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "invite_links_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invite_links_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };

      // Migration 002: added theme_*, voting_open, poll_min_options
      // Migration 003: added suggestion_mode, max_suggestions
      // Migration 004: added ratings_open_until
      dinners: {
        Row: {
          id: string;
          club_id: string;
          status: "polling" | "seeking_reservation" | "waitlisted" | "confirmed" | "completed" | "cancelled";
          poll_closes_at: string | null;
          winning_restaurant_place_id: string | null;
          reservation_datetime: string | null;
          party_size: number | null;
          confirmation_number: string | null;
          reservation_platform: "resy" | "opentable" | "tock" | "other" | null;
          reserved_by: string | null;
          // 002
          theme_cuisine: string | null;
          theme_price: number | null;
          theme_vibe: string | null;
          theme_neighborhood: string | null;
          voting_open: boolean;
          poll_min_options: number;
          // 003
          suggestion_mode: "owner_only" | "members" | "hybrid";
          max_suggestions: number | null;
          // 004
          ratings_open_until: string | null;
          // 007
          target_date: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["dinners"]["Row"],
          "id" | "created_at" | "status" | "voting_open" | "poll_min_options" | "suggestion_mode"
        > & {
          // Fields with DB defaults — optional on insert
          status?: "polling" | "seeking_reservation" | "waitlisted" | "confirmed" | "completed" | "cancelled";
          voting_open?: boolean;
          poll_min_options?: number;
          suggestion_mode?: "owner_only" | "members" | "hybrid";
        };
        Update: Partial<Database["public"]["Tables"]["dinners"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "dinners_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          }
        ];
      };

      reservation_attempts: {
        Row: {
          id: string;
          dinner_id: string;
          user_id: string;
          status: "attempting" | "waitlisted" | "succeeded" | "abandoned";
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reservation_attempts"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["reservation_attempts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "reservation_attempts_dinner_id_fkey";
            columns: ["dinner_id"];
            isOneToOne: false;
            referencedRelation: "dinners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservation_attempts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };

      // Migration 002: added removed_by, removed_at, note
      poll_options: {
        Row: {
          id: string;
          dinner_id: string;
          place_id: string;
          suggested_by: string;
          // 002
          removed_by: string | null;
          removed_at: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["poll_options"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["poll_options"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "poll_options_dinner_id_fkey";
            columns: ["dinner_id"];
            isOneToOne: false;
            referencedRelation: "dinners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "poll_options_suggested_by_fkey";
            columns: ["suggested_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "poll_options_removed_by_fkey";
            columns: ["removed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };

      // Migration 003: added dinner_id, changed unique constraint to (dinner_id, user_id)
      votes: {
        Row: {
          id: string;
          option_id: string;
          user_id: string;
          // 003
          dinner_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["votes"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["votes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "votes_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "poll_options";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votes_dinner_id_fkey";
            columns: ["dinner_id"];
            isOneToOne: false;
            referencedRelation: "dinners";
            referencedColumns: ["id"];
          }
        ];
      };

      rsvps: {
        Row: {
          id: string;
          dinner_id: string;
          user_id: string;
          status: "going" | "not_going" | "maybe";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["rsvps"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["rsvps"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "rsvps_dinner_id_fkey";
            columns: ["dinner_id"];
            isOneToOne: false;
            referencedRelation: "dinners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rsvps_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };

      // Added beli_url for Beli app deep links
      restaurant_cache: {
        Row: {
          place_id: string;
          name: string;
          address: string | null;
          lat: number | null;
          lng: number | null;
          phone: string | null;
          website: string | null;
          price_level: number | null;
          rating: number | null;
          reservation_url: string | null;
          reservation_platform: string | null;
          photo_urls: string[] | null;
          hours: Json | null;
          beli_url: string | null;
          cached_at: string;
        };
        Insert: Database["public"]["Tables"]["restaurant_cache"]["Row"];
        Update: Partial<Database["public"]["Tables"]["restaurant_cache"]["Row"]>;
        Relationships: [];
      };

      // Migration 004: added food_score, vibe_score, value_score,
      //               would_return, recommend, overall_score
      dinner_ratings: {
        Row: {
          id: string;
          dinner_id: string;
          user_id: string;
          place_id: string;
          stars: number;
          tags: string[] | null;
          note: string | null;
          // 004
          overall_score: number | null;
          food_score: number | null;
          vibe_score: number | null;
          value_score: number | null;
          would_return: boolean | null;
          recommend: boolean | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["dinner_ratings"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["dinner_ratings"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "dinner_ratings_dinner_id_fkey";
            columns: ["dinner_id"];
            isOneToOne: false;
            referencedRelation: "dinners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dinner_ratings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };

    // Migration 004: dinner_rating_summaries view
    Views: {
      dinner_rating_summaries: {
        Row: {
          dinner_id: string;
          place_id: string;
          rating_count: number;
          avg_overall: number | null;
          avg_food: number | null;
          avg_vibe: number | null;
          avg_value: number | null;
          would_return_count: number;
          recommend_count: number;
          notes: string[] | null;
        };
        Relationships: [];
      };
    };

    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};

// ============================================================
// Convenience types — use these throughout the app
// ============================================================

export type User = Database["public"]["Tables"]["users"]["Row"];
export type Club = Database["public"]["Tables"]["clubs"]["Row"];
export type ClubMember = Database["public"]["Tables"]["club_members"]["Row"];
export type InviteLink = Database["public"]["Tables"]["invite_links"]["Row"];
export type Dinner = Database["public"]["Tables"]["dinners"]["Row"];
export type ReservationAttempt = Database["public"]["Tables"]["reservation_attempts"]["Row"];
export type PollOption = Database["public"]["Tables"]["poll_options"]["Row"];
export type Vote = Database["public"]["Tables"]["votes"]["Row"];
export type RSVP = Database["public"]["Tables"]["rsvps"]["Row"];
export type RestaurantCache = Database["public"]["Tables"]["restaurant_cache"]["Row"];
export type DinnerRating = Database["public"]["Tables"]["dinner_ratings"]["Row"];
export type DinnerRatingSummary = Database["public"]["Views"]["dinner_rating_summaries"]["Row"];

// Poll state derived from dinner fields — used in lib/poll.ts
export type PollState =
  | "needs_suggestions"
  | "ready_to_open"
  | "voting_open"
  | "voting_closed"
  | "winner_selected";

// Enriched types with joins — used in UI components
export type ClubWithMembers = Club & {
  club_members: (ClubMember & { users: User })[];
};

export type DinnerWithDetails = Dinner & {
  poll_options: (PollOption & {
    restaurant_cache: RestaurantCache;
    votes: Vote[];
  })[];
  rsvps: (RSVP & { users: User })[];
  reservation_attempts: (ReservationAttempt & { users: User })[];
};

export type PollOptionWithVotes = PollOption & {
  restaurant_cache: RestaurantCache;
  votes: Vote[];
  vote_count: number;
};
