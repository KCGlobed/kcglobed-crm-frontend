import type { FilterField } from '../components/components/common/DynamicFilter';
import { fetchRoleOptionsApi, fetchStageOptionsApi } from '../services/apiServices';
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
