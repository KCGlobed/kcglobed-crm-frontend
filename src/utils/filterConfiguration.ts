import type { FilterField } from '../components/components/common/DynamicFilter';

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
        type: 'text',
        label: 'Name',
        name: 'name',
        placeholder: 'Filter by name...',
    },
    {
        type: 'text',
        label: 'Email',
        name: 'email',
        placeholder: 'Filter by email...',
    },
    {
        type: 'text',
        label: 'Role',
        name: 'role',
        placeholder: 'Filter by role...',
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
