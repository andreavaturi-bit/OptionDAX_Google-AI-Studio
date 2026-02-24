import { create } from 'zustand';
import { supabase } from '../services/supabaseClient';
import { UserProfile } from '../types';

interface UserState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  
  fetchProfile: () => Promise<void>;
  fetchAllProfiles: () => Promise<UserProfile[]>;
  signOut: () => Promise<void>;
}

const useUserStore = create<UserState>((set) => ({
  profile: null,
  isLoading: false,
  error: null,

  fetchAllProfiles: async () => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Error fetching all profiles:", error);
        return [];
    }
    return data as UserProfile[];
  },

  fetchProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log("[UserStore] No active session found");
        set({ profile: null, isLoading: false });
        return;
      }

      console.log("[UserStore] Fetching profile for:", user.email);

      // Fetch profile from 'profiles' table
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle to avoid error if not found

      if (!data) {
        console.log("[UserStore] Profile not found, creating default...");
        // If profile doesn't exist, create a default 'client' profile
        const newProfile = {
            id: user.id,
            email: user.email,
            role: 'client'
        };
        
        const { data: createdProfile, error: createError } = await supabase
            .from('profiles')
            .insert([newProfile])
            .select()
            .single();
        
        if (createError) {
            console.error("[UserStore] Error creating profile:", createError);
            // If error is duplicate key, ignore and fetch again (race condition)
            if (createError.code === '23505') {
                const { data: retryData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                set({ profile: retryData as UserProfile });
                return;
            }
            throw createError;
        }
        
        console.log("[UserStore] Profile created successfully");
        set({ profile: createdProfile as UserProfile });
      } else {
        console.log("[UserStore] Profile loaded:", data.role);
        set({ profile: data as UserProfile });
      }
    } catch (error: any) {
      console.error('[UserStore] Critical error:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ profile: null });
  }
}));

export default useUserStore;
