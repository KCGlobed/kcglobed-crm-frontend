import type { FilterField } from '../components/components/common/DynamicFilter';
import {
    fetchRoleOptionsApi,
    fetchStageOptionsApi,
    fetchTeamOptionsApi,
    fetchDepartmentOptionsApi,
    fetchAuditLogOptionsApi,
    fetchLeadAssigneesApi,
    fetchInterviewersApi,
} from '../services/apiServices';
import { LEAD_SOURCES } from './mockLeads';
export const roleFilterConfig: FilterField[] = [
    {
        type: 'text',
        label: 'Role Name',
        name: 'name',
        placeholder: 'Filter by role name...',
    },
    {
        type: 'text',
        label: 'Description',
        name: 'description',
        placeholder: 'Filter by description...',
    },
    {
        type: 'status',
        label: 'Status',
        name: 'status',
        options: [
            { label: 'All', value: 'all' },
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'deactive' },
        ],
    },
];

export const userFilterConfig: FilterField[] = [
    {
        type: 'select',
        label: 'Role',
        name: 'role',
        placeholder: 'Select a role...',
        getOptions: async () => {
            try {
                const response = await fetchRoleOptionsApi();
                return response.data.map((r: any) => ({ label: r.name, value: r.slug }));
            } catch (err) {
                console.error("Failed to fetch roles", err);
                return [];
            }
        }
    },
    {
        type: 'select',
        label: 'Team',
        name: 'team',
        placeholder: 'Select a team...',
        getOptions: async () => {
            try {
                const response = await fetchTeamOptionsApi();
                return (response.data || []).map((t: any) => ({ label: t.name, value: t.id }));
            } catch (err) {
                console.error("Failed to fetch teams", err);
                return [];
            }
        }
    },
    {
        type: 'select',
        label: 'Department',
        name: 'department',
        placeholder: 'Select a department...',
        getOptions: async () => {
            try {
                const response = await fetchDepartmentOptionsApi();
                return (response.data || []).map((d: any) => ({ label: d.name, value: d.id }));
            } catch (err) {
                console.error("Failed to fetch departments", err);
                return [];
            }
        }
    },
    {
        type: 'status',
        label: 'Status',
        name: 'is_active',
        options: [
            { label: 'All', value: 'all' },
            { label: 'Active', value: 'true' },
            { label: 'Inactive', value: 'false' },
        ],
    },
];

// Server-side filters: names map 1:1 to GET /api/leads/ query params
export const leadFilterConfig: FilterField[] = [
    {
        type: 'select',
        label: 'Lead Stage',
        name: 'stage',
        placeholder: 'Select a stage...',
        getOptions: async () => {
            try {
                const response = await fetchStageOptionsApi();
                return (response.data || []).map((s: any) => ({ label: s.name, value: s.code }));
            } catch (err) {
                console.error("Failed to fetch stages", err);
                return [];
            }
        }
    },
    {
        type: 'select',
        label: 'Assigned To',
        name: 'assigned_to',
        placeholder: 'Select a counsellor...',
        getOptions: async () => {
            try {
                const response = await fetchLeadAssigneesApi();
                return [
                    { label: 'Me', value: 'me' },
                    ...(response.data || []).map((a: any) => ({ label: a.name || a.email, value: a.uid })),
                ];
            } catch (err) {
                console.error("Failed to fetch assignees", err);
                return [];
            }
        }
    },
    {
        type: 'status',
        label: 'Assignment',
        name: 'unassigned',
        options: [
            { label: 'All', value: 'all' },
            { label: 'Unassigned only', value: 'true' },
        ],
    },
    {
        type: 'text',
        label: 'Program',
        name: 'program',
        placeholder: 'Filter by program...',
    },
    {
        type: 'select',
        label: 'Source',
        name: 'source',
        options: LEAD_SOURCES.map((source) => ({ label: source, value: source })),
    },
];

// Server-side filters for GET /api/leads/follow-ups/
export const followUpFilterConfig: FilterField[] = [
    {
        type: 'select',
        label: 'Status',
        name: 'status',
        placeholder: 'Select a status...',
        options: [
            { label: 'Pending', value: 'PENDING' },
            { label: 'Completed', value: 'COMPLETED' },
            { label: 'Missed', value: 'MISSED' },
            { label: 'Cancelled', value: 'CANCELLED' },
        ],
    },
    {
        type: 'select',
        label: 'Counsellor',
        name: 'counsellor',
        placeholder: 'Select a counsellor...',
        getOptions: async () => {
            try {
                const response = await fetchLeadAssigneesApi();
                return [
                    { label: 'Me', value: 'me' },
                    ...(response.data || []).map((a: any) => ({ label: a.name || a.email, value: a.uid })),
                ];
            } catch (err) {
                console.error("Failed to fetch assignees", err);
                return [];
            }
        }
    },
];

