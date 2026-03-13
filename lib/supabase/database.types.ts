// ============================================================
// Food Club — Database Types
// These match the Supabase schema exactly.
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
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
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
        Update: Partial<Database["public"]["Tables"]["invite_links"]["Insert"]>;
      };

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
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["dinners"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["dinners"]["Insert"]>;
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
      };

      poll_options: {
        Row: {
          id: string;
          dinner_id: string;
          place_id: string;
          suggested_by: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["poll_options"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["poll_options"]["Insert"]>;
      };

      votes: {
        Row: {
          id: string;
          option_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["votes"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["votes"]["Insert"]>;
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
      };

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
          cached_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["restaurant_cache"]["Row"], "cached_at">;
        Update: Partial<Database["public"]["Tables"]["restaurant_cache"]["Insert"]>;
      };

      dinner_ratings: {
        Row: {
          id: string;
          dinner_id: string;
          user_id: string;
          place_id: string;
          stars: number;
          tags: string[] | null;
          note: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["dinner_ratings"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["dinner_ratings"]["Insert"]>;
      };
    };
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
