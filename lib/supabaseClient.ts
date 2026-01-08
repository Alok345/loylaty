import { createBrowserClient } from '@supabase/ssr';

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During build, env vars might not be available
  if (!supabaseUrl || !supabaseAnonKey) {
    // Only warn in browser, not during build
    if (typeof window !== 'undefined') {
      console.warn('Supabase environment variables are not set. Some features may not work.');
    }
    // Use a valid URL format to avoid validation errors during build
    try {
      supabaseClient = createBrowserClient(
        'https://placeholder.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.placeholder'
      );
    } catch (error) {
      // If even placeholder fails, create a minimal client
      // This should not happen, but just in case
      console.error('Failed to create Supabase client:', error);
      throw error;
    }
  } else {
    try {
      supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
    } catch (error) {
      console.error('Failed to create Supabase client:', error);
      // Fallback to placeholder if real credentials fail
      supabaseClient = createBrowserClient(
        'https://placeholder.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.placeholder'
      );
    }
  }

  return supabaseClient;
}

export const supabase = getSupabaseClient();
