// types.ts

export interface ReportingTreeNode {
  uid: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  team_count: number;
  team: ReportingTreeNode[];
  [key: string]: unknown; // tolerate extra fields the backend adds later
}

export interface ReportingTreeResponse {
  success: boolean;
  message: string;
  status: string;
  data: ReportingTreeNode[];
}
