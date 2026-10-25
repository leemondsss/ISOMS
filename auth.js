import { getSupabaseClient } from "./supabase.js";

const signOutAfterRejection = async (supabase) => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        throw new Error(`Could not end the rejected session: ${error.message}`);
    }
};

export async function registerUser(email, password, displayName) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { display_name: displayName },
            emailRedirectTo: `${window.location.origin}/login.html`
        }
    });

    if (error) throw error;
    return data;
}

export async function loginUser(email, password) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw error;
    if (!data.user) {
        await signOutAfterRejection(supabase);
        throw new Error("Sign-in completed without a user account.");
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, display_name, role, account_status, organization_id")
        .eq("id", data.user.id)
        .single();

    if (profileError || !profile) {
        await signOutAfterRejection(supabase);
        throw new Error("Could not load your ISOMS profile. Please contact an administrator.");
    }

    if (profile.account_status !== "active") {
        await signOutAfterRejection(supabase);

        if (profile.account_status === "pending") {
            throw new Error("Your account is pending administrator approval.");
        }

        throw new Error("Your account is not active. Please contact an administrator.");
    }

    if (!["administrator", "adviser", "officer"].includes(profile.role)) {
        await signOutAfterRejection(supabase);
        throw new Error("Your account has no valid role assigned yet.");
    }

    return { user: data.user, profile };
}

export async function sendPasswordReset(email) {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login.html`
    });

    if (error) throw error;
}

export async function updatePassword(password) {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.updateUser({ password });

    if (error) throw error;
    return data;
}

export async function completeTemporaryPasswordChange(password) {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.functions.invoke("complete-temporary-password-change", {
        body: { newPassword: password }
    });

    if (error) throw error;
}

export async function logoutUser() {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) throw error;
}

export async function getCurrentSession() {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;
    return data.session;
}
