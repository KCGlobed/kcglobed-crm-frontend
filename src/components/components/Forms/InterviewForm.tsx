import React, { useState, useEffect } from 'react';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { scheduleInterview, fetchInterviewers, fetchLeadInterview } from '../../../store/slices/interviewSlice';
import { fetchLeadById } from '../../../store/slices/leadSlice';
import toast from 'react-hot-toast';
import type { Lead } from '../../../utils/types';

interface InterviewFormProps {
  leadData: Lead;
}

const MODES = [
  { value: 'online', label: 'Online' },
  { value: 'in_person', label: 'In person' },
  { value: 'phone', label: 'Phone' },
];

const inputClass =
  'w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-primary rounded-xl text-sm text-crmText outline-none transition-all shadow-sm focus:ring-2 focus:ring-primary-ring';

const InterviewForm: React.FC<InterviewFormProps> = ({ leadData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { interviewers, interviewersLoading } = useAppSelector((state) => state.interviews);

  const [scheduledDate, setScheduledDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [interviewer, setInterviewer] = useState('');
  const [mode, setMode] = useState('online');
  const [meetingLink, setMeetingLink] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load interviewer options once when the modal opens (GET /api/interviews/interviewers/)
  useEffect(() => {
    dispatch(fetchInterviewers());
  }, [dispatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledDate || !startTime) {
      toast.error('Date and start time are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        scheduled_date: scheduledDate,
        start_time: startTime,
        mode,
      };
      if (endTime) payload.end_time = endTime;
      if (interviewer) payload.interviewer = interviewer;
      if (meetingLink.trim()) payload.meeting_link = meetingLink.trim();
      if (location.trim()) payload.location = location.trim();
      if (notes.trim()) payload.notes = notes.trim();
      await dispatch(scheduleInterview({ uid: leadData.uid!, payload })).unwrap();
      toast.success('Interview scheduled');
      dispatch(fetchLeadById(leadData.uid!));
      dispatch(fetchLeadInterview(leadData.uid!));
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to schedule interview');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Start Time <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">End Time</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-[10px] text-crmText-tertiary">Defaults to 90 minutes if empty</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Interviewer</label>
          <select
            value={interviewer}
            onChange={(e) => setInterviewer(e.target.value)}
            disabled={interviewersLoading}
            className={`${inputClass} cursor-pointer appearance-none disabled:opacity-60`}
          >
            <option value="">{interviewersLoading ? 'Loading interviewers...' : 'Select Interviewer'}</option>
            {(interviewers || []).map((i) => (
              <option key={i.uid} value={i.uid}>
                {i.name || i.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className={`${inputClass} cursor-pointer appearance-none`}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mode === 'online' && (
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Meeting Link</label>
          <input
            type="url"
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            placeholder="e.g. https://meet.google.com/..."
            className={inputClass}
          />
        </div>
      )}

      {mode === 'in_person' && (
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Campus office, Room 12"
            className={inputClass}
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Interview notes..."
          className={`${inputClass} resize-y`}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-crmBorder">
        <button
          type="button"
          onClick={hideModal}
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl border border-crmBorder bg-major hover:bg-major-tint text-crmText text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-minor hover:bg-minor-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none flex items-center gap-2"
        >
          {submitting ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>Scheduling...</span>
            </>
          ) : (
            'Schedule Interview'
          )}
        </button>
      </div>
    </form>
  );
};

export default InterviewForm;
