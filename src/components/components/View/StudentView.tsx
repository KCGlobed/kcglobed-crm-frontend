import React, { useEffect, useMemo } from 'react';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { fetchStudentById } from '../../../store/slices/studentSlice';
import type { Student } from '../../../utils/types';
import moment from 'moment';

interface StudentViewProps {
  studentData: Student;
}

const GENDER_LABELS: Record<string, string> = { '0': 'Male', '1': 'Female', '2': 'Other' };

const StudentView: React.FC<StudentViewProps> = ({ studentData: studentRow }) => {
  const dispatch = useAppDispatch();
  const { selectedStudent } = useAppSelector((state) => state.students);

  // Fetch live application detail on mount (GET /api/students/{application_id}/)
  useEffect(() => {
    if (studentRow.application_id) {
      dispatch(fetchStudentById(studentRow.application_id));
    }
  }, [dispatch, studentRow.application_id]);

  const studentData = useMemo(
    () =>
      selectedStudent?.application_id === studentRow.application_id
        ? { ...studentRow, ...selectedStudent }
        : studentRow,
    [studentRow, selectedStudent]
  );

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      return moment(dateStr).format('MMM DD, YYYY hh:mm A');
    } catch {
      return dateStr;
    }
  };

  const fields = [
    { label: 'Application ID', value: studentData.application_id },
    { label: 'Full Name', value: studentData.full_name || `${studentData.first_name || ''} ${studentData.last_name || ''}`.trim() },
    { label: 'Email', value: studentData.email },
    { label: 'Phone', value: studentData.phone },
    { label: 'Date of Birth', value: studentData.date_of_birth },
    { label: 'Gender', value: studentData.gender != null && studentData.gender !== '' ? GENDER_LABELS[String(studentData.gender)] || String(studentData.gender) : '-' },
    { label: 'City', value: studentData.city },
    { label: 'State', value: studentData.state },
    { label: 'Pincode', value: studentData.pincode },
    { label: '10th Year / %', value: studentData.tenth_passing_year ? `${studentData.tenth_passing_year} / ${studentData.tenth_passing_percentage ?? '-'}%` : '-' },
    { label: '12th Year / %', value: studentData.twelveth_passing_year ? `${studentData.twelveth_passing_year} / ${studentData.twelveth_passing_percentage ?? '-'}%` : '-' },
    { label: 'Institution', value: studentData.institution },
    { label: 'Guardian', value: studentData.guardian_name ? `${studentData.guardian_name} (${studentData.guardian_dropdown || '-'})` : '-' },
    { label: 'Guardian Phone', value: studentData.guardian_phone },
    { label: 'Program', value: studentData.final_program || studentData.initial_program },
    { label: 'Profile Completed', value: studentData.profile_status === true ? 'Yes' : studentData.profile_status === false ? 'No' : studentData.profile_status },
    { label: 'Approved', value: studentData.status === true ? 'Yes' : studentData.status === false ? 'No' : studentData.status },
    {
      label: 'Lead Stage',
      value:
        typeof studentData.stage === 'string'
          ? studentData.stage.replace(/-/g, ' ')
          : studentData.stage?.name || studentData.lead?.stage?.name,
    },
    { label: 'Document Email Sent', value: formatDate(studentData.document_email_sent_at) },
    { label: 'Profile Completed', value: formatDate(studentData.profile_completed_at) },
    { label: 'Approved At', value: formatDate(studentData.approved_at) },
    { label: 'Created', value: formatDate(studentData.created_at) },
  ];

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 mb-6">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
              {label}
            </div>
            <div className="text-sm font-semibold text-crmText">{value || '-'}</div>
          </div>
        ))}
      </div>
      {studentData.address && (
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Address</div>
          <div className="text-sm text-crmText-secondary">{studentData.address}</div>
        </div>
      )}
    </div>
  );
};

export default StudentView;
