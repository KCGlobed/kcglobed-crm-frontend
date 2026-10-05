import { DataScope, FieldRule, ModulePermission } from '../constants/permissions';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        isSuperAdmin: boolean;
        permissions: ModulePermission[];
        dataScope: DataScope;
        fieldRules: FieldRule[];
        team?: string;
      };
    }
  }
}

export {};
