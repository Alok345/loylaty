import { supabase } from "@/lib/supabase/client";

export const getCurrentUserProfile = async () => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", auth.user.id)
    .single();

  if (error) throw error;
  return data;
};
