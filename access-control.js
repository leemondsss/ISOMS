(function () {
    "use strict";

    const roleKey = "isomsDemoRole";
    const organizationKey = "isomsDemoOrganizationId";
    const usernameKey = "isomsDemoUsername";
    const requiredRole = document.documentElement.dataset.requiredRole;
    const demoUsernames = {
        administrator: "@adminisoms",
        adviser: "@facultyadviser",
        officer: "@leemonds"
    };

    document.documentElement.classList.add("access-checking");
    const accessStyle = document.createElement("style");
    accessStyle.textContent = ".access-checking body { visibility: hidden !important; }";
    document.head.appendChild(accessStyle);

    const allowRole = (role) => {
        try {
            return window.sessionStorage.getItem(roleKey) === role;
        } catch (error) {
            window.location.replace("login.html?access=unavailable");
            return false;
        }
    };

    if (!requiredRole || !allowRole(requiredRole)) {
        window.location.replace("login.html?access=denied");
        return;
    }

    document.documentElement.classList.remove("access-checking");

    const usernameLabel = document.querySelector("[data-demo-username]");
    if (usernameLabel) {
        try {
            const username = window.sessionStorage.getItem(usernameKey);
            usernameLabel.textContent = username && /^@[a-zA-Z0-9._-]{1,30}$/.test(username)
                ? username
                : demoUsernames[requiredRole];
        } catch (error) {
            usernameLabel.textContent = demoUsernames[requiredRole];
        }
    }

    document.addEventListener("click", (event) => {
        const signOut = event.target.closest("[data-demo-signout]");
        if (!signOut) return;

        event.preventDefault();
        try {
            window.sessionStorage.removeItem(roleKey);
            window.sessionStorage.removeItem(organizationKey);
            window.sessionStorage.removeItem(usernameKey);
        } catch (error) {
            window.location.replace("login.html?access=unavailable");
            return;
        }
        window.location.assign("login.html");
    });
}());
