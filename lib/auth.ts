import Dexie from "dexie";
import { createBrowserClient } from "@supabase/ssr";

type SupabaseClient = ReturnType<typeof createBrowserClient>;

export async function handleLogout(supabaseClient: SupabaseClient) {
  try {
    await supabaseClient.auth.signOut();
    await Dexie.delete("JapaneseSRS_DB");
    if (typeof window !== "undefined") {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.location.href = "/login";
    }
  } catch (error) {
    console.error("Logout purge failed:", error);
    window.location.href = "/login";
  }
}
