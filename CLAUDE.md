# KC Globe CRM — Claude Code: Mandatory Conventions

> **This file is auto-read by Claude Code. Every rule here is mandatory.**
> Do NOT deviate. Do NOT add unnecessary code, extra interfaces, helper wrappers,
> or "quality-of-life" utilities that are not already in this codebase.
> Keep code minimal, clean, and consistent with what already exists.

---

## 1. Golden Rule

**Copy the existing code pattern exactly.** Before writing anything for a new feature,
read the closest existing implementation and mirror it line-for-line.

Current canonical references (in order of priority):
| Layer       | Reference File                                                   |
|-------------|------------------------------------------------------------------|
| **Page**    | `src/pages/roles/index.tsx` (ManageRoles)                        |
| **Slice**   | `src/store/slices/roleSlice.ts`                                  |
| **Service** | `src/services/apiServices.ts`                                    |
| **Types**   | `src/utils/types.ts`                                             |
| **View**    | `src/components/components/View/RoleView.tsx`                    |
| **Form**    | `src/components/components/Forms/RoleForm.tsx`                   |
| **Filters** | `src/utils/filterConfiguration.ts`                               |

---

## 2. Types — `src/utils/types.ts`

### Rules
1. **ONE interface per entity.** `Role`, `User`, etc. — never create separate
   `CreateRolePayload`, `UpdateRolePayload`, `RoleItem`, `RolesListApiResponse`,
   `RoleDetailApiResponse`, or any other alias/wrapper.
2. **Use the entity interface directly** as the payload for create/update thunks.
3. **Use `Promise<any>` for all service return types** — e.g., `Promise<any>`. Never use
   `ApiResponse<T>` wrappers in service functions.
4. All fields on entity interfaces are **optional** (`?`) because the same interface serves
   create (few fields), list (some fields), and detail (all fields) use-cases.
5. Field order must match the backend JSON response order.
6. Do NOT add utility types, mapped types, or generics beyond `Pagination<T>`.

### Existing types (reference — do NOT duplicate)
```ts
export interface ApiResponse<T = any> {
  status_code: number;
  message: string;
  data: T;
}

export interface Role {
  id?: number;
  name?: string;
  slug?: string;
  description?: string;
  is_system?: boolean;
  is_default?: boolean;
  is_active?: boolean;
  user_count?: number;
  created_at?: string;
  updated_at?: string;
  permissions?: string[];
  permission_codes?: string[];
  permissions_detail?: PermissionDetail[];
  created_by_name?: string | null;
}
```

### Adding a new entity (e.g. `Student`)
```ts
// ✅ CORRECT — single interface, all optional fields
export interface Student {
  id?: number;
  name?: string;
  email?: string;
  phone?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// ❌ WRONG — never do any of these
export type StudentItem = Student;
export type StudentListResponse = ApiResponse<Student[]>;
export type CreateStudentPayload = Pick<Student, 'name' | 'email'>;
export interface StudentDetailApiResponse { status_code: number; ... }
```

---

## 3. Services — `src/services/apiServices.ts`

### Rules
1. **`apiRequest` takes POSITIONAL arguments**, not an options object:
   ```ts
   apiRequest<T>(url, method, body?, retry?)
   ```
   - `url`: string — leading slash, trailing slash, no `BASE_URL` prefix. E.g., `"/access/roles/"`
   - `method`: `"GET" | "POST" | "PUT" | "DELETE" | "PATCH"`
   - `body?`: payload object (omit for GET)
   - `retry?`: boolean (omit — defaults to `true`)

2. **Naming**: `fetchXApi`, `fetchXByIdApi`, `createXApi`, `updateXApi`, `deleteXApi`.

3. **Return type**: Always declare `Promise<any>`. Never use `ApiResponse<T>` wrappers.

4. **Group by feature** with a comment marker:
   ```ts
   // ----------------Student service------- //
   ```

5. **Import only what you need** from `types.ts`.

### Pattern (copy this exactly)
```ts
// ----------------Student service------- //
export const fetchStudentsApi = async (): Promise<any> => {
  return await apiRequest("/students/", "GET");
};

export const fetchStudentByIdApi = async (id: number): Promise<any> => {
  return await apiRequest(`/students/${id}/`, "GET");
};

export const createStudentApi = async (payload: any): Promise<any> => {
  return await apiRequest("/students/", "POST", payload);
};

export const updateStudentApi = async (id: number, payload: any): Promise<any> => {
  return await apiRequest(`/students/${id}/`, "PUT", payload);
};

export const deleteStudentApi = async (id: number): Promise<any> => {
  return await apiRequest(`/students/${id}/`, "DELETE");
};
```