// Server-side filters for GET /api/interviews/
export const interviewFilterConfig: FilterField[] = [
    {
        type: 'select',
        label: 'Status',
        name: 'status',
        placeholder: 'Select a status...',
        options: [
            { label: 'Scheduled', value: 'SCHEDULED' },
            { label: 'Completed', value: 'COMPLETED' },
            { label: 'No show', value: 'NO_SHOW' },
            { label: 'Cancelled', value: 'CANCELLED' },
            { label: 'Rescheduled', value: 'RESCHEDULED' },
        ],
    },
    {
        type: 'select',
        label: 'Result',
        name: 'result',
        placeholder: 'Select a result...',
        options: [
            { label: 'Pending', value: 'PENDING' },
            { label: 'Selected', value: 'SELECTED' },
            { label: 'Not selected', value: 'NOT_SELECTED' },
        ],
    },
    {
        type: 'select',
        label: 'Counsellor',
        name: 'counsellor',
        placeholder: 'Select a counsellor...',
        getOptions: async () => {
            try {
                const response = await fetchLeadAssigneesApi();
                return [
                    { label: 'Me', value: 'me' },
                    ...(response.data || []).map((a: any) => ({ label: a.name || a.email, value: a.uid })),
                ];
            } catch (err) {
                console.error("Failed to fetch assignees", err);
                return [];
            }
        }
    },
    {
        type: 'select',
        label: 'Interviewer',
        name: 'interviewer',
        placeholder: 'Select an interviewer...',
        getOptions: async () => {
            try {
                const response = await fetchInterviewersApi();
                return (response.data || []).map((i: any) => ({ label: i.name || i.email, value: i.uid }));
            } catch (err) {
                console.error("Failed to fetch interviewers", err);
                return [];
            }
        }
    },
];

// Server-side filters for GET /api/students/
export const studentFilterConfig: FilterField[] = [
    {
        type: 'select',
        label: 'Lead Stage',
        name: 'stage',
        placeholder: 'Select a stage...',
        getOptions: async () => {
            try {
                const response = await fetchStageOptionsApi();
                return (response.data || []).map((s: any) => ({ label: s.name, value: s.code }));
            } catch (err) {
                console.error("Failed to fetch stages", err);
                return [];
            }
        }
    },
    {
        type: 'status',
        label: 'Profile Completed',
        name: 'profile_status',
        options: [
            { label: 'All', value: 'all' },
            { label: 'Completed', value: 'true' },
            { label: 'Pending', value: 'false' },
        ],
    },
    {
        type: 'status',
        label: 'Approved',
        name: 'status',
        options: [
            { label: 'All', value: 'all' },
            { label: 'Approved', value: 'true' },
            { label: 'Pending', value: 'false' },
        ],
    },
];

// Document types for the pending-review queue (GET /api/students/documents/pending-review/)
export const pendingDocumentFilterConfig: FilterField[] = [
    {
        type: 'select',
        label: 'Document Type',
        name: 'document_type',
        placeholder: 'Select a type...',
        options: [
            { label: 'Aadhaar', value: 'aadhaar' },
            { label: 'DOB certificate', value: 'dob_certificate' },
            { label: 'Photograph', value: 'photo' },
            { label: 'Signature', value: 'signature' },
            { label: 'Resume', value: 'resume' },
            { label: '10th marksheet', value: 'tenth_marksheet' },
            { label: '12th marksheet', value: 'twelveth_marksheet' },
            { label: 'Graduation marksheet', value: 'graduation_marksheet' },
            { label: 'Other', value: 'other' },
        ],
    },
];

// Server-side filters for GET /api/payments/
export const paymentFilterConfig: FilterField[] = [
    {
        type: 'select',
        label: 'Status',
        name: 'status',
        placeholder: 'Select a status...',
        options: [
            { label: 'Pending', value: 'PENDING' },
            { label: 'Success', value: 'SUCCESS' },
            { label: 'Failed', value: 'FAILED' },
            { label: 'Offline pending', value: 'OFFLINE_PENDING' },
            { label: 'Verified', value: 'VERIFIED' },
            { label: 'Rejected', value: 'REJECTED' },
        ],
    },
    {
        type: 'select',
        label: 'Method',
        name: 'method',
        options: [
            { label: 'Online', value: 'ONLINE' },
            { label: 'Offline', value: 'OFFLINE' },
        ],
    },
];

