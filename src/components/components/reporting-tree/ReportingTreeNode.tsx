// ReportingTreeNode.tsx
import React, { useEffect, useState } from "react";
import type { ReportingTreeNode as TreeNodeType } from "./types";
import { getRoleIcon } from "./roleIcons";
import "./reportingTree.css";

interface ReportingTreeNodeProps {
  node: TreeNodeType;
  depth?: number;
  roleIconOverrides?: Record<string, React.ReactNode>;
  selectedUserId?: string;
  isParentHighlighted?: boolean;
}

/** True when `uid` is somewhere inside this node's subtree (excluding the node itself). */
const containsUid = (node: TreeNodeType, uid: string): boolean =>
  (node.team || []).some((child) => child.uid === uid || containsUid(child, uid));

const ReportingTreeNode: React.FC<ReportingTreeNodeProps> = ({
  node,
  depth = 0,
  roleIconOverrides,
  selectedUserId,
  isParentHighlighted = false,
}) => {
  const hasChildren = node.team_count > 0 && node.team.length > 0;
  const [collapsed, setCollapsed] = useState(false);

  const isSelected = selectedUserId === node.uid;
  // Ancestor chain of the selected node: the nodes it "belongs to"
  const isOnPath = !!selectedUserId && !isSelected && containsUid(node, selectedUserId);
  // Selected node + everyone under it
  const isHighlighted = isParentHighlighted || isSelected;
  const shouldDim = selectedUserId ? !(isHighlighted || isOnPath) : false;

  const dimClass = shouldDim ? "rt-dimmed" : "";
  const selectedClass = isSelected ? "rt-selected" : "";
  const pathClass = isOnPath ? `rt-path ${collapsed ? "rt-path--collapsed" : ""}` : "";

  // When a member inside a collapsed subtree is selected, open the subtree so the member is visible
  useEffect(() => {
    if (isOnPath) setCollapsed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) setCollapsed((prev) => !prev);
  };

  const badgeTitle =
    isOnPath && collapsed
      ? "Selected member is inside this team. Click to expand."
      : `${node.team_count} report(s)`;

  return (
    <li>
      {depth === 0 ? (
        // Root: rounded rectangle card
        <div
          className={`rt-root-card ${!node.is_active ? "rt-inactive" : ""} ${dimClass} ${selectedClass} ${pathClass}`}
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
          } ${dimClass} ${selectedClass} ${pathClass}`}
          onClick={toggle}
        >
          <div className="rt-circle-wrap">
            <div className="rt-circle">
              {getRoleIcon(node.role, roleIconOverrides)}
            </div>
            {hasChildren && (
              <span className="rt-count-badge" title={badgeTitle}>
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
              selectedUserId={selectedUserId}
              isParentHighlighted={isHighlighted}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default ReportingTreeNode;
