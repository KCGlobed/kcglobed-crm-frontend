import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  UserRound,
  FolderOpen,
  CalendarClock,
  CreditCard,
  Mail,
  Clock,
  History,
  PhoneCall,
  PhoneOutgoing,
  UserCog,
  UserPlus,
  Star,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  Send,
  BadgeCheck,
} from 'lucide-react';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import {
  fetchLeadById,
  clearLeadDetail,
  startLeadCall,
  sendDocumentEmail,
  approveLeadProfile,
  generateLeadLetters,
  initiateLeadPayment,
  verifyLeadPayment,
  fetchLeadDocuments,
  fetchLeadLetters,
  fetchLeadPayment,
  fetchLeadActivities,
  fetchLeadAssignments,
  fetchLeadCalls,
} from '../../../store/slices/leadSlice';
import { fetchLeadInterview, updateInterviewStatus } from '../../../store/slices/interviewSlice';
import { fetchPaymentGateway } from '../../../store/slices/paymentSlice';
import {
  downloadStudentDocumentApi,
  downloadLetterApi,
  fetchPaymentProofApi,
} from '../../../services/apiServices';
import { useModal } from '../../../context/ModalContext';
import LeadReassignForm from '../Forms/LeadReassignForm';
import CallOutcomeForm from '../Forms/CallOutcomeForm';
import FollowUpForm from '../Forms/FollowUpForm';
import MarkInterestedForm from '../Forms/MarkInterestedForm';
import InterviewForm from '../Forms/InterviewForm';
import InterviewResultForm from '../Forms/InterviewResultForm';
import OfflinePaymentForm from '../Forms/OfflinePaymentForm';
import PaymentVerifyForm from '../Forms/PaymentVerifyForm';
import DocumentReviewForm from '../Forms/DocumentReviewForm';
import StudentProfileForm from '../Forms/StudentProfileForm';
import toast from 'react-hot-toast';
import type { Lead, Payment, StudentDocument, Letter } from '../../../utils/types';
import moment from 'moment';

type TabKey =
  | 'overview'
  | 'profile'
  | 'documents'
  | 'interview'
  | 'payment'
  | 'letters'
  | 'timeline'
  | 'history';

interface LeadViewProps {
  leadData: Lead;
  initialTab?: TabKey | 'details' | 'queries' | 'activity';
}

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: FileText },
  { key: 'profile', label: 'Profile', icon: UserRound },
  { key: 'documents', label: 'Documents', icon: FolderOpen },
  { key: 'interview', label: 'Interview', icon: CalendarClock },
  { key: 'payment', label: 'Payment', icon: CreditCard },
  { key: 'letters', label: 'Letters', icon: Mail },
  { key: 'timeline', label: 'Timeline', icon: Clock },
  { key: 'history', label: 'History', icon: History },
];

// Maps legacy initialTab values from older callers onto the new tabs
const LEGACY_TABS: Record<string, TabKey> = {
  details: 'overview',
  queries: 'timeline',
  activity: 'timeline',
};

const statusBadgeClass = (status?: string) => {
  switch ((status || '').toUpperCase()) {
    case 'APPROVED':
    case 'SUCCESS':
    case 'VERIFIED':
    case 'COMPLETED':
    case 'SELECTED':
      return 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border';
    case 'REJECTED':
    case 'FAILED':
    case 'CANCELLED':
    case 'NOT_SELECTED':
    case 'MISSED':
    case 'NO_SHOW':
      return 'bg-crmDanger-bg text-crmDanger border-crmDanger-border';
    default:
      return 'bg-major-tint text-crmText-secondary border-crmBorder';
  }
};

