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
