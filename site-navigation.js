import { getSupabaseClient } from "./supabase.js";
import { showToast } from "./toast.js";

const workspaceByRole = {
    administrator: "admin.html",
    adviser: "adviser-portal.html",
    officer: "officer.html"
};
const pageLinks = [
    ["Home", "index.html"],
    ["Events", "index.html#steps-title"],
    ["Organization directory", "organizations.html"],
    ["Scholarships", "scholarship.html"],
    ["Advisers", "advisers.html"],
    ["Alumni", "alumni.html"],
    ["Inside Upang", "map.html"]
];
const isHomePage = /(?:^|\/)index\.html$/i.test(window.location.pathname)
    || window.location.pathname.endsWith("/");

const getActiveProfile = async () => {
    const client = await getSupabaseClient();
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) return null;

    const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("role, account_status")
        .eq("id", session.user.id)
        .maybeSingle();
    if (profileError) throw profileError;
    return { client, profile };
};

const clearCachedAccount = () => {
    sessionStorage.removeItem("isomsDemoRole");
    sessionStorage.removeItem("isomsDemoOrganizationId");
    sessionStorage.removeItem("isomsDemoUsername");
};

if (isHomePage) {
    const navigation = document.querySelector(".site-nav");
    const loginLink = navigation?.querySelector(".login-link");

    try {
        const activeAccount = await getActiveProfile();
        if (activeAccount && loginLink) {
            const workspace = activeAccount.profile?.account_status === "active"
                ? workspaceByRole[activeAccount.profile.role]
                : null;
            if (workspace) {
                loginLink.href = workspace;
                loginLink.textContent = "My workspace";
                loginLink.setAttribute("aria-label", "Open my workspace");
            }

            const signOutLink = document.createElement("a");
            signOutLink.className = "signout-link";
            signOutLink.href = "login.html";
            signOutLink.dataset.homeSignout = "";
            signOutLink.textContent = "Sign out";
            navigation.append(signOutLink);
        }
    } catch (error) {
        console.error("Could not check the homepage sign-in status.", error);
    }

    navigation?.addEventListener("click", async (event) => {
        const signOutLink = event.target.closest("[data-home-signout]");
        if (!signOutLink) return;

        event.preventDefault();
        signOutLink.setAttribute("aria-disabled", "true");
        try {
            const client = await getSupabaseClient();
            const { error } = await client.auth.signOut();
            if (error) throw error;
            clearCachedAccount();
            signOutLink.remove();
            loginLink.textContent = "Log in";
            loginLink.href = "login.html";
            loginLink.removeAttribute("aria-label");
            showToast("You have been signed out successfully.");
        } catch (error) {
            console.error("Sign out failed.", error);
            signOutLink.removeAttribute("aria-disabled");
            showToast(error.message || "Could not sign out. Please try again.", "error");
        }
    });
} else {
    const style = document.createElement("style");
    style.textContent = `
        .isoms-site-menu {
            position: relative;
            z-index: 20;
            flex: 0 0 auto;
            margin-left: auto;
            font-family: Arial, Helvetica, sans-serif;
        }
        .isoms-menu-toggle {
            display: inline-flex;
            min-height: 42px;
            align-items: center;
            gap: 9px;
            padding: 9px 14px;
            border: 1px solid #f2c94c;
            border-radius: 999px;
            background: #174d2a;
            color: #fff;
            cursor: pointer;
            font: 800 .78rem/1 Arial, Helvetica, sans-serif;
            letter-spacing: .04em;
        }
        .isoms-menu-toggle:hover,
        .isoms-menu-toggle:focus-visible,
        .isoms-menu-toggle[aria-expanded="true"] {
            background: #f2c94c;
            color: #173d27;
        }
        .isoms-menu-icon,
        .isoms-menu-icon::before,
        .isoms-menu-icon::after {
            display: block;
            width: 16px;
            height: 2px;
            border-radius: 2px;
            background: currentColor;
        }
        .isoms-menu-icon { position: relative; }
        .isoms-menu-icon::before,
        .isoms-menu-icon::after {
            position: absolute;
            left: 0;
            content: "";
        }
        .isoms-menu-icon::before { top: -5px; }
        .isoms-menu-icon::after { top: 5px; }
        .isoms-menu-panel {
            position: absolute;
            top: calc(100% + 10px);
            right: 0;
            display: grid;
            width: min(300px, calc(100vw - 32px));
            max-height: min(75vh, 560px);
            gap: 3px;
            overflow-y: auto;
            padding: 10px;
            border: 1px solid #dfe8dc;
            border-radius: 14px;
            background: #fff;
            box-shadow: 0 16px 38px #10361f35;
        }
        .isoms-menu-panel[hidden] { display: none; }
        .isoms-menu-panel a,
        .isoms-menu-panel button:not(.campus-label):not(.theme-option) {
            display: block;
            width: 100%;
            padding: 11px 12px;
            border: 0;
            border-radius: 8px;
            background: transparent;
            color: #173d27;
            cursor: pointer;
            font: 700 .84rem/1.35 Arial, Helvetica, sans-serif;
            text-align: left;
            text-decoration: none;
        }
        .isoms-menu-panel a:hover,
        .isoms-menu-panel a:focus-visible,
        .isoms-menu-panel button:not(.campus-label):not(.theme-option):hover,
        .isoms-menu-panel button:not(.campus-label):not(.theme-option):focus-visible {
            outline: none;
            background: #f0f5ed;
            color: #174d2a;
        }
        .isoms-menu-divider {
            height: 1px;
            margin: 5px 4px;
            background: #e5eadf;
        }
        .isoms-menu-panel .topbar-details {
            display: block;
            margin: 8px 4px 2px;
        }
        .isoms-menu-panel .topbar-details::after { display: none; }
        .isoms-menu-panel .campus-label {
            color: #526257;
            font-size: .68rem;
            line-height: 1.5;
            text-align: left;
        }
        .isoms-menu-panel .theme-toggle {
            position: static;
            display: flex;
            width: max-content;
            margin-top: 8px;
            border-color: #dfe8dc;
            background: #f5f7ef;
            box-shadow: none;
            opacity: 1;
            pointer-events: auto;
            transform: none;
            visibility: visible;
        }
        .isoms-menu-panel .theme-option { color: #173d27; }
        @media (max-width: 560px) {
            .isoms-menu-toggle { min-height: 40px; padding: 8px 12px; }
        }
    `;
    document.head.append(style);

    const header = document.querySelector(".topbar, .officer-header, .map-header, header.header, header");
    const anchor = header?.querySelector(".header-account, .header-right") || header;
    const menu = document.createElement("div");
    menu.className = "isoms-site-menu";

    const toggle = document.createElement("button");
    toggle.className = "isoms-menu-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-haspopup", "true");
    toggle.setAttribute("aria-label", "Open site navigation");
    toggle.innerHTML = '<span class="isoms-menu-icon" aria-hidden="true"></span><span>Menu</span>';

    const panel = document.createElement("nav");
    panel.className = "isoms-menu-panel";
    panel.setAttribute("aria-label", "Site navigation");
    panel.hidden = true;

    for (const [label, href] of pageLinks) {
        const link = document.createElement("a");
        link.href = href;
        link.textContent = label;
        panel.append(link);
    }

    const divider = document.createElement("div");
    divider.className = "isoms-menu-divider";
    panel.append(divider);

    const loginLink = document.createElement("a");
    loginLink.href = "login.html";
    loginLink.textContent = "Log in";
    panel.append(loginLink);

    const topbarDetails = document.querySelector(".topbar-details");
    if (topbarDetails) panel.append(topbarDetails);

    const headerSignOut = anchor?.querySelector(':scope > a[data-demo-signout]');
    if (headerSignOut) {
        headerSignOut.removeAttribute("data-demo-signout");
        headerSignOut.dataset.menuSignout = "";
        panel.append(headerSignOut);
    }

    menu.append(toggle, panel);
    if (anchor) {
        const redundantBackLink = anchor.querySelector(":scope > a.back-link:not([data-demo-signout])");
        if (redundantBackLink) redundantBackLink.remove();
        anchor.append(menu);
    } else {
        menu.style.position = "fixed";
        menu.style.top = "12px";
        menu.style.right = "16px";
        document.body.append(menu);
    }

    toggle.addEventListener("click", () => {
        const isOpen = panel.hidden;
        panel.hidden = !isOpen;
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.setAttribute("aria-label", isOpen ? "Close site navigation" : "Open site navigation");
    });

    document.addEventListener("click", (event) => {
        if (!menu.contains(event.target)) {
            panel.hidden = true;
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Open site navigation");
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !panel.hidden) {
            panel.hidden = true;
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Open site navigation");
            toggle.focus();
        }
    });

    panel.addEventListener("click", async (event) => {
        const signOutButton = event.target.closest("[data-menu-signout]");
        if (!signOutButton) {
            if (event.target.closest("a")) {
                panel.hidden = true;
                toggle.setAttribute("aria-expanded", "false");
            }
            return;
        }

        const isButton = signOutButton instanceof HTMLButtonElement;
        if (isButton) {
            signOutButton.disabled = true;
        } else {
            signOutButton.setAttribute("aria-disabled", "true");
        }
        try {
            const client = await getSupabaseClient();
            const { error } = await client.auth.signOut();
            if (error) throw error;
            clearCachedAccount();
            signOutButton.remove();
            loginLink.textContent = "Log in";
            loginLink.href = "login.html";
            showToast("You have been signed out successfully.");
        } catch (error) {
            console.error("Sign out failed.", error);
            if (isButton) {
                signOutButton.disabled = false;
            } else {
                signOutButton.removeAttribute("aria-disabled");
            }
            showToast(error.message || "Could not sign out. Please try again.", "error");
        }
    });

    try {
        const activeAccount = await getActiveProfile();
        if (activeAccount) {
            const workspace = activeAccount.profile?.account_status === "active"
                ? workspaceByRole[activeAccount.profile.role]
                : null;
            if (workspace) {
                loginLink.href = workspace;
                loginLink.textContent = "My workspace";
                loginLink.setAttribute("aria-label", "Open my workspace");
            }

            if (!panel.querySelector("[data-menu-signout]")) {
                const signOutButton = document.createElement("button");
                signOutButton.type = "button";
                signOutButton.textContent = "Sign out";
                signOutButton.dataset.menuSignout = "";
                panel.append(signOutButton);
            }
        }
    } catch (error) {
        console.error("Could not check the site sign-in status.", error);
    }
}
