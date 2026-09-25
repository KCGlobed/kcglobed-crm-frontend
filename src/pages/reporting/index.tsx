import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Maximize2, Minimize2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../hooks/useRedux";
import {
  fetchRootReportingTree,
  fetchReportingTreeByUser,
  setSelectedUser,
} from "../../store/slices/reportingSlice";
import { ReportingTree } from "../../components/components/reporting-tree";
import type { ReportingNode } from "../../utils/types";

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
];

const getInitials = (name?: string) =>
  (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("") || "?";

const getAvatarColor = (key?: string) => {
  let hash = 0;
  for (const ch of key || "") hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const findNode = (nodes: ReportingNode[], uid: string): ReportingNode | undefined => {
  for (const n of nodes) {
    if (n.uid === uid) return n;
    const found = findNode(n.team || [], uid);
    if (found) return found;
  }
  return undefined;
};

const countNodes = (nodes: ReportingNode[]): number =>
  nodes.reduce((sum, n) => sum + 1 + countNodes(n.team || []), 0);

const collectParentUids = (nodes: ReportingNode[], acc: string[] = []): string[] => {
  for (const n of nodes) {
    if ((n.team?.length ?? 0) > 0) {
      acc.push(n.uid || "");
      collectParentUids(n.team || [], acc);
    }
  }
  return acc;
};

// Map the graph's colour variables onto the CRM theme
const TREE_THEME = {
  "--rt-primary": "var(--primary)",
  "--rt-primary-dark": "var(--primary)",
  "--rt-primary-light": "var(--primary-ring)",
  "--rt-line": "var(--border-strong)",
} as React.CSSProperties;

// Folder-style hierarchy row (recursive)
interface HierarchyNodeProps {
  node: ReportingNode;
  depth: number;
  isLast: boolean;
  selectedUser: string;
  currentUid?: string;
  collapsed: Set<string>;
  onToggle: (uid: string) => void;
  onSelect: (uid: string) => void;
}

const INDENT = 20;

const HierarchyNode: React.FC<HierarchyNodeProps> = ({
  node,
  depth,
  isLast,
  selectedUser,
  currentUid,
  collapsed,
  onToggle,
  onSelect,
}) => {
  const uid = node.uid || "";
  const hasChildren = (node.team?.length ?? 0) > 0;
  const isOpen = !collapsed.has(uid);
  const isSelected = selectedUser === uid;
  const isMe = currentUid === uid;
  const teamCount = node.team_count ?? node.team?.length ?? 0;

  return (
    <div className="relative">
      {/* connector from parent's guide line into this row */}
      {depth > 0 && (
        <>
          <span
            className="absolute border-t border-crmBorder-strong"
            style={{ left: (depth - 1) * INDENT + 15, width: 12, top: 24 }}
          />
          {!isLast && (
            <span
              className="absolute top-0 bottom-0 border-l border-crmBorder-strong"
              style={{ left: (depth - 1) * INDENT + 15 }}
            />
          )}
          {isLast && (
            <span
              className="absolute top-0 border-l border-crmBorder-strong"
              style={{ left: (depth - 1) * INDENT + 15, height: 24 }}
            />
          )}
        </>
      )}

      <div
        className={`relative flex items-center gap-1.5 pr-2 py-1.5 rounded-xl transition-all ${
          isSelected
            ? "bg-minor-soft ring-1 ring-minor/20"
            : "hover:bg-major-tint"
        }`}
        style={{ marginLeft: depth * INDENT + 4 }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(uid)}
          aria-label={isOpen ? "Collapse" : "Expand"}
          className={`w-6 h-6 shrink-0 flex items-center justify-center rounded-md transition-colors ${
            hasChildren
              ? "cursor-pointer text-crmText-tertiary hover:bg-white hover:text-minor"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <ChevronRight
            size={14}
            strokeWidth={2.5}
            className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
          />
        </button>

        <button
          type="button"
          onClick={() => onSelect(uid)}
          className="flex-1 min-w-0 flex items-center gap-2.5 cursor-pointer text-left"
        >
          <span className="relative shrink-0">
            <span
              className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold ${getAvatarColor(
                uid
              )} ${isSelected ? "ring-2 ring-minor ring-offset-1" : ""}`}
            >
              {getInitials(node.name)}
            </span>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                node.is_active === false ? "bg-crmDanger" : "bg-crmSuccess"
              }`}
            />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className={`text-[13px] font-semibold truncate ${
                  isSelected ? "text-minor" : "text-crmText"
                }`}
              >
                {node.name}
              </span>
              {isMe && (
                <span className="shrink-0 px-1.5 py-px rounded-md bg-crmSuccess-bg text-crmSuccess text-[9px] font-bold uppercase tracking-wider">
                  You
                </span>
              )}
            </span>
            <span className="flex items-center gap-1.5 min-w-0 text-[11px]">
              <span
                className={`shrink-0 font-bold uppercase tracking-wider text-[9.5px] ${
                  isSelected ? "text-minor" : "text-crmText-secondary"
                }`}
              >
                {node.role}
              </span>
              <span className="text-crmText-tertiary">·</span>
              <span className="text-crmText-tertiary truncate">{node.email}</span>
            </span>
          </span>

          {teamCount > 0 && (
            <span
              title={`${teamCount} direct report${teamCount === 1 ? "" : "s"}`}
              className={`shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isSelected ? "bg-minor text-white" : "bg-major-tint text-crmText-secondary"
              }`}
            >
              {teamCount}
            </span>
          )}
        </button>
      </div>

      {hasChildren && isOpen && (
        <div className="relative">
          {node.team!.map((child, i) => (
            <HierarchyNode
              key={child.uid}
              node={child}
              depth={depth + 1}
              isLast={i === node.team!.length - 1}
              selectedUser={selectedUser}
              currentUid={currentUid}
              collapsed={collapsed}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ReportingPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [fullGraph, setFullGraph] = useState(false);
  const { user } = useAppSelector((state) => state.auth);
  const { rootTree, rootLoading, selectedUser, treeData, loading, error } = useAppSelector(
    (state) => state.reporting
  );

  // Load the logged-in user's hierarchy and default the graph to them
  useEffect(() => {
    if (user?.uid) {
      dispatch(fetchRootReportingTree(user.uid));
      dispatch(setSelectedUser(user.uid));
    }
  }, [dispatch, user?.uid]);

  useEffect(() => {
    if (selectedUser) {
      dispatch(fetchReportingTreeByUser(selectedUser));
    }
  }, [dispatch, selectedUser]);

  const selectedNode = useMemo(
    () => findNode(rootTree, selectedUser) || treeData[0],
    [rootTree, selectedUser, treeData]
  );

  const totalMembers = useMemo(() => countNodes(rootTree), [rootTree]);
  const parentUids = useMemo(() => collectParentUids(rootTree), [rootTree]);
  const allCollapsed = parentUids.length > 0 && parentUids.every((u) => collapsed.has(u));
  const directReports = treeData[0]?.team_count ?? 0;
  const totalUnder = useMemo(() => Math.max(countNodes(treeData) - 1, 0), [treeData]);

  const handleToggle = (uid: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-full min-w-0 min-h-screen lg:h-screen bg-major-tint p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="w-10 h-10 shrink-0 rounded-xl bg-white border border-crmBorder shadow-sm text-crmText-secondary hover:text-minor hover:border-minor/40 hover:bg-minor-subtle transition-all cursor-pointer flex items-center justify-center"
        >
          <ArrowLeft size={18} strokeWidth={2.5} />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-crmText leading-tight">Reporting</h1>
          <p className="text-sm text-crmText-tertiary mt-0.5">
            Browse your team hierarchy and click a member to view their reporting graph.
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:items-stretch lg:flex-1 lg:min-h-0">
        {/* Left: Hierarchy */}
        <div className={`w-full lg:w-[380px] shrink-0 lg:h-full bg-white rounded-2xl ${fullGraph ? "hidden" : ""} shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 flex flex-col overflow-hidden`}>
          <div className="px-5 py-4 border-b border-crmBorder bg-gradient-to-r from-minor-subtle to-transparent flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 shrink-0 rounded-lg bg-minor-soft text-minor flex items-center justify-center">
                <Users size={16} strokeWidth={2.5} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-crmText leading-tight">My Hierarchy</div>
                <div className="text-[11px] text-crmText-tertiary leading-tight">
                  {totalMembers} member{totalMembers === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            {parentUids.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setCollapsed(allCollapsed ? new Set() : new Set(parentUids))
                }
                className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-minor hover:bg-minor-soft transition-colors cursor-pointer"
              >
                {allCollapsed ? "Expand all" : "Collapse all"}
              </button>
            )}
          </div>

          <div className="h-[432px] lg:h-auto lg:flex-1 lg:min-h-0 overflow-auto p-3">
            {rootLoading ? (
              <div className="rt-status">Loading hierarchy...</div>
            ) : rootTree.length === 0 ? (
              <div className="rt-status">No hierarchy found.</div>
            ) : (
              rootTree.map((node, i) => (
                <HierarchyNode
                  key={node.uid}
                  node={node}
                  depth={0}
                  isLast={i === rootTree.length - 1}
                  selectedUser={selectedUser}
                  currentUid={user?.uid}
                  collapsed={collapsed}
                  onToggle={handleToggle}
                  onSelect={(uid) => dispatch(setSelectedUser(uid))}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: Reporting tree */}
        <div className="flex-1 w-full min-w-0 h-[520px] lg:h-full">
          <div className="h-full bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 flex flex-col overflow-hidden">
            {selectedNode && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-crmBorder bg-gradient-to-r from-minor-subtle to-transparent">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ring-2 ring-minor/20 ring-offset-1 ${getAvatarColor(
                      selectedNode.uid
                    )}`}
                  >
                    {getInitials(selectedNode.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base font-bold text-crmText truncate">
                        {selectedNode.name}
                      </span>
                      {selectedNode.uid === user?.uid && (
                        <span className="shrink-0 px-1.5 py-px rounded-md bg-crmSuccess-bg text-crmSuccess text-[9px] font-bold uppercase tracking-wider">
                          You
                        </span>
                      )}
                      <span
                        className={`shrink-0 px-2 py-px rounded-full text-[10px] font-bold ${
                          selectedNode.is_active === false
                            ? "bg-crmDanger-bg text-crmDanger border border-crmDanger-border"
                            : "bg-crmSuccess-bg text-crmSuccess border border-crmSuccess-border"
                        }`}
                      >
                        {selectedNode.is_active === false ? "Inactive" : "Active"}
                      </span>
                    </div>
                    <div className="text-xs text-crmText-tertiary truncate">
                      <span className="font-semibold text-crmText-secondary">
                        {selectedNode.role}
                      </span>{" "}
                      · {selectedNode.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!loading && !error && treeData.length > 0 && (
                    <>
                      <span className="px-3 py-1 rounded-full bg-minor-soft text-minor text-[11px] font-bold">
                        {directReports} direct
                      </span>
                      <span className="px-3 py-1 rounded-full bg-major-tint text-crmText-secondary text-[11px] font-bold">
                        {totalUnder} total
                      </span>
                    </>
                  )}
                  {user?.uid && selectedUser !== user.uid && (
                    <button
                      type="button"
                      onClick={() => dispatch(setSelectedUser(user.uid || ""))}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-crmBorder bg-white hover:bg-minor-subtle hover:border-minor/40 text-crmText text-[11px] font-semibold transition-all cursor-pointer shadow-sm"
                    >
                      <ArrowLeft size={13} strokeWidth={2.5} />
                      My graph
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setFullGraph((v) => !v)}
                    aria-label={fullGraph ? "Show hierarchy" : "Expand graph"}
                    title={fullGraph ? "Show hierarchy" : "Expand graph"}
                    className="w-8 h-8 rounded-xl border border-crmBorder bg-white hover:bg-minor-subtle hover:border-minor/40 text-crmText-secondary hover:text-minor transition-all cursor-pointer shadow-sm flex items-center justify-center"
                  >
                    {fullGraph ? <Minimize2 size={15} strokeWidth={2.5} /> : <Maximize2 size={15} strokeWidth={2.5} />}
                  </button>
                </div>
              </div>
            )}

            <div
              style={TREE_THEME}
              className="flex-1 min-h-0 overflow-auto px-8 pb-8 pt-5 bg-[radial-gradient(circle,rgba(61,31,115,0.07)_1px,transparent_1px)] bg-[length:20px_20px] rounded-b-2xl"
            >
              {selectedUser ? (
                <div className="min-w-max min-h-full flex items-start justify-center">
                  <ReportingTree data={rootTree as any} isLoading={rootLoading} error={error} selectedUserId={selectedUser} />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-16">
                  <span className="w-14 h-14 rounded-2xl bg-minor-soft text-minor flex items-center justify-center mb-4">
                    <Users size={26} strokeWidth={2} />
                  </span>
                  <div className="text-sm font-semibold text-crmText">No member selected</div>
                  <div className="text-xs text-crmText-tertiary mt-1">
                    Pick someone from the hierarchy to view their reporting graph.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportingPage;
