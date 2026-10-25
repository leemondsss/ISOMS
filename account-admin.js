import { getSupabaseClient } from "./supabase.js";

const rows = document.querySelector("#account-rows");
const notice = document.querySelector("#accounts-notice");
const passwordDialog = document.querySelector("#temporary-password-dialog");
const passwordForm = document.querySelector("#temporary-password-form");
const passwordInput = document.querySelector("#temporary-password");
const passwordConfirmInput = document.querySelector("#temporary-password-confirm");
const passwordAccount = document.querySelector("#temporary-password-account");
const togglePasswordButton = document.querySelector("#toggle-temporary-password");
let selectedAccount = null;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
}[character]));

const getOrganizations = () => window.ISOMSDemoStore.load().organizations;

const showNotice = (message, isError = false) => {
    notice.textContent = message;
    notice.style.color = isError ? "#8a3b26" : "";
};

const loadAccounts = async () => {
    rows.innerHTML = '<tr><td colspan="5" class="empty">Loading accounts…</td></tr>';
    const client = await getSupabaseClient();
    const { data, error } = await client
        .from("profiles")
        .select("id, email, display_name, role, account_status, organization_id, created_at")
        .order("created_at", { ascending: true });
    if (error) throw error;

    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    const organizations = getOrganizations();

    if (!data.length) {
        rows.innerHTML = '<tr><td colspan="5" class="empty">No accounts have signed up yet.</td></tr>';
        return;
    }

    rows.innerHTML = data.map((profile) => {
        const id = escapeHtml(profile.id);
        const isCurrentUser = profile.id === user?.id;
        const roles = [
            ["", "Unassigned"],
            ["administrator", "Administrator"],
            ["adviser", "Adviser"],
            ["officer", "Organization officer"]
        ].map(([value, label]) => `<option value="${value}" ${profile.role === value || (!value && !profile.role) ? "selected" : ""}>${label}</option>`).join("");
        const statuses = [
            ["pending", "Pending approval"],
            ["active", "Active"],
            ["disabled", "Disabled"]
        ].map(([value, label]) => `<option value="${value}" ${profile.account_status === value ? "selected" : ""}>${label}</option>`).join("");
        const organizationOptions = [
            '<option value="">No organization assigned</option>',
            ...organizations.map((organization) => `<option value="${escapeHtml(organization.id)}" ${profile.organization_id === organization.id ? "selected" : ""}>${escapeHtml(organization.name)} (${escapeHtml(organization.id.toLocaleUpperCase())})</option>`)
        ].join("");

        return `<tr>
            <td><strong>${escapeHtml(profile.display_name || "Unnamed account")}</strong><br>${escapeHtml(profile.email)}${isCurrentUser ? "<br><small>Your current account</small>" : ""}</td>
            <td><label class="visually-hidden" for="account-role-${id}">Role for ${escapeHtml(profile.email)}</label><select id="account-role-${id}" data-account-role="${id}" ${isCurrentUser ? "disabled" : ""}>${roles}</select></td>
            <td><label class="visually-hidden" for="account-org-${id}">Organization for ${escapeHtml(profile.email)}</label><select id="account-org-${id}" data-account-org="${id}" ${isCurrentUser ? "disabled" : ""}>${organizationOptions}</select></td>
            <td><label class="visually-hidden" for="account-status-${id}">Approval status for ${escapeHtml(profile.email)}</label><select id="account-status-${id}" data-account-status="${id}" ${isCurrentUser ? "disabled" : ""}>${statuses}</select></td>
            <td><div class="account-actions"><button class="secondary" type="button" data-save-account="${id}" ${isCurrentUser ? "disabled" : ""}>Save access</button><button class="secondary" type="button" data-set-temp-access="${id}" data-account-name="${escapeHtml(profile.display_name || profile.email)}" ${isCurrentUser ? "disabled" : ""}>Set temporary password</button></div></td>
        </tr>`;
    }).join("");
};

