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
                department: "",
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
                name: "Supreme Student Learner's Government",
                category: "Leadership",
                level: "Senior High School",
                department: "",
                status: "approved",
                description: "Work with fellow learners to plan meaningful activities and bring ideas to the wider school community.",
                adviser: "Name to be confirmed",
                officers: [],
                members: [],
                documents: [],
                reviewNote: "Demo profile only. Confirm current details with the school."
            },
            {
                id: "css",
                name: "Computer Science Society",
                category: "Academic",
                level: "College",
                department: "",
                status: "approved",
                description: "Build computing skills, explore technology, and collaborate with fellow computer science students.",
                adviser: "Name to be confirmed",
                officers: [],
                members: [],
                documents: [],
                reviewNote: "Demo profile only. Confirm current details with the school."
            },
            {
                id: "ufcym",
                name: "UPang Flames Campus Youth Ministry",
                category: "Special interest",
                level: "College",
                department: "",
                status: "approved",
                description: "Build community through faith, service, and campus activities.",
                adviser: "Name to be confirmed",
                officers: [],
                members: [],
                documents: [],
                reviewNote: "Demo profile only. Confirm current details with the school."
            },
            {
                id: "uvc",
                name: "University Volunteer Corps",
                category: "Special interest",
                level: "College",
                department: "",
                status: "approved",
                description: "Serve the campus community through volunteerism, outreach, and student-led initiatives.",
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
            "id", "name", "category", "level", "department", "description", "mission", "vision", "adviser", "logo", "logoUrl", "officers",
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
            const savedOrganizations = new Map(
                (Array.isArray(state.organizations) ? state.organizations : [])
                    .map((organization) => [organization.id, organization])
            );
            state.organizations = initialState.organizations.map((fallback) => {
                const organization = savedOrganizations.get(fallback.id);
                if (!organization) return clone(fallback);
                const hasDirectoryStatus = Object.prototype.hasOwnProperty.call(organization, "directoryStatus");
                const directoryStatus = hasDirectoryStatus
                    ? organization.directoryStatus
                    : fallback.status === "approved" && ["pending", "revision"].includes(organization.status)
                        ? "approved"
                        : organization.status === "approved" ? "approved" : null;
                const currentOrganization = { ...fallback, ...organization, name: fallback.name };
                const publishedProfile = createPublishedProfile(
                    currentOrganization,
                    Array.isArray(state.people) ? state.people : []
                );
                return {
                    ...currentOrganization,
                    directoryStatus,
                    publishedProfile: organization.publishedProfile
                        ? {
                            ...organization.publishedProfile,
                            ...publishedProfile,
                            people: organization.publishedProfile.people || publishedProfile.people
                        }
                        : directoryStatus === "approved" ? publishedProfile : null
                };
            });
            const organizationIds = new Set(initialState.organizations.map((organization) => organization.id));
            state.people = (Array.isArray(state.people) ? state.people : [])
                .filter((person) => organizationIds.has(person.organizationId));
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
