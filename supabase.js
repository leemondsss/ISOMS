const SUPABASE_URL = "https://nfwzbgtukijrhnxfpwdv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BpaJhkQInauD3cw-1-XTrA_Y2ny8sXA";

let clientPromise;

export async function getSupabaseClient() {
    if (!SUPABASE_URL.startsWith("https://") || SUPABASE_URL.includes("YOUR_")) {
        throw new Error("Set your Supabase project URL in supabase.js before connecting.");
    }

    if (!SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY.includes("YOUR_")) {
        throw new Error("Set your Supabase publishable key in supabase.js before connecting.");
    }

    if (!clientPromise) {
        clientPromise = import("https://esm.sh/@supabase/supabase-js@2")
            .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
                auth: {
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    persistSession: true
                }
            }))
            .catch((error) => {
                clientPromise = undefined;
                throw new Error(`Could not load the Supabase client: ${error.message}`);
            });
    }

    return clientPromise;
}
