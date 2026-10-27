import { getSupabaseClient } from "./supabase.js";

const roleKey = "isomsDemoRole";
const organizationKey = "isomsDemoOrganizationId";
const usernameKey = "isomsDemoUsername";
const requiredRole = document.documentElement.dataset.requiredRole;

document.documentElement.classList.add("access-checking");

const denyAccess = (message) => {
    try {
        sessionStorage.removeItem(roleKey);
        sessionStorage.removeItem(organizationKey);
        sessionStorage.removeItem(usernameKey);
    } catch (error) {
        console.error("Could not clear cached workspace details.", error);
    }
    window.location.replace(`login.html?access=${encodeURIComponent(message)}`);
};

try {
    if (!requiredRole) {
        throw new Error("This page is missing its required account role.");
    }

    const client = await getSupabaseClient();
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) {
        denyAccess("signed-out");
    } else {
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError) throw userError;
        if (!user) {
            denyAccess("signed-out");
        } else if (user.app_metadata?.isoms_password_change_required === true) {
            denyAccess("password-change");
        } else {
            const { data: profile, error: profileError } = await client
                .from("profiles")
                .select("role, account_status, organization_id, display_name")
                .eq("id", user.id)
                .maybeSingle();

            if (profileError) throw profileError;
            if (!profile || profile.account_status !== "active" || !profile.role) {
                denyAccess("approval");
            } else if (profile.role !== requiredRole) {
                denyAccess("wrong-role");
            } else {
                sessionStorage.setItem(roleKey, profile.role);
                const displayName = profile.display_name || user.email || "";
                sessionStorage.setItem(usernameKey, displayName);
                if (profile.organization_id) {
                    sessionStorage.setItem(organizationKey, profile.organization_id);
                } else {
                    sessionStorage.removeItem(organizationKey);
                }
                document.querySelector("[data-auth-user]")?.replaceChildren(document.createTextNode(displayName));
                document.documentElement.classList.remove("access-checking");
                document.dispatchEvent(new CustomEvent("isoms:access-ready", { detail: { user, profile } }));
            }
        }
    }
} catch (error) {
    console.error("Workspace account verification failed.", error);
    denyAccess("setup");
}

document.addEventListener("click", async (event) => {
    const signOut = event.target.closest("[data-demo-signout]");
    if (!signOut) return;

    event.preventDefault();
    signOut.setAttribute("aria-disabled", "true");
    try {
        const client = await getSupabaseClient();
        const { error } = await client.auth.signOut();
        if (error) throw error;
        sessionStorage.removeItem(roleKey);
        sessionStorage.removeItem(organizationKey);
        sessionStorage.removeItem(usernameKey);
        window.location.assign("login.html");
    } catch (error) {
        console.error("Sign out failed.", error);
        signOut.removeAttribute("aria-disabled");
        window.location.assign("login.html?access=setup");
    }
});
