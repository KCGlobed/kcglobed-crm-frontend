import type { FilterField } from '../components/components/common/DynamicFilter';
import {
    fetchRoleOptionsApi,
    fetchStageOptionsApi,
    fetchTeamOptionsApi,
    fetchDepartmentOptionsApi,
    fetchAuditLogOptionsApi,
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

export const leadFilterConfig: FilterField[] = [
    {
        type: 'text',
        label: 'Registered Name',
        name: 'name',
        placeholder: 'Filter by name...',
    },
    {
        type: 'text',
        label: 'Registered Email',
        name: 'email',
        placeholder: 'Filter by email...',
    },
    {
        type: 'text',
        label: 'Registered Phone',
        name: 'phone',
        placeholder: 'Filter by phone...',
    },
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
        label: 'Source',
        name: 'source',
        options: LEAD_SOURCES.map((source) => ({ label: source, value: source })),
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