---

## 4. Redux Slice — `src/store/slices/<feature>Slice.ts`

### Rules
1. State interface extends `Pagination<Entity>` and adds:
   - `selectedX: Entity | null`
   - `selectedXLoading: boolean`
   - `actionLoading: boolean`
   - Any extra feature-specific state (like `permissionsByModule` for roles)

2. **`createAsyncThunk<ReturnType, ArgType>`** — always explicit generics.

3. **Return `response.data`** from the thunk, never the full envelope.

4. **Error idiom** — always use:
   ```ts
   catch (err: any) {
     return rejectWithValue(err.message || "Failed to ...");
   }
   ```

5. **List fetch** uses `loading` flag + `condition` guard to prevent duplicate in-flight:
   ```ts
   {
     condition: (_, { getState }) => {
       const { featureName } = getState() as { featureName: { loading: boolean } };
       if (featureName?.loading) return false;
       return true;
     },
   }
   ```

6. **Detail fetch** uses `selectedXLoading` (NOT `loading`) and has **no** `condition` guard.

7. **Mutations** (create/update/delete) use `actionLoading`.

8. **`fulfilled` on detail** also patches `state.data` to keep list in sync:
   ```ts
   .addCase(fetchXById.fulfilled, (state, action) => {
     state.selectedXLoading = false;
     state.selectedX = action.payload;
     if (state.data && state.data.length > 0) {
       const idx = state.data.findIndex((r) => r.id === action.payload.id);
       if (idx !== -1) {
         state.data[idx] = { ...state.data[idx], ...action.payload };
       }
     }
   })
   ```

9. **Register the new reducer** in `src/store/store.ts`.

### Slice skeleton (copy this for any new feature)
```ts
import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { fetchXsApi, fetchXByIdApi } from "../../services/apiServices";
import type { Pagination, X } from "../../utils/types";

interface XState extends Pagination<X> {
  selectedX: X | null;
  selectedXLoading: boolean;
  actionLoading: boolean;
}

const initialState: XState = {
  data: [],
  next: null,
  loading: false,
  error: null,
  selectedX: null,
  selectedXLoading: false,
  actionLoading: false,
};

export const fetchXs = createAsyncThunk<X[]>(
  "xs/fetchXs",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetchXsApi();
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch xs");
    }
  },
  {
    condition: (_, { getState }) => {
      const { xs } = getState() as { xs: { loading: boolean } };
      if (xs?.loading) return false;
      return true;
    },
  }
);

export const fetchXById = createAsyncThunk<X, number>(
  "xs/fetchXById",
  async (id, { rejectWithValue }) => {
    try {
      const response = await fetchXByIdApi(id);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch x details");
    }
  }
);

// ... createX, updateX, deleteX follow same pattern with actionLoading ...

const xSlice = createSlice({
  name: "xs",
  initialState,
  reducers: {
    setSelectedX: (state, action: PayloadAction<X | null>) => {
      state.selectedX = action.payload;
    },
    clearXError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchXs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchXs.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload || [];
        state.count = state.data.length;
        state.next = null;
      })
      .addCase(fetchXs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Detail
      .addCase(fetchXById.pending, (state) => {
        state.selectedXLoading = true;
        state.error = null;
      })
      .addCase(fetchXById.fulfilled, (state, action) => {
        state.selectedXLoading = false;
        state.selectedX = action.payload;
        if (state.data && state.data.length > 0) {
          const idx = state.data.findIndex((r) => r.id === action.payload.id);
          if (idx !== -1) state.data[idx] = { ...state.data[idx], ...action.payload };
        }
      })
      .addCase(fetchXById.rejected, (state, action) => {
        state.selectedXLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedX, clearXError } = xSlice.actions;
export default xSlice.reducer;
```

---

## 5. Page — `src/pages/<feature>/index.tsx`

### Rules
1. **File name is always `index.tsx`** inside a feature folder.
2. **Component name**: `Manage<Feature>` (e.g., `ManageRoles`, `ManageStudents`).
3. **Default + named export**: `export const XPage = ManageX; export default ManageX;`
4. **State hooks**: use `useAppDispatch` from `hooks/useAppDispatch` and `useAppSelector` from `hooks/useRedux`.
5. **DO NOT import `useDispatch` or `useSelector` directly from react-redux.**
6. **Client-side filtering & pagination** using `useMemo` — mirror the exact pattern from ManageRoles.

