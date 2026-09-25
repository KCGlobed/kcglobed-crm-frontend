import type { FilterField } from '../components/components/common/DynamicFilter';
import { fetchRoleOptionsApi } from '../services/apiServices';
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