const loadRazorpayScript = () =>
  new Promise<boolean>((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const LeadView: React.FC<LeadViewProps> = ({ leadData: leadRow, initialTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState<TabKey>(
    (LEGACY_TABS[initialTab as string] || initialTab) as TabKey
  );
  const dispatch = useAppDispatch();
  const { showModal } = useModal();
  const {
    selectedLead,
    actionLoading,
    documents,
    documentsProblems,
    documentsLoading,
    letters,
    lettersLoading,
    leadPayment,
    leadPaymentLoading,
    activities,
    activitiesLoading,
    assignments,
    assignmentsLoading,
    calls,
    callsLoading,
  } = useAppSelector((state) => state.leads);
  const { leadInterview, leadInterviewLoading } = useAppSelector((state) => state.interviews);

  // Fetch live lead detail by uid on mount (GET /api/leads/{uid}/)
  useEffect(() => {
    if (leadRow.uid) {
      dispatch(clearLeadDetail());
      dispatch(fetchLeadById(leadRow.uid));
    }
  }, [dispatch, leadRow.uid]);

  // Load tab data when a tab opens
  useEffect(() => {
    if (!leadRow.uid) return;
    if (activeTab === 'documents') dispatch(fetchLeadDocuments(leadRow.uid));
    if (activeTab === 'interview') dispatch(fetchLeadInterview(leadRow.uid));
    if (activeTab === 'payment') {
      dispatch(fetchLeadPayment(leadRow.uid));
      dispatch(fetchPaymentGateway());
    }
    if (activeTab === 'letters') dispatch(fetchLeadLetters(leadRow.uid));
    if (activeTab === 'timeline') dispatch(fetchLeadActivities(leadRow.uid));
    if (activeTab === 'history') {
      dispatch(fetchLeadAssignments(leadRow.uid));
      dispatch(fetchLeadCalls(leadRow.uid));
    }
  }, [dispatch, activeTab, leadRow.uid]);

  // Show the table row immediately, then refine it with the detail response
  const leadData = useMemo(
    () => (selectedLead?.uid === leadRow.uid ? { ...leadRow, ...selectedLead } : leadRow),
    [leadRow, selectedLead]
  );

  const actions = leadData.available_actions || [];
  const uid = leadData.uid!;
  const interview = leadInterview?.interview || leadData.interview;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      return moment(dateStr).format('MMM DD, YYYY hh:mm A');
    } catch {
      return dateStr;
    }
  };

  const refreshLead = () => {
    dispatch(fetchLeadById(uid));
  };

  const downloadBlob = async (response: any, filename: string) => {
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ---- Action handlers ----

  const handleStartCall = async () => {
    try {
      await dispatch(startLeadCall(uid)).unwrap();
      toast.success('Call started');
      dispatch(fetchLeadCalls(uid));
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to start call');
    }
  };

  const handleSendDocumentEmail = async () => {
    try {
      await dispatch(sendDocumentEmail(uid)).unwrap();
      toast.success('Document upload email sent to the student');
      refreshLead();
    } catch (err: any) {
      toast.error(err?.message || err || 'Unable to send document upload email. Retry allowed.');
    }
  };

  const handleApproveProfile = async () => {
    try {
      await dispatch(approveLeadProfile(uid)).unwrap();
      toast.success('Profile approved');
      refreshLead();
    } catch (err: any) {
      toast.error(err?.message || err || 'Profile cannot be approved yet');
      setActiveTab('documents');
      dispatch(fetchLeadDocuments(uid));
    }
  };

  const handleGenerateLetters = async () => {
    try {
      await dispatch(generateLeadLetters(uid)).unwrap();
      toast.success('Letters generated');
      setActiveTab('letters');
      dispatch(fetchLeadLetters(uid));
      refreshLead();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to generate letters');
    }
  };

  const handleInterviewStatus = async (status: string) => {
    if (!interview?.id) {
      toast.error('No scheduled interview found');
      return;
    }
    try {
      await dispatch(updateInterviewStatus({ id: interview.id, payload: { status } })).unwrap();
      toast.success(`Interview marked ${status.toLowerCase().replace('_', ' ')}`);
      refreshLead();
      dispatch(fetchLeadInterview(uid));
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to update interview status');
    }
  };

  const handleInitiatePayment = async () => {
    try {
      const data = await dispatch(initiateLeadPayment(uid)).unwrap();
      const checkout = data?.checkout;
      const paymentUid = data?.payment?.uid;
      if (!checkout) {
        toast.error('No checkout information returned');
        return;
      }
      if (checkout.gateway === 'sandbox') {
        // Dev-only sandbox gateway: signature "sandbox-success" marks the order paid
        await dispatch(
          verifyLeadPayment({
            uid,
            payload: {
              payment_uid: paymentUid,
              order_id: checkout.order_id,
              payment_id: 'pay_sandbox_ok',
              signature: 'sandbox-success',
            },
          })
        ).unwrap();
        toast.success('Payment successful (sandbox)');
        refreshLead();
        dispatch(fetchLeadPayment(uid));
        return;
      }
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error('Unable to load Razorpay checkout');
        return;
      }
      const rzp = new (window as any).Razorpay({
        key: checkout.key,
        order_id: checkout.order_id,
        amount: checkout.amount,
        currency: checkout.currency,
        name: checkout.name,
        description: checkout.description,
        prefill: checkout.prefill,
        handler: async (resp: any) => {
          try {
            await dispatch(
              verifyLeadPayment({
                uid,
                payload: {
                  payment_uid: paymentUid,
                  order_id: resp.razorpay_order_id,
                  payment_id: resp.razorpay_payment_id,
                  signature: resp.razorpay_signature,
                },
              })
            ).unwrap();
            toast.success('Payment successful');
            refreshLead();
            dispatch(fetchLeadPayment(uid));
          } catch (err: any) {
            toast.error(err?.message || err || 'Payment failed. Please try again.');
          }
        },
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to initiate payment');
    }
  };

  const handleVerifyOfflinePayment = () => {
    const pending =
      (leadPayment?.payments || []).find((p) => p.status === 'OFFLINE_PENDING') ||
      (leadData.payment?.status === 'OFFLINE_PENDING' ? leadData.payment : null);
    if (!pending) {
      setActiveTab('payment');
      dispatch(fetchLeadPayment(uid));
      toast('Open the Payment tab to verify the pending offline payment');
      return;
    }
    showModal({
      title: 'Verify Offline Payment',
      content: <PaymentVerifyForm paymentData={{ ...pending, lead: leadData }} />,
      type: 'custom',
      size: 'md',
    });
  };

  const handleDownloadDocument = async (doc: StudentDocument) => {
    const id = doc.document?.id ?? doc.id;
    if (!id) return;
    try {
      const response = await downloadStudentDocumentApi(id);
      await downloadBlob(response, doc.document?.original_name || `${doc.document_type || 'document'}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download document');
    }
  };

  const handleDownloadLetter = async (letter: Letter) => {
    if (!letter.uid) return;
    try {
      const response = await downloadLetterApi(letter.uid);
      await downloadBlob(response, `${letter.letter_number || letter.letter_type || 'letter'}.pdf`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download letter');
    }
  };

  const handleDownloadProof = async (payment: Payment) => {
    if (!payment.uid) return;
    try {
      const response = await fetchPaymentProofApi(payment.uid);
      await downloadBlob(response, `payment-proof-${payment.uid}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download proof');
    }
  };

  // Buttons rendered from available_actions (backend already intersects stage x permissions).
  // variant: primary = does something, subtle = just opens a tab, danger = destructive.
  const actionButtons: { action: string; label: string; icon: React.ElementType; onClick: () => void; variant?: 'primary' | 'subtle' | 'danger' }[] = [
    { action: 'assign', label: 'Assign', icon: UserCog, onClick: () => showModal({ title: `Assign Lead: ${leadData.full_name}`, content: <LeadReassignForm leadData={leadData} />, type: 'custom', size: 'md' }) },
    { action: 'start_call', label: 'Start Call', icon: PhoneOutgoing, onClick: handleStartCall },
    { action: 'call_outcome', label: 'Call Outcome', icon: PhoneCall, onClick: () => showModal({ title: `Call Outcome: ${leadData.full_name}`, content: <CallOutcomeForm leadData={leadData} />, type: 'custom', size: 'md' }) },
    { action: 'follow_up', label: 'Follow-up', icon: CalendarClock, onClick: () => showModal({ title: `Schedule Follow-up: ${leadData.full_name}`, content: <FollowUpForm leadData={leadData} />, type: 'custom', size: 'md' }) },
    { action: 'mark_interested', label: 'Mark Interested', icon: Star, onClick: () => showModal({ title: `Mark Interested: ${leadData.full_name}`, content: <MarkInterestedForm leadData={leadData} />, type: 'custom', size: 'md' }) },
    { action: 'update_profile', label: 'Edit Profile', icon: UserRound, onClick: () => setActiveTab('profile'), variant: 'subtle' },
    { action: 'send_document_email', label: 'Send Document Email', icon: Send, onClick: handleSendDocumentEmail },
    { action: 'review_documents', label: 'Review Documents', icon: FolderOpen, onClick: () => setActiveTab('documents'), variant: 'subtle' },
    { action: 'approve_profile', label: 'Approve Profile', icon: BadgeCheck, onClick: handleApproveProfile },
    { action: 'schedule_interview', label: 'Schedule Interview', icon: UserPlus, onClick: () => showModal({ title: `Schedule Interview: ${leadData.full_name}`, content: <InterviewForm leadData={leadData} />, type: 'custom', size: 'lg' }) },
    { action: 'reschedule_interview', label: 'Reschedule Interview', icon: RefreshCw, onClick: () => showModal({ title: `Reschedule Interview: ${leadData.full_name}`, content: <InterviewForm leadData={leadData} />, type: 'custom', size: 'lg' }) },
    { action: 'complete_interview', label: 'Complete Interview', icon: CheckCircle2, onClick: () => handleInterviewStatus('COMPLETED') },
    { action: 'cancel_interview', label: 'Cancel Interview', icon: XCircle, onClick: () => handleInterviewStatus('CANCELLED'), variant: 'danger' },
    { action: 'interview_result', label: 'Interview Result', icon: BadgeCheck, onClick: () => interview?.id ? showModal({ title: `Interview Result: ${leadData.full_name}`, content: <InterviewResultForm interviewData={{ ...interview, lead: leadData }} leadUid={uid} />, type: 'custom', size: 'md' }) : toast.error('No interview found') },
    { action: 'initiate_payment', label: 'Collect Online Payment', icon: CreditCard, onClick: handleInitiatePayment },
    { action: 'record_offline_payment', label: 'Record Offline Payment', icon: CreditCard, onClick: () => showModal({ title: `Offline Payment: ${leadData.full_name}`, content: <OfflinePaymentForm leadData={leadData} />, type: 'custom', size: 'md' }) },
    { action: 'verify_offline_payment', label: 'Verify Offline Payment', icon: BadgeCheck, onClick: handleVerifyOfflinePayment },
    { action: 'generate_letters', label: 'Generate Letters', icon: Mail, onClick: handleGenerateLetters },
    { action: 'view_letters', label: 'View Letters', icon: Mail, onClick: () => setActiveTab('letters'), variant: 'subtle' },
  ];

  const visibleButtons = actionButtons.filter((b) => actions.includes(b.action));

  const actionButtonClass = (variant?: 'primary' | 'subtle' | 'danger') => {
    if (variant === 'subtle')
      return 'border border-crmBorder bg-major hover:bg-major-tint text-crmText-secondary hover:text-minor-contrast';
    if (variant === 'danger')
      return 'border border-crmDanger-border bg-crmDanger-bg text-crmDanger hover:opacity-85';
    return 'bg-minor hover:bg-minor-hover text-white border-none shadow-sm';
  };

  const detailFields = [
    { label: 'First Name', value: leadData.first_name },
    { label: 'Last Name', value: leadData.last_name },
    { label: 'Application ID', value: leadData.application_id || leadData.application?.application_id },
    { label: 'Registered Email', value: leadData.email },
    { label: 'Registered Phone', value: leadData.phone },
    { label: 'City', value: leadData.city },
    { label: 'Program', value: leadData.program || leadData.application?.initial_program },
    { label: 'Source', value: leadData.source },
    { label: 'UTM Source', value: leadData.utm_source },
    { label: 'UTM Campaign', value: leadData.utm_campaign },
    { label: 'Lead Stage', value: leadData.stage?.name },
    { label: 'Assigned To', value: leadData.assigned_to?.name || leadData.assigned_to?.email || 'Unassigned' },
    { label: 'Next Follow-up', value: leadData.next_follow_up_at ? formatDate(leadData.next_follow_up_at) : '-' },
    { label: 'Lost Reason', value: leadData.lost_reason ? `${leadData.lost_reason}${leadData.lost_reason_detail ? ` — ${leadData.lost_reason_detail}` : ''}` : '-' },
    { label: 'Registration Date', value: formatDate(leadData.created_at) },
    { label: 'Last Updated', value: formatDate(leadData.updated_at) },
  ];

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-minor-soft border border-minor-subtle">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-minor text-white text-xl font-bold shadow-sm">
          {(leadData.full_name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-crmText truncate">{leadData.full_name || '-'}</h3>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-major-tint text-crmText-secondary border-crmBorder">
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: leadData.stage?.color || '#2563eb' }}
              />
              {leadData.stage?.name || '-'}
            </span>
            {(leadData.application_id || leadData.application?.application_id) && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border bg-major-tint text-crmText-secondary border-crmBorder">
                {leadData.application_id || leadData.application?.application_id}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs font-mono text-crmText-tertiary">{leadData.uid || '-'}</div>
          <p className="mt-2 text-xs leading-relaxed text-crmText-secondary">
            {leadData.phone || '-'} · {leadData.city || '-'} ·{' '}
            {leadData.assigned_to?.name || 'Unassigned'}
          </p>
        </div>
      </div>

      {/* Workflow actions (from available_actions) */}
      {visibleButtons.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1.5">
            Next Steps
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleButtons.map(({ action, label, icon: Icon, onClick, variant }) => (
              <button
                key={action}
                type="button"
                onClick={onClick}
                disabled={actionLoading}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-60 ${actionButtonClass(variant)}`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-crmBorder bg-major p-1 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none px-2.5 py-2 text-[11px] font-bold transition-all whitespace-nowrap ${
              activeTab === key
                ? 'bg-minor text-white shadow-crm-sm'
                : 'bg-transparent text-crmText-secondary hover:bg-major-muted'
            }`}
          >
            <Icon size={13} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 mb-6">
          {detailFields.map(({ label, value }) => (
            <div key={label}>
              <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
                {label}
              </div>
              <div className="text-sm font-semibold text-crmText">{value || '-'}</div>
            </div>
          ))}
        </div>
      )}

      {/* Profile */}
      {activeTab === 'profile' && (
        <StudentProfileForm
          leadData={leadData}
          editable={actions.includes('update_profile')}
          canComplete={actions.includes('complete_profile')}
        />
      )}

      {/* Documents */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {documentsProblems && (
            (documentsProblems.rejected_documents?.length || 0) +
              (documentsProblems.pending_documents?.length || 0) +
              (documentsProblems.unreviewed_documents?.length || 0) >
              0 && (
              <div className="p-3 rounded-xl border border-crmDanger-border bg-crmDanger-bg text-xs text-crmDanger space-y-1">
                {(documentsProblems.pending_documents?.length || 0) > 0 && (
                  <div>
                    <span className="font-bold">Pending:</span>{' '}
                    {documentsProblems.pending_documents!.join(', ')}
                  </div>
                )}
                {(documentsProblems.unreviewed_documents?.length || 0) > 0 && (
                  <div>
                    <span className="font-bold">Awaiting review:</span>{' '}
                    {documentsProblems.unreviewed_documents!.join(', ')}
                  </div>
                )}
                {(documentsProblems.rejected_documents?.length || 0) > 0 && (
                  <div>
                    <span className="font-bold">Rejected:</span>{' '}
                    {documentsProblems.rejected_documents!.join(', ')}
                  </div>
                )}
              </div>
            )
          )}
          <div className="border border-crmBorder rounded-xl bg-major divide-y divide-crmBorder">
            {documentsLoading && documents.length === 0 ? (
              <div className="flex h-32 items-center justify-center">
                <span className="inline-block h-6 w-6 rounded-full border-[3px] border-minor/30 border-t-minor animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="p-6 text-center text-crmText-tertiary text-xs italic">
                No document checklist available for this lead yet.
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.document_type} className="px-3.5 py-2.5 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-crmText">{doc.label || doc.document_type}</span>
                      {doc.required && (
                        <span className="text-[9px] font-bold text-crmDanger uppercase">Required</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-crmText-tertiary">
                      {doc.document?.uploaded_at ? `Uploaded ${formatDate(doc.document.uploaded_at)}` : 'Not uploaded'}
                      {doc.document?.rejection_reason ? ` · Rejected: ${doc.document.rejection_reason}` : ''}
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadgeClass(doc.status)}`}>
                    {doc.status || 'PENDING'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {doc.document?.id && (
                      <button
                        type="button"
                        onClick={() => handleDownloadDocument(doc)}
                        className="p-1.5 text-crmText-secondary hover:text-minor hover:bg-minor-soft rounded-lg transition-colors cursor-pointer"
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                    )}
                    {actions.includes('review_documents') && doc.document?.id && doc.status === 'SUBMITTED' && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            showModal({
                              title: `Review: ${doc.label || doc.document_type}`,
                              content: <DocumentReviewForm documentData={doc} leadUid={uid} initialStatus="APPROVED" />,
                              type: 'custom',
                              size: 'md',
                            })
                          }
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-crmSuccess-bg text-crmSuccess border border-crmSuccess-border cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            showModal({
                              title: `Review: ${doc.label || doc.document_type}`,
                              content: <DocumentReviewForm documentData={doc} leadUid={uid} initialStatus="REJECTED" />,
                              type: 'custom',
                              size: 'md',
                            })
                          }
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-crmDanger-bg text-crmDanger border border-crmDanger-border cursor-pointer"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          {actions.includes('approve_profile') && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleApproveProfile}
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-xl bg-minor hover:bg-minor-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm border-none"
              >
                Approve Profile
              </button>
            </div>
          )}
        </div>
      )}

      {/* Interview */}
      {activeTab === 'interview' && (
        <div className="space-y-4">
          {leadInterviewLoading && !interview ? (
            <div className="flex h-32 items-center justify-center">
              <span className="inline-block h-6 w-6 rounded-full border-[3px] border-minor/30 border-t-minor animate-spin" />
            </div>
          ) : !interview ? (
            <div className="p-6 text-center text-crmText-tertiary text-xs italic border border-crmBorder rounded-xl bg-major">
              No interview scheduled for this lead yet.
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-crmBorder bg-major space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadgeClass(interview.status)}`}>
                  {interview.status || '-'}
                </span>
                {interview.result && interview.result !== 'PENDING' && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadgeClass(interview.result)}`}>
                    {interview.result}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Date</div>
                  <div className="text-sm font-semibold text-crmText">{interview.scheduled_date ? moment(interview.scheduled_date).format('MMM DD, YYYY') : '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Time</div>
                  <div className="text-sm font-semibold text-crmText">{interview.start_time || '-'}{interview.end_time ? ` – ${interview.end_time}` : ''}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Mode</div>
                  <div className="text-sm font-semibold text-crmText">{(interview.mode || '-').replace('_', ' ')}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Interviewer</div>
                  <div className="text-sm font-semibold text-crmText">{interview.interviewer?.name || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Counsellor</div>
                  <div className="text-sm font-semibold text-crmText">{interview.counsellor?.name || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
                    {interview.mode === 'in_person' ? 'Location' : 'Meeting Link'}
                  </div>
                  <div className="text-sm font-semibold text-crmText break-all">
                    {interview.mode === 'in_person' ? interview.location || '-' : interview.meeting_link || '-'}
                  </div>
                </div>
              </div>
              {interview.status === 'SCHEDULED' && actions.includes('cancel_interview') && (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleInterviewStatus('NO_SHOW')}
                    disabled={actionLoading}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-crmDanger-bg text-crmDanger border border-crmDanger-border cursor-pointer disabled:opacity-60"
                  >
                    Mark No-show
                  </button>
                </div>
              )}
            </div>
          )}

          {(leadInterview?.history || []).length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-2">History</div>
              <div className="border border-crmBorder rounded-xl bg-major divide-y divide-crmBorder">
                {(leadInterview?.history || []).map((h) => (
                  <div key={h.id} className="px-3.5 py-2.5 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1 text-xs text-crmText-secondary">
                      {h.scheduled_date ? moment(h.scheduled_date).format('MMM DD, YYYY') : '-'} · {h.start_time || '-'} · {h.interviewer?.name || '-'}
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadgeClass(h.status)}`}>
                      {h.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment */}
      {activeTab === 'payment' && (
        <div className="space-y-4">
          {leadPaymentLoading && !leadPayment ? (
            <div className="flex h-32 items-center justify-center">
              <span className="inline-block h-6 w-6 rounded-full border-[3px] border-minor/30 border-t-minor animate-spin" />
            </div>
          ) : (
            <>
              <div className="p-4 rounded-xl border border-crmBorder bg-major flex flex-wrap items-center gap-6">
                <div>
                  <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Amount</div>
                  <div className="text-lg font-bold text-crmText">
                    {leadPayment?.currency || 'INR'} {leadPayment?.amount ?? '-'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Settled</div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${leadPayment?.settled ? statusBadgeClass('SUCCESS') : statusBadgeClass('PENDING')}`}>
                    {leadPayment?.settled ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div className="border border-crmBorder rounded-xl bg-major divide-y divide-crmBorder">
                {(leadPayment?.payments || []).length === 0 ? (
                  <div className="p-6 text-center text-crmText-tertiary text-xs italic">
                    No payments recorded for this lead yet.
                  </div>
                ) : (
                  (leadPayment?.payments || []).map((p) => (
                    <div key={p.uid} className="px-3.5 py-2.5 flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-crmText">
                          {p.currency || 'INR'} {p.amount} · {p.method}
                          {p.payment_mode ? ` (${String(p.payment_mode).toUpperCase()})` : ''}
                        </div>
                        <div className="mt-0.5 text-[10px] text-crmText-tertiary">
                          {p.transaction_id || p.gateway_order_id || '-'} · {formatDate(p.created_at)}
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadgeClass(p.status)}`}>
                        {p.status}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {p.proof_url && (
                          <button
                            type="button"
                            onClick={() => handleDownloadProof(p)}
                            className="p-1.5 text-crmText-secondary hover:text-minor hover:bg-minor-soft rounded-lg transition-colors cursor-pointer"
                            title="Download proof"
                          >
                            <Download size={14} />
                          </button>
                        )}
                        {actions.includes('verify_offline_payment') && p.status === 'OFFLINE_PENDING' && (
                          <button
                            type="button"
                            onClick={() =>
                              showModal({
                                title: 'Verify Offline Payment',
                                content: <PaymentVerifyForm paymentData={{ ...p, lead: leadData }} />,
                                type: 'custom',
                                size: 'md',
                              })
                            }
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-crmSuccess-bg text-crmSuccess border border-crmSuccess-border cursor-pointer"
                          >
                            Verify
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Letters */}
      {activeTab === 'letters' && (
        <div className="space-y-4">
          {lettersLoading && letters.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <span className="inline-block h-6 w-6 rounded-full border-[3px] border-minor/30 border-t-minor animate-spin" />
            </div>
          ) : letters.length === 0 ? (
            <div className="p-6 text-center text-crmText-tertiary text-xs italic border border-crmBorder rounded-xl bg-major">
              Letters are generated after a successful or verified payment.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {letters.map((letter) => (
                <div key={letter.uid} className="p-4 rounded-xl border border-crmBorder bg-major">
                  <div className="text-xs font-bold text-crmText">{letter.label || letter.letter_type}</div>
                  <div className="mt-1 text-[11px] font-mono text-crmText-tertiary">{letter.letter_number || '-'}</div>
                  <div className="mt-0.5 text-[10px] text-crmText-tertiary">
                    Generated {formatDate(letter.generated_at)}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadLetter(letter)}
                    className="mt-3 flex items-center gap-1.5 px-3.5 py-2 bg-minor hover:bg-minor-hover text-white rounded-xl text-xs font-bold transition-all cursor-pointer border-none"
                  >
                    <Download size={14} />
                    Download PDF
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      {activeTab === 'timeline' && (
        <div className="border border-crmBorder rounded-xl bg-major divide-y divide-crmBorder">
          {activitiesLoading && activities.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <span className="inline-block h-6 w-6 rounded-full border-[3px] border-minor/30 border-t-minor animate-spin" />
            </div>
          ) : activities.length === 0 ? (
            <div className="p-6 text-center text-crmText-tertiary text-xs italic">
              No activity recorded for this lead.
            </div>
          ) : (
            activities.map((activity, index) => (
              <div key={activity.id ?? index} className="px-3.5 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-crmText">
                    {activity.type_display || activity.type || activity.action || '-'}
                  </span>
                  <span className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
                    {formatDate(activity.created_at)}
                  </span>
                </div>
                {(activity.from_stage || activity.to_stage) && (
                  <div className="mt-0.5 text-[11px] text-crmText-tertiary">
                    {activity.from_stage || '—'} → {activity.to_stage || '—'}
                  </div>
                )}
                {activity.note && (
                  <p className="mt-0.5 text-[11px] text-crmText-secondary">{activity.note}</p>
                )}
                <div className="mt-0.5 text-[10px] text-crmText-tertiary">
                  {activity.actor?.name || 'System'}
                </div>
                {activity.changes && Object.keys(activity.changes).length > 0 && (
                  <details className="mt-1">
                    <summary className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider cursor-pointer">
                      Details
                    </summary>
                    <pre className="mt-1 p-2 rounded-lg bg-major-tint text-[10px] text-crmText-secondary overflow-x-auto">
                      {JSON.stringify(activity.changes, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* History (assignments + calls) */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div>
            <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-2">
              Assignment History
            </div>
            <div className="border border-crmBorder rounded-xl bg-major divide-y divide-crmBorder">
              {assignmentsLoading && assignments.length === 0 ? (
                <div className="flex h-20 items-center justify-center">
                  <span className="inline-block h-5 w-5 rounded-full border-[3px] border-minor/30 border-t-minor animate-spin" />
                </div>
              ) : assignments.length === 0 ? (
                <div className="p-4 text-center text-crmText-tertiary text-xs italic">No assignments yet.</div>
              ) : (
                assignments.map((a, index) => (
                  <div key={a.id ?? index} className="px-3.5 py-2.5 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-crmText">
                        {a.counsellor?.name || 'Unassigned'}
                      </div>
                      <div className="mt-0.5 text-[10px] text-crmText-tertiary">
                        By {a.assigned_by?.name || 'System'} · {formatDate(a.assigned_at)}
                        {a.note ? ` · ${a.note}` : ''}
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-major-tint text-crmText-secondary border-crmBorder">
                      {a.assignment_type || '-'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-2">
              Call History
            </div>
            <div className="border border-crmBorder rounded-xl bg-major divide-y divide-crmBorder">
              {callsLoading && calls.length === 0 ? (
                <div className="flex h-20 items-center justify-center">
                  <span className="inline-block h-5 w-5 rounded-full border-[3px] border-minor/30 border-t-minor animate-spin" />
                </div>
              ) : calls.length === 0 ? (
                <div className="p-4 text-center text-crmText-tertiary text-xs italic">No calls recorded yet.</div>
              ) : (
                calls.map((call, index) => (
                  <div key={call.id ?? index} className="px-3.5 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-crmText">
                        {call.outcome || 'Call'}
                        {call.reason ? ` · ${call.reason}${call.reason_detail ? ` (${call.reason_detail})` : ''}` : ''}
                      </span>
                      <span className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
                        {formatDate(call.called_at || call.created_at)}
                      </span>
                    </div>
                    {call.notes && <p className="mt-0.5 text-[11px] text-crmText-secondary">{call.notes}</p>}
                    <div className="mt-0.5 text-[10px] text-crmText-tertiary">{call.counsellor?.name || '-'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadView;
