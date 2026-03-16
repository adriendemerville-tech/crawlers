import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  api_key: string;
  avatar_url: string | null;
  agency_logo_url: string | null;
  agency_primary_color: string | null;
  agency_brand_name: string | null;
  agency_contact_first_name: string | null;
  agency_contact_last_name: string | null;
  agency_contact_phone: string | null;
  agency_contact_email: string | null;
  agency_report_header_text: string | null;
  agency_report_footer_text: string | null;
  plan_type: string;
  subscription_expires_at: string | null;
  stripe_subscription_id: string | null;
  gsc_access_token: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (customRedirectUrl?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data as Profile | null;
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  const ensureProfile = async (userId: string) => {
    // First try to fetch existing profile
    let profileData = await fetchProfile(userId);
    
    if (!profileData) {
      // Call edge function to create profile for OAuth users
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          await supabase.functions.invoke('ensure-profile', {
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
          });
          // Fetch the newly created profile
          profileData = await fetchProfile(userId);
        }
      } catch (error) {
        console.error('Error ensuring profile:', error);
      }
    }
    
    return profileData;
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            ensureProfile(session.user.id).then(setProfile);
          }, 0);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        ensureProfile(session.user.id).then(setProfile);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUpWithEmail = async (email: string, password: string, firstName: string, lastName: string) => {
    // Use environment variable for production, fallback to current origin for local dev
    const redirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL || `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      }
    });

    if (error) return { error };

    // Create profile after successful signup
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          first_name: firstName,
          last_name: lastName,
          email: email,
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        return { error: new Error('Erreur lors de la création du profil') };
      }
    }

    return { error: null };
  };

  const signInWithGoogle = async (customRedirectUrl?: string) => {
    const baseUrl = import.meta.env.VITE_AUTH_REDIRECT_URL 
      ? import.meta.env.VITE_AUTH_REDIRECT_URL.replace(/\/$/, '')
      : window.location.origin;
    
    let redirectUrl: string;
    if (customRedirectUrl) {
      redirectUrl = customRedirectUrl;
    } else {
      const returnPath = sessionStorage.getItem('audit_return_path');
      redirectUrl = returnPath ? `${baseUrl}/auth` : `${baseUrl}/`;
    }
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