export const stageFilterConfig: FilterField[] = [
    {
        type: 'text',
        label: 'Stage Name',
        name: 'name',
        placeholder: 'Filter by stage name...',
    },
    {
        type: 'text',
        label: 'Code',
        name: 'code',
        placeholder: 'Filter by code...',
    },
    {
        type: 'select',
        label: 'Kind',
        name: 'kind',
        options: [
            { label: 'Open', value: 'open' },
            { label: 'Won', value: 'won' },
            { label: 'Lost', value: 'lost' },
        ],
    },
    {
        type: 'status',
        label: 'Status',
        name: 'status',
        options: [
            { label: 'All', value: 'all' },
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'deactive' },
        ],
    },
];

export const departmentFilterConfig: FilterField[] = [
    {
        type: 'text',
        label: 'Department Name',
        name: 'name',
        placeholder: 'Filter by department name...',
    },
    {
        type: 'status',
        label: 'Status',
        name: 'status',
        options: [
            { label: 'All', value: 'all' },
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'deactive' },
        ],
    },
];

export const teamFilterConfig: FilterField[] = [
    {
        type: 'text',
        label: 'Team Name',
        name: 'name',
        placeholder: 'Filter by team name...',
    },
    {
        type: 'select',
        label: 'Department',
        name: 'department',
        placeholder: 'Select a department...',
        getOptions: async () => {
            try {
                const response = await fetchDepartmentOptionsApi();
                return (response.data || []).map((d: any) => ({ label: d.name, value: d.id }));
            } catch (err) {
                console.error("Failed to fetch departments", err);
                return [];
            }
        }
    },
    {
        type: 'status',
        label: 'Status',
        name: 'status',
        options: [
            { label: 'All', value: 'all' },
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'deactive' },
        ],
    },
];

export const auditLogFilterConfig: FilterField[] = [
    {
        type: 'text',
        label: 'User',
        name: 'user',
        placeholder: 'Filter by uid or email...',
    },
    {
        type: 'select',
        label: 'Action',
        name: 'action',
        placeholder: 'Select an action...',
        getOptions: async () => {
            try {
                const response = await fetchAuditLogOptionsApi();
                const actions = response?.data?.actions || [];
                return actions.map((a: any) =>
                    typeof a === 'object'
                        ? { label: a.label ?? a.value, value: a.value }
                        : { label: a, value: a }
                );
            } catch (err) {
                console.error("Failed to fetch audit log options", err);
                return [];
            }
        }
    },
    {
        type: 'select',
        label: 'Module',
        name: 'module',
        placeholder: 'Select a module...',
        getOptions: async () => {
            try {
                const response = await fetchAuditLogOptionsApi();
                const modules = response?.data?.modules || [];
                return modules.map((m: any) =>
                    typeof m === 'object'
                        ? { label: m.label ?? m.name ?? m.value, value: m.value ?? m.code }
                        : { label: m, value: m }
                );
            } catch (err) {
                console.error("Failed to fetch audit log options", err);
                return [];
            }
        }
    },
    {
        type: 'status',
        label: 'Result',
        name: 'success',
        options: [
            { label: 'All', value: 'all' },
            { label: 'Success', value: 'true' },
            { label: 'Failure', value: 'false' },
        ],
    },
];

export const configurationFilterConfig: FilterField[] = [
    {
        type: 'text',
        label: 'Key / Name',
        name: 'search',
        placeholder: 'Filter by key or name...',
    },
    {
        type: 'text',
        label: 'Group',
        name: 'group',
        placeholder: 'e.g. masking, security, leads...',
    },
    {
        type: 'status',
        label: 'Status',
        name: 'status',
        options: [
            { label: 'All', value: 'all' },
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'deactive' },
        ],
    },
];

export const moduleFilterConfig: FilterField[] = [
    {
        type: 'text',
        label: 'Module Name',
        name: 'name',
        placeholder: 'Filter by module name...',
    },
    {
        type: 'text',
        label: 'Code',
        name: 'code',
        placeholder: 'Filter by code...',
    },
    {
        type: 'status',
        label: 'Status',
        name: 'status',
        options: [
            { label: 'All', value: 'all' },
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'deactive' },
        ],
    },
];