### Required structure (this order, these sections)
```
1. Imports
2. ColumnDef interface (local, not from types.ts)
3. Thumbnail component (optional, feature-specific)
4. ManageX component
   a. State: currentPage, searchTerm, ordering, showFilter, filters, startDate, endDate
   b. useDebounce for searchTerm and filters
   c. dispatch + useAppSelector
   d. activeFilterCount useMemo
   e. useEffect → dispatch(fetchXs())
   f. filteredData useMemo (search → filters → date range → ordering)
   g. paginatedData useMemo
   h. useEffect reset currentPage
   i. handleFilterChange, clearFilters, handleSort, handleDirectionSort
   j. columns: ColumnDef[]
   k. JSX return:
      - Top Action Bar (Filter button + DateRangeDropdown + SearchInput + Add button)
      - DynamicFilter (inline, toggled by showFilter)
      - DynamicServerTable
5. Exports
```

### Top Action Bar pattern (copy exactly)
```tsx
<div className="flex flex-col bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 relative">
  <div className="flex flex-wrap items-center justify-between px-4 py-3 gap-3">
    {/* Left: Filter + DateRange */}
    <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap">
      {/* Filter button with badge */}
      <DateRangeDropdown ... />
    </div>
    {/* Center: Search */}
    <SearchInput ... />
    {/* Right: Add button */}
    <div className="flex items-center gap-3 shrink-0 flex-wrap">
      <button className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 ...">
        <Plus size={18} strokeWidth={2.5} />
        Add {Feature}
      </button>
    </div>
  </div>
  <DynamicFilter ... />
</div>
```

### Column render patterns
- **Name with thumbnail**: Two lines — bold name + mono slug
- **Description**: `text-xs`, `line-clamp-2`, italic fallback "No description provided."
- **Status toggle**: `<button>` with `dispatch(updateXStatus(...)).unwrap().then(toast).catch(toast)`
- **Date**: Two lines — `moment(value).format('MMM DD, YYYY')` + `moment(value).format('hh:mm A')`
- **Actions**: `GlassButton` icons — View (`FiEye`, blue), Edit (`FiEdit`, green), Delete (`FiTrash`, red)
- **View modal**: `showModal({ title: 'X Details', content: <XView data={row} />, type: 'success', size: 'xl' })`
- **Edit modal**: `showModal({ title: 'Edit X: ${row.name}', content: <XForm data={row} />, type: 'success', size: 'xl' })`
- **Delete modal**: `showModal({ title: 'Delete X', content: <DeleteConfirmationModal ...>, type: 'custom', size: 'md' })`

---

## 6. View Component — `src/components/components/View/<Feature>View.tsx`

### Rules
1. Props: `{ featureData: FeatureInterface }` — single prop, named `<feature>Data`.
2. Uses `moment` for date formatting.
3. Grid layout: `grid grid-cols-2 sm:grid-cols-3 gap-5 mb-6`.
4. Label: `text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1`.
5. Value: `text-sm font-semibold text-crmText`.
6. Status badge uses `crmSuccess-*` / `crmDanger-*` classes.
7. Description at the bottom in its own section.

### Pattern (copy from RoleView)
```tsx
import React from 'react';
import type { Student } from '../../../utils/types';
import moment from 'moment';

interface StudentViewProps {
  studentData: Student;
}

const StudentView: React.FC<StudentViewProps> = ({ studentData }) => {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try { return moment(dateStr).format('MMM DD, YYYY hh:mm A'); } catch { return dateStr; }
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 mb-6">
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Name</div>
          <div className="text-sm font-semibold text-crmText">{studentData.name || '-'}</div>
        </div>
        {/* ... more fields ... */}
      </div>
    </div>
  );
};

export default StudentView;
```

---

## 7. Form Component — `src/components/components/Forms/<Feature>Form.tsx`

### Rules
1. Props: `{ featureData?: FeatureInterface }` — optional for create, provided for edit.
2. Uses `useModal()` → `hideModal` to close.
3. Uses `useAppDispatch` from `hooks/useAppDispatch` and `useAppSelector` from `hooks/useRedux`.
4. `isEdit = !!featureData`.
5. Local `loading` state for submit button spinner.
6. Submit handler: `dispatch(createX(...)).unwrap()` or `dispatch(updateX(...)).unwrap()`.
7. After success: `dispatch(fetchXs())` to refresh list → `hideModal()`.
8. Cancel & Submit buttons with CRM classes.

