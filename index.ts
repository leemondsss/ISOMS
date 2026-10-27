import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const respond = (status: number, body: Record<string, string>) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

const passwordDigest = async (password: string, secret: string) => {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(password));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (request: Request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    if (request.method !== "POST") {
        return respond(405, { error: "Method not allowed." });
    }

    const authorization = request.headers.get("Authorization");
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
        return respond(401, { error: "Sign in as an administrator to continue." });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
        console.error("Required Supabase Edge Function environment variables are missing.");
        return respond(500, { error: "The temporary-password service is not configured." });
    }

    try {
        const authClient = createClient(supabaseUrl, anonKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
        const { data: { user: caller }, error: authError } = await authClient.auth.getUser(accessToken);
        if (authError || !caller) {
            return respond(401, { error: "Your session is invalid or expired. Sign in again." });
        }

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
        const { data: callerProfile, error: callerProfileError } = await adminClient
            .from("profiles")
            .select("role, account_status")
            .eq("id", caller.id)
            .maybeSingle();
        if (callerProfileError) {
            console.error("Could not verify administrator profile.", callerProfileError);
            return respond(500, { error: "Could not verify administrator access." });
        }
        if (callerProfile?.role !== "administrator" || callerProfile.account_status !== "active") {
            return respond(403, { error: "Only an active administrator can set temporary passwords." });
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return respond(400, { error: "Request body must be valid JSON." });
        }
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
            return respond(400, { error: "Request body must be a JSON object." });
        }
        const requestBody = body as Record<string, unknown>;
        const userId = requestBody.userId;
        const temporaryPassword = requestBody.temporaryPassword;
        if (typeof userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
            return respond(400, { error: "Choose a valid account." });
        }
        if (userId === caller.id) {
            return respond(400, { error: "Use the password-change form to update your own password." });
        }
        if (typeof temporaryPassword !== "string" || temporaryPassword.length < 12 || temporaryPassword.length > 128) {
            return respond(400, { error: "Temporary passwords must be between 12 and 128 characters." });
        }

        const { data: target, error: targetError } = await adminClient.auth.admin.getUserById(userId);
        if (targetError || !target.user) {
            return respond(404, { error: "The selected account could not be found." });
        }

        const temporaryPasswordDigest = await passwordDigest(temporaryPassword, serviceRoleKey);
        const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
            password: temporaryPassword,
            app_metadata: {
                ...(target.user.app_metadata ?? {}),
                isoms_password_change_required: true,
                isoms_temporary_password_digest: temporaryPasswordDigest
            }
        });
        if (updateError) {
            return respond(400, { error: updateError.message });
        }

        return respond(200, { message: "Temporary password set. The user must change it at next sign-in." });
    } catch (error) {
        console.error("Temporary password update failed.", error);
        return respond(500, { error: "Could not set the temporary password." });
    }
});