rows.addEventListener("click", async (event) => {
    const temporaryPasswordButton = event.target.closest("[data-set-temp-access]");
    if (temporaryPasswordButton) {
        selectedAccount = {
            id: temporaryPasswordButton.dataset.setTempAccess,
            name: temporaryPasswordButton.dataset.accountName
        };
        passwordAccount.textContent = `Account: ${selectedAccount.name}`;
        passwordForm.reset();
        passwordInput.type = "password";
        togglePasswordButton.textContent = "Show password";
        togglePasswordButton.setAttribute("aria-label", "Show temporary password");
        togglePasswordButton.setAttribute("aria-pressed", "false");
        passwordDialog.showModal();
        passwordInput.focus();
        return;
    }

    const button = event.target.closest("[data-save-account]");
    if (!button) return;

    const id = button.dataset.saveAccount;
    const role = rows.querySelector(`[data-account-role="${id}"]`).value || null;
    const accountStatus = rows.querySelector(`[data-account-status="${id}"]`).value;
    const organizationId = rows.querySelector(`[data-account-org="${id}"]`).value.trim() || null;

    if (accountStatus === "active" && !role) {
        showNotice("Assign a role before activating this account.", true);
        return;
    }
    if (role === "adviser" && accountStatus === "active" && !organizationId) {
        showNotice("Choose the adviser’s organization before activating this account.", true);
        return;
    }
    if (role === "administrator" && organizationId) {
        showNotice("Administrator accounts should not be assigned to an organization.", true);
        return;
    }

    button.disabled = true;
    try {
        const client = await getSupabaseClient();
        const { error } = await client
            .from("profiles")
            .update({ role, account_status: accountStatus, organization_id: role === "administrator" ? null : organizationId })
            .eq("id", id);
        if (error) throw error;
        showNotice("Account role, organization assignment, and approval status saved.");
        await loadAccounts();
    } catch (error) {
        showNotice(error.message || "Could not update account access.", true);
        button.disabled = false;
    }
});

togglePasswordButton.addEventListener("click", () => {
    const shouldShow = passwordInput.type === "password";
    passwordInput.type = shouldShow ? "text" : "password";
    togglePasswordButton.textContent = shouldShow ? "Hide password" : "Show password";
    togglePasswordButton.setAttribute("aria-label", `${shouldShow ? "Hide" : "Show"} temporary password`);
    togglePasswordButton.setAttribute("aria-pressed", String(shouldShow));
});

document.querySelector("#cancel-temporary-password").addEventListener("click", () => {
    passwordDialog.close();
});

passwordDialog.addEventListener("close", () => {
    selectedAccount = null;
    passwordForm.reset();
    passwordInput.type = "password";
    togglePasswordButton.textContent = "Show password";
    togglePasswordButton.setAttribute("aria-label", "Show temporary password");
    togglePasswordButton.setAttribute("aria-pressed", "false");
});

passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedAccount) {
        showNotice("Choose an account before setting a temporary password.", true);
        return;
    }
    if (passwordInput.value !== passwordConfirmInput.value) {
        showNotice("The temporary passwords do not match.", true);
        passwordConfirmInput.focus();
        return;
    }

    const submitButton = passwordForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    try {
        const client = await getSupabaseClient();
        const { error } = await client.functions.invoke("admin-set-temporary-password", {
            body: {
                userId: selectedAccount.id,
                temporaryPassword: passwordInput.value
            }
        });
        if (error) throw error;

        const accountName = selectedAccount.name;
        passwordDialog.close();
        selectedAccount = null;
        passwordForm.reset();
        showNotice(`Temporary password set for ${accountName}. Share it privately; the account holder must create a new password at their next sign-in.`);
    } catch (error) {
        showNotice(error.message || "Could not set the temporary password. Confirm the Supabase Edge Function is deployed.", true);
    } finally {
        submitButton.disabled = false;
    }
});

try {
    await loadAccounts();
} catch (error) {
    rows.innerHTML = '<tr><td colspan="5" class="empty">Account list could not be loaded.</td></tr>';
    showNotice(error.message || "Could not load accounts. Confirm the Supabase schema and administrator approval.", true);
}