### Button classes
```tsx
// Cancel
className="px-5 py-2.5 rounded-xl border border-crmBorder bg-major hover:bg-major-tint text-crmText text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"

// Submit
className="px-5 py-2.5 rounded-xl bg-minor hover:bg-minor-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none"
```

---

## 8. Filter Configuration — `src/utils/filterConfiguration.ts`

### Pattern
```ts
import type { FilterField } from '../components/components/common/DynamicFilter';

export const studentFilterConfig: FilterField[] = [
  { type: 'text', label: 'Name', name: 'name', placeholder: 'Filter by name...' },
  { type: 'status', label: 'Status', name: 'status', options: [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'deactive' },
  ]},
];
```

---

## 9. Routing — `src/routes/index.tsx`

- Import: `import XPage from '../pages/<feature>';`
- Add inside `<Route element={<AppLayout />}>`: `<Route path="/<feature>" element={<XPage />} />`
- DO NOT create sub-routes unless explicitly asked.

---

## 10. Store Registration — `src/store/store.ts`

- Import: `import xReducer from "./slices/xSlice";`
- Add to `reducer: { ..., xs: xReducer }`

---

## 11. Import Conventions

| What | Import From |
|------|-------------|
| `useAppDispatch` | `../../hooks/useAppDispatch` |
| `useAppSelector` | `../../hooks/useRedux` |
| `useDebounce` | `../../hooks/useDebounce` |
| `useModal` | `../../context/ModalContext` |
| `DynamicServerTable` | `../../components/components/Table/Table` |
| `GlassButton` | `../../components/components/Button/Button` |
| `SearchInput` | `../../components/components/common/SearchInput` |
| `DateRangeDropdown` | `../../components/components/common/DateRangeDropdown` |
| `DynamicFilter` | `../../components/components/common/DynamicFilter` |
| `DeleteConfirmationModal` | `../../components/components/Modal/DeleteModal` |
| Icons (lucide) | `lucide-react` → `Filter, Plus, ChevronDown` |
| Icons (react-icons) | `react-icons/fi` → `FiEdit, FiTrash, FiEye` |
| `moment` | `moment` |
| `toast` | `react-hot-toast` |

---

## 12. Absolute Prohibitions

| ❌ Never Do This | ✅ Do This Instead |
|---|---|
| Create `CreateXPayload`, `UpdateXPayload`, `XItem` types | Use the `X` interface directly |
| Create `XListApiResponse`, `XDetailApiResponse` | Use `Promise<any>` for all service return types |
| Write `apiRequest(url, { method: 'GET' })` (options object) | Write `apiRequest(url, "GET")` (positional args) |
| Import `useDispatch` / `useSelector` from `react-redux` | Use `useAppDispatch` / `useAppSelector` from hooks |
| Add TailwindCSS config changes | Use existing utility classes or vanilla CSS |
| Create wrapper/HOC components | Keep it flat and simple |
| Hardcode data or fallback arrays | Always fetch from API |
| Add new npm packages without asking | Use existing dependencies |
| Create separate page files per view (list/detail/edit) | One `index.tsx` per feature folder with modals |
| Use `console.log` for debugging | Use `toast` for user-facing feedback |
| Create custom hooks for single-use logic | Keep logic inline in the component |
| Nest routes beyond one level | Flat routes under `<AppLayout />` |

---

## 13. Checklist Before Submitting Code

- [ ] Types: Used existing entity interface, no new wrappers/aliases
- [ ] Service: Positional args, correct naming, grouped with comment marker
- [ ] Slice: Extends `Pagination<T>`, has `condition` guard on list, `selectedXLoading` on detail, `actionLoading` on mutations
- [ ] Page: Follows ManageRoles structure exactly — action bar, filters, table
- [ ] View: Grid layout, CRM classes, moment formatting
- [ ] Form: Modal pattern, `isEdit` flag, `hideModal`, `fetchXs()` after success
- [ ] Store: New reducer registered in `store.ts`
- [ ] Routes: New route added in `routes/index.tsx`
- [ ] Filter config: Added to `filterConfiguration.ts`
- [ ] No unnecessary files, types, or abstractions created
