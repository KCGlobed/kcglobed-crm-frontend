// ReportingTreeNode.tsx
import React, { useState } from "react";
import type { ReportingTreeNode as TreeNodeType } from "./types";
import { getRoleIcon } from "./roleIcons";
import "./reportingTree.css";

interface ReportingTreeNodeProps {
  node: TreeNodeType;
  depth?: number;
  roleIconOverrides?: Record<string, React.ReactNode>;
}

const ReportingTreeNode: React.FC<ReportingTreeNodeProps> = ({
  node,
  depth = 0,
  roleIconOverrides,
}) => {
  const hasChildren = node.team_count > 0 && node.team.length > 0;
  const [collapsed, setCollapsed] = useState(false);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) setCollapsed((prev) => !prev);
  };

  return (
    <li>
      {depth === 0 ? (
        // Root: rounded rectangle card
        <div
          className={`rt-root-card ${!node.is_active ? "rt-inactive" : ""}`}
        >
          <div className="rt-root-title">• {node.name.toUpperCase()} •</div>
          <div className="rt-root-subtitle">
            {node.role} &middot; {node.email}
          </div>
        </div>
      ) : (
        // Non-root: circular icon node
        <div
          className={`rt-node ${!node.is_active ? "rt-inactive" : ""} ${
            hasChildren ? "rt-node--clickable" : ""
          }`}
          onClick={toggle}
        >
          <div className="rt-circle-wrap">
            <div className="rt-circle">
              {getRoleIcon(node.role, roleIconOverrides)}
            </div>
            {hasChildren && (
              <span className="rt-count-badge" title={`${node.team_count} report(s)`}>
                {collapsed ? "+" : node.team_count}
              </span>
            )}
          </div>
          <div className="rt-label">{node.name}</div>
          <div className="rt-sublabel">{node.role}</div>
          <div className="rt-desc">{node.email}</div>
          {!node.is_active && <div className="rt-inactive-tag">Inactive</div>}
        </div>
      )}

      {hasChildren && !collapsed && (
        <ul>
          {node.team.map((child) => (
            <ReportingTreeNode
              key={child.uid}
              node={child}
              depth={depth + 1}
              roleIconOverrides={roleIconOverrides}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default ReportingTreeNode;
