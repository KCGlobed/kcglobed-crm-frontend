import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { createTeam, updateTeam, updateTeamLeader, fetchTeams } from '../../../store/slices/teamSlice';
import { fetchTeamOptions, fetchDepartmentOptions } from '../../../store/slices/userSlice';
import { fetchReportingManagementOptions } from '../../../store/slices/reportingMangementSlice';
import toast from 'react-hot-toast';
import type { Team, ReportingOption } from '../../../utils/types';

interface TeamFormProps {
  teamData?: Team;
}

type TeamFormValues = {
  name: string;
  description: string;
  department: string;
  parent: string;
  leader_uid: string;
};

const TeamForm: React.FC<TeamFormProps> = ({ teamData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { actionLoading } = useAppSelector((state) => state.teams);
  const {
    teamOptions,
    teamOptionsLoading,
    departmentOptions,
    departmentOptionsLoading,
  } = useAppSelector((state) => state.users);
  const { data: reportingUsers, loading: reportingLoading } = useAppSelector((state) => state.reportingManagement);

  const isEdit = !!teamData;
  const [submitting, setSubmitting] = useState(false);

  // Dropdown data: fetch once when the modal opens. Never depend on the
  // fetched lists here — an empty result would re-trigger the effect forever.
  useEffect(() => {
    dispatch(fetchDepartmentOptions());
    dispatch(fetchTeamOptions());
    dispatch(fetchReportingManagementOptions({ page_size: 1000 }));
  }, [dispatch]);

  // A team can't be its own parent
  const parentOptions = useMemo(
    () => (teamOptions || []).filter((t) => t.id !== teamData?.id),
    [teamOptions, teamData?.id]
  );

  const initialDepartment = (() => {
    if (typeof teamData?.department === 'object' && teamData?.department?.id != null) {
      return String(teamData.department.id);
    }
    if (typeof teamData?.department === 'number' || typeof teamData?.department === 'string') {
      return String(teamData.department);
    }
    return '';
  })();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TeamFormValues>({
    defaultValues: {
      name: teamData?.name || '',
      description: teamData?.description || '',
      department: initialDepartment,
      parent: teamData?.parent != null ? String(teamData.parent) : '',
      leader_uid: teamData?.leader?.uid || '',
    },
  });

  useEffect(() => {
    if (teamData) {
      reset({
        name: teamData.name || '',
        description: teamData.description || '',
        department: initialDepartment,
        parent: teamData.parent != null ? String(teamData.parent) : '',
        leader_uid: teamData.leader?.uid || '',
      });
    }
  }, [teamData, initialDepartment, reset]);

  const onSubmit = async (data: TeamFormValues) => {
    setSubmitting(true);
    try {
      if (isEdit && teamData?.id != null) {
        const payload: Team = {
          name: data.name.trim(),
          description: data.description.trim(),
          department: data.department ? Number(data.department) : null,
          parent: data.parent ? Number(data.parent) : null,
        };
        await dispatch(updateTeam({ id: teamData.id, payload })).unwrap();
        // Leader has its own endpoint (PATCH /access/teams/{id}/leader/)
        if ((data.leader_uid || '') !== (teamData.leader?.uid || '')) {
          await dispatch(updateTeamLeader({ id: teamData.id, leader: data.leader_uid || null })).unwrap();
        }
        toast.success('Team updated successfully');
      } else {
        const payload: Team = {
          name: data.name.trim(),
          description: data.description.trim(),
          department: data.department ? Number(data.department) : null,
          parent: data.parent ? Number(data.parent) : null,
          leader_uid: data.leader_uid || null,
        };
        await dispatch(createTeam(payload)).unwrap();
        toast.success('Team created successfully');
      }
      dispatch(fetchTeams());
      reset();
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || (isEdit ? 'Failed to update team' : 'Failed to create team'));
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = submitting || actionLoading;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* 2-Column Grid: Name & Department */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Team Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('name', {
              required: 'Team name is required',
              minLength: { value: 2, message: 'Team name must be at least 2 characters' },
              validate: (val) => val.trim().length > 0 || 'Team name cannot be empty or only spaces',
            })}
            placeholder="e.g. North, South Delhi..."
            autoFocus
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${errors.name
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
              }`}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Department</label>
          <select
            {...register('department')}
            disabled={departmentOptionsLoading}
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder rounded-xl text-sm text-crmText outline-none focus:border-primary focus:ring-2 focus:ring-primary-ring transition-all shadow-sm"
          >
            <option value="">{departmentOptionsLoading ? 'Loading departments...' : 'Select department...'}</option>
            {(departmentOptions || []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2-Column Grid: Parent & Leader */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Parent Team</label>
          <select
            {...register('parent')}
            disabled={teamOptionsLoading}
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder rounded-xl text-sm text-crmText outline-none focus:border-primary focus:ring-2 focus:ring-primary-ring transition-all shadow-sm"
          >
            <option value="">{teamOptionsLoading ? 'Loading teams...' : 'None (Top Level)'}</option>
            {parentOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Team Leader</label>
          <select
            {...register('leader_uid')}
            disabled={reportingLoading}
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder rounded-xl text-sm text-crmText outline-none focus:border-primary focus:ring-2 focus:ring-primary-ring transition-all shadow-sm"
          >
            <option value="">{reportingLoading ? 'Loading users...' : 'Select leader (Optional)'}</option>
            {reportingUsers?.map((opt: ReportingOption) => (
              <option key={opt.uid} value={opt.uid}>
                {opt.name || opt.email} ({opt.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">Description</label>
        <textarea
          {...register('description')}
          placeholder="Brief description of this team..."
          rows={3}
          className="w-full px-3.5 py-2.5 bg-major border border-crmBorder rounded-xl text-sm text-crmText outline-none focus:border-primary focus:ring-2 focus:ring-primary-ring transition-all shadow-sm resize-y"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end items-center gap-3 pt-3 border-t border-crmBorder">
        <button
          type="button"
          onClick={hideModal}
          disabled={isLoading}
          className="px-5 py-2.5 rounded-xl border border-crmBorder bg-major hover:bg-major-tint text-crmText text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>{isEdit ? 'Updating...' : 'Creating...'}</span>
            </>
          ) : (
            isEdit ? 'Update Team' : 'Create Team'
          )}
        </button>
      </div>
    </form>
  );
};

export default TeamForm;
