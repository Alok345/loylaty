import { supabase } from '@/lib/supabaseClient';

export const loginWithEmail = async (
  email: string,
  password: string
) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data.user;
};

export const logout = async () => {
  await supabase.auth.signOut();
};
