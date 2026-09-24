// ReportingTree.tsx
import React from "react";
import type { ReportingTreeNode as TreeNodeType } from "./types";
import ReportingTreeNodeView from "./ReportingTreeNode";
import { useReportingTree } from "./useReportingTree";
import type { ReportingTreeFetcher } from "./useReportingTree";
import "./reportingTree.css";

interface ReportingTreeProps {
  data: TreeNodeType[];
  isLoading?: boolean;
  error?: string | null;
  roleIconOverrides?: Record<string, React.ReactNode>;
}

/** Presentational tree — you control fetching/state yourself and pass data in. */
export const ReportingTree: React.FC<ReportingTreeProps> = ({
  data,
  isLoading = false,
  error = null,
  roleIconOverrides,
}) => {
  if (isLoading) {
    return <div className="rt-status">Loading reporting tree...</div>;
  }

  if (error) {
    return <div className="rt-status rt-status--error">{error}</div>;
  }

  if (!data || data.length === 0) {
    return <div className="rt-status">No reporting hierarchy found.</div>;
  }

  return (
    <div className="rt-forest">
      {/* Each top-level entry is rendered as its own tree, since the API
          can return multiple independent roots (not all share one parent). */}
      {data.map((rootNode) => (
        <div className="rt-tree" key={rootNode.uid}>
          <ul>
            <ReportingTreeNodeView
              node={rootNode}
              depth={0}
              roleIconOverrides={roleIconOverrides}
            />
          </ul>
        </div>
      ))}
    </div>
  );
};

interface ConnectedReportingTreeProps {
  fetcher: ReportingTreeFetcher;
  roleIconOverrides?: Record<string, React.ReactNode>;
}

/**
 * Self-fetching variant — pass it a fetcher (fetch/axios/your api client call)
 * and it handles loading/error/refetch for you.
 *
 *   <ConnectedReportingTree
 *     fetcher={() => api.get("/reporting-tree").then(r => r.data)}
 *   />
 */
export const ConnectedReportingTree: React.FC<ConnectedReportingTreeProps> = ({
  fetcher,
  roleIconOverrides,
}) => {
  const { data, isLoading, error } = useReportingTree(fetcher);

  return (
    <ReportingTree
      data={data}
      isLoading={isLoading}
      error={error}
      roleIconOverrides={roleIconOverrides}
    />
  );
};

export default ReportingTree;
