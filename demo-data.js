(function () {
    "use strict";

    const storageKey = "isoms-demo-workspace-v1";
    const initialState = {
        academicYear: "2026–2027",
        organizations: [
            {
                id: "ssc",
                name: "Supreme Student Council",
                category: "Leadership",
                level: "College",
                status: "approved",
                description: "Represent student voices, champion campus initiatives, and help shape a more connected school community.",
                adviser: "Name to be confirmed",
                officers: [],
                members: [],
                documents: [],
                reviewNote: "Demo profile only. Confirm current details with the school."
            },
            {
                id: "sslg",
                name: "Supreme Secondary Learner Government",
                category: "Leadership",
                level: "Senior High School",
                status: "approved",
                description: "Work with fellow learners to plan meaningful activities and bring ideas to the wider school community.",
                adviser: "Name to be confirmed",
                officers: [],
                members: [],
                documents: [],
                reviewNote: "Demo profile only. Confirm current details with the school."
            },
            {
                id: "rso",
                name: "Recognized Student Organizations",
                category: "Special interest",
                level: "College",
                status: "approved",
                description: "Connect through shared interests, develop new skills, and turn a passion into campus activities.",
                adviser: "Names to be confirmed",
                officers: [],
                members: [],
                documents: [],
                reviewNote: "Demo profile only. Confirm current details with the school."
            },
            {
                id: "uvc",
                name: "UVC",
                category: "Special interest",
                level: "College",
                status: "pending",
                description: "Connect with fellow members, take part in campus activities, and contribute ideas to the community.",
                adviser: "Name to be confirmed",
                officers: [],
                members: [],
                documents: [
                    { name: "sample-registration.pdf", type: "Organization registration form" },
                    { name: "sample-endorsement.pdf", type: "Adviser endorsement" }
                ],
                reviewNote: "Illustrative sample submission; no actual files are stored."
            },
            {
                id: "tnt",
                name: "TNT",
                category: "Special interest",
                level: "Senior High School",
                status: "revision",
                description: "Meet students with shared interests and work together on activities that bring energy to campus life.",
                adviser: "Name to be confirmed",
                officers: [],
                members: [],
                documents: [
                    { name: "sample-guidelines.pdf", type: "Organization guidelines" }
                ],
                reviewNote: "Illustrative sample returned for revision; no actual files are stored."
            },
            {
                id: "dangat",
                name: "DANGAT",
                category: "Special interest",
                level: "College",
                status: "pending",
                description: "Build connections, share perspectives, and get involved in opportunities across the school community.",
                adviser: "Name to be confirmed",
                officers: [],
                members: [],
                documents: [],
                reviewNote: "Demo profile only. Confirm current details with the school."
            }
        ],
        people: [
            { id: "demo-person-1", name: "Demo officer (placeholder)", role: "President", group: "Officer", organizationId: "ssc" },
            { id: "demo-person-2", name: "Demo adviser (placeholder)", role: "Faculty adviser", group: "Adviser", organizationId: "ssc" },
            { id: "demo-person-3", name: "Demo member (placeholder)", role: "Member", group: "Member", organizationId: "ssc" }
        ]
    };

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const createPublishedProfile = (organization, people = []) => {
        const fields = [
            "id", "name", "category", "level", "description", "mission", "vision", "adviser", "logo", "logoUrl", "officers",
            "executiveOfficers", "members", "advisers", "achievements", "gallery",
            "schoolYear", "representative"
        ];
        return {
            ...Object.fromEntries(fields
            .filter((field) => Object.prototype.hasOwnProperty.call(organization, field))
            .map((field) => [field, clone(organization[field])])),
            people: clone(people.filter((person) => person.organizationId === organization.id))
        };
    };
    const publishOrganization = (organization, people = []) => {
        organization.directoryStatus = "approved";
        organization.publishedProfile = createPublishedProfile(organization, people);
    };

    const load = () => {
        let saved;
        try {
            saved = window.localStorage.getItem(storageKey);
        } catch (error) {
            throw new Error(`Demo data cannot be read in this browser: ${error.message}`);
        }

        if (saved === null) {
            const state = clone(initialState);
            save(state);
            return state;
        }

        try {
            const state = JSON.parse(saved);
            const fallbackById = new Map(initialState.organizations.map((organization) => [organization.id, organization]));
            state.organizations = (Array.isArray(state.organizations) ? state.organizations : []).map((organization) => {
                const fallback = fallbackById.get(organization.id);
                if (!fallback) return organization;
                const hasDirectoryStatus = Object.prototype.hasOwnProperty.call(organization, "directoryStatus");
                const directoryStatus = hasDirectoryStatus
                    ? organization.directoryStatus
                    : fallback.status === "approved" && ["pending", "revision"].includes(organization.status)
                        ? "approved"
                        : organization.status === "approved" ? "approved" : null;
                const publishedProfile = createPublishedProfile(
                    organization,
                    Array.isArray(state.people) ? state.people : []
                );
                return {
                    ...organization,
                    directoryStatus,
                    publishedProfile: organization.publishedProfile
                        ? {
                            ...publishedProfile,
                            ...organization.publishedProfile,
                            people: organization.publishedProfile.people || publishedProfile.people
                        }
                        : directoryStatus === "approved" ? publishedProfile : null
                };
            });
            return state;
        } catch (error) {
            throw new Error(`Saved demo data is invalid and could not be loaded: ${error.message}`);
        }
    };

    const save = (state) => {
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(state));
        } catch (error) {
            throw new Error(`Demo changes could not be saved in this browser: ${error.message}`);
        }
    };

    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    })[character]);

    window.ISOMSDemoStore = Object.freeze({
        load,
        save,
        publishOrganization,
        escapeHtml
    });
}());
