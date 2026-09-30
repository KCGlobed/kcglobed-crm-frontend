import React, { useState, useEffect, useMemo } from 'react';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import {
  fetchTeamById,
  fetchTeamMembers,
  addTeamMembers,
  removeTeamMembers,
} from '../../../store/slices/teamSlice';
import { fetchReportingManagementOptions } from '../../../store/slices/reportingMangementSlice';
import { Users, Network, UserCircle2, Calendar, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Team, ReportingOption } from '../../../utils/types';
import moment from 'moment';

interface TeamViewProps {
  teamData: Team;
}

const TeamView: React.FC<TeamViewProps> = ({ teamData }) => {
  const dispatch = useAppDispatch();
  const { selectedTeam, selectedTeamLoading, members, membersLoading, actionLoading } = useAppSelector(
    (state) => state.teams
  );
  const { data: reportingUsers } = useAppSelector((state) => state.reportingManagement);
  const [newMemberUid, setNewMemberUid] = useState('');

  // Fetch live team detail + members by ID on mount
  useEffect(() => {
    if (teamData.id != null) {
      dispatch(fetchTeamById(teamData.id));
      dispatch(fetchTeamMembers(teamData.id));
    }
  }, [dispatch, teamData.id]);

  // People picker for adding members — fetch once when the modal opens
  useEffect(() => {
    dispatch(fetchReportingManagementOptions({ page_size: 1000 }));
  }, [dispatch]);

  // Show table row data immediately, then refine with the live detail response
  const team = useMemo(
    () => (selectedTeam?.id === teamData.id ? { ...teamData, ...selectedTeam } : teamData),
    [teamData, selectedTeam]
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return moment(dateStr).format('MMM DD, YYYY hh:mm A');
    } catch {
      return dateStr;
    }
  };

  const departmentName =
    team.department_detail?.name ||
    (typeof team.department === 'object' && team.department ? team.department.name : null);

  // Users not already in the team, offered by the add-member picker
  const memberUids = useMemo(() => new Set((members || []).map((m) => m.uid)), [members]);
  const addableUsers = useMemo(
    () => (reportingUsers || []).filter((u: ReportingOption) => u.uid && !memberUids.has(u.uid)),
    [reportingUsers, memberUids]
  );

  const handleAddMember = async () => {
    if (!newMemberUid || team.id == null) {
      toast.error('Please select a user to add');
      return;
    }
    try {
      await dispatch(addTeamMembers({ id: team.id, users: [newMemberUid] })).unwrap();
      toast.success('Member added successfully');
      setNewMemberUid('');
      dispatch(fetchTeamMembers(team.id));
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (uid?: string) => {
    if (!uid || team.id == null) return;
    try {
      await dispatch(removeTeamMembers({ id: team.id, users: [uid] })).unwrap();
      toast.success('Member removed successfully');
      dispatch(fetchTeamMembers(team.id));
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to remove member');
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* Header Profile Card */}
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-minor-soft border border-minor-subtle">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-minor text-white text-xl font-bold shadow-sm">
          {(team.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-crmText truncate">{team.name || '-'}</h3>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                team.is_active
                  ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
                  : 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
              }`}
            >
              {team.is_active ? 'Active' : 'Inactive'}
            </span>
            {team.parent_detail?.name && (
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-major-tint text-crmText-secondary border-crmBorder">
                Child of {team.parent_detail.name}
              </span>
            )}
            {selectedTeamLoading && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-primary bg-primary-soft border border-primary/20 animate-pulse ml-auto">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
                Syncing
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs font-mono text-crmText-tertiary">{team.code || '-'}</div>
          <p
            className={`mt-2 text-xs leading-relaxed ${
              team.description ? 'text-crmText-secondary' : 'text-crmText-tertiary italic'
            }`}
          >
            {team.description || 'No description provided.'}
          </p>
        </div>
      </div>

      {/* Stat Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users, label: 'Members', value: team.member_count ?? 0 },
          { icon: Network, label: 'Child Teams', value: team.child_count ?? 0 },
          { icon: UserCircle2, label: 'Leader', value: team.leader?.name || 'Unassigned' },
          { icon: Network, label: 'Department', value: departmentName || '-' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="p-3.5 rounded-xl border border-crmBorder bg-major shadow-sm">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon size={13} strokeWidth={2.5} className="text-minor" />
              <span className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
                {label}
              </span>
            </div>
            <div className="text-sm font-bold text-crmText leading-none truncate">{value}</div>
          </div>
        ))}
      </div>

      {/* Members */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
            Team Members
          </div>
        </div>

        {/* Add member */}
        <div className="flex items-center gap-2 mb-2">
          <select
            value={newMemberUid}
            onChange={(e) => setNewMemberUid(e.target.value)}
            className="flex-1 px-3 py-2 bg-major border border-crmBorder rounded-xl text-xs text-crmText outline-none focus:border-primary transition-all shadow-sm"
          >
            <option value="">Select a user to add...</option>
            {addableUsers.map((u: ReportingOption) => (
              <option key={u.uid} value={u.uid}>
                {u.name || u.email} ({u.role})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddMember}
            disabled={actionLoading || !newMemberUid}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-minor hover:bg-minor-hover disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border-none shrink-0"
          >
            <UserPlus size={14} /> Add
          </button>
        </div>

        <div className="border border-crmBorder rounded-xl bg-major divide-y divide-crmBorder max-h-[220px] overflow-y-auto">
          {membersLoading ? (
            <div className="p-6 text-center text-crmText-tertiary text-xs">Loading members...</div>
          ) : (members || []).length === 0 ? (
            <div className="p-6 text-center text-crmText-tertiary text-xs italic">
              No members in this team yet.
            </div>
          ) : (
            (members || []).map((m) => (
              <div key={m.uid} className="flex items-center justify-between gap-3 px-3.5 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-crmText truncate">
                    {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.email}
                  </div>
                  <div className="text-[10px] text-crmText-tertiary truncate">
                    {m.email}
                    {typeof m.role === 'object' && m.role?.name ? ` · ${m.role.name}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMember(m.uid)}
                  disabled={actionLoading}
                  title="Remove from team"
                  className="p-1.5 rounded-lg text-crmText-tertiary hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer border-none bg-transparent shrink-0 disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-crmBorder bg-major">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-50 border border-crmBorder flex items-center justify-center text-crmText-tertiary">
            <Calendar size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
              Created On
            </div>
            <div className="text-xs font-semibold text-crmText">{formatDate(team.created_at)}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-50 border border-crmBorder flex items-center justify-center text-crmText-tertiary">
            <Calendar size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
              Updated On
            </div>
            <div className="text-xs font-semibold text-crmText">{formatDate(team.updated_at)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamView;
