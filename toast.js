let toastContainer;
let dismissTimeout;

const ensureToastContainer = () => {
    if (toastContainer?.isConnected) return toastContainer;

    const style = document.createElement("style");
    style.textContent = `
        .isoms-toast-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: grid;
            gap: 10px;
            width: min(360px, calc(100vw - 32px));
            pointer-events: none;
        }
        .isoms-toast {
            padding: 14px 18px;
            border: 1px solid #b8d7c1;
            border-radius: 10px;
            background: #f0fff4;
            box-shadow: 0 10px 28px #10361f2b;
            color: #174d2a;
            font: 700 14px/1.45 Arial, Helvetica, sans-serif;
            opacity: 0;
            transform: translateY(-8px);
            transition: opacity 180ms ease, transform 180ms ease;
        }
        .isoms-toast[data-kind="error"] {
            border-color: #e6c2b7;
            background: #fff6f3;
            color: #8a3b26;
        }
        .isoms-toast[data-visible="true"] {
            opacity: 1;
            transform: translateY(0);
        }
        @media (max-width: 480px) {
            .isoms-toast-container {
                top: 12px;
                right: 12px;
            }
        }
        @media (prefers-reduced-motion: reduce) {
            .isoms-toast {
                transition: none;
            }
        }
    `;
    document.head.append(style);

    toastContainer = document.createElement("div");
    toastContainer.className = "isoms-toast-container";
    toastContainer.setAttribute("aria-live", "polite");
    toastContainer.setAttribute("aria-atomic", "true");
    document.body.append(toastContainer);
    return toastContainer;
};

export function showToast(message, kind = "success") {
    const container = ensureToastContainer();
    window.clearTimeout(dismissTimeout);
    container.replaceChildren();

    const toast = document.createElement("div");
    toast.className = "isoms-toast";
    toast.dataset.kind = kind;
    toast.dataset.visible = "false";
    toast.setAttribute("role", kind === "error" ? "alert" : "status");
    toast.textContent = message;
    container.append(toast);

    requestAnimationFrame(() => {
        toast.dataset.visible = "true";
    });
    dismissTimeout = window.setTimeout(() => {
        toast.dataset.visible = "false";
        window.setTimeout(() => toast.remove(), 200);
    }, 3600);
}
