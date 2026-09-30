import React, { useEffect, useMemo } from 'react';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { fetchDepartmentById } from '../../../store/slices/departmentSlice';
import { Users, Network, Calendar, UserCircle2 } from 'lucide-react';
import type { Department } from '../../../utils/types';
import moment from 'moment';

interface DepartmentViewProps {
  departmentData: Department;
}

const DepartmentView: React.FC<DepartmentViewProps> = ({ departmentData }) => {
  const dispatch = useAppDispatch();
  const { selectedDepartment, selectedDepartmentLoading } = useAppSelector(
    (state) => state.departments
  );

  // Fetch live department detail by ID on mount
  useEffect(() => {
    if (departmentData.id != null) {
      dispatch(fetchDepartmentById(departmentData.id));
    }
  }, [dispatch, departmentData.id]);

  // Show table row data immediately, then refine with the live detail response
  const department = useMemo(
    () =>
      selectedDepartment?.id === departmentData.id
        ? { ...departmentData, ...selectedDepartment }
        : departmentData,
    [departmentData, selectedDepartment]
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return moment(dateStr).format('MMM DD, YYYY hh:mm A');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* Header Profile Card */}
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-minor-soft border border-minor-subtle">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-minor text-white text-xl font-bold shadow-sm">
          {(department.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-crmText truncate">{department.name || '-'}</h3>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                department.is_active
                  ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
                  : 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
              }`}
            >
              {department.is_active ? 'Active' : 'Inactive'}
            </span>
            {selectedDepartmentLoading && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-primary bg-primary-soft border border-primary/20 animate-pulse ml-auto">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
                Syncing
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs font-mono text-crmText-tertiary">{department.code || '-'}</div>
          <p
            className={`mt-2 text-xs leading-relaxed ${
              department.description ? 'text-crmText-secondary' : 'text-crmText-tertiary italic'
            }`}
          >
            {department.description || 'No description provided.'}
          </p>
        </div>
      </div>

      {/* Stat Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { icon: Users, label: 'Members', value: department.member_count ?? 0 },
          { icon: Network, label: 'Teams', value: department.team_count ?? 0 },
          { icon: UserCircle2, label: 'Head', value: department.head?.name || 'Unassigned' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="p-3.5 rounded-xl border border-crmBorder bg-major shadow-sm">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon size={13} strokeWidth={2.5} className="text-minor" />
              <span className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
                {label}
              </span>
            </div>
            <div className="text-base font-bold text-crmText leading-none truncate">{value}</div>
          </div>
        ))}
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
            <div className="text-xs font-semibold text-crmText">{formatDate(department.created_at)}</div>
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
            <div className="text-xs font-semibold text-crmText">{formatDate(department.updated_at)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepartmentView;
