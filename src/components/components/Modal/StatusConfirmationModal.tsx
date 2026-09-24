import React, { useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, Info } from "lucide-react";
import { useModal } from "../../../context/ModalContext";
import Button from "../../common/Button";

type StatusConfirmationModalProps = {
  name: string;
  isActive: boolean;
  onConfirm: () => Promise<void>;
};

const StatusConfirmationModal: React.FC<StatusConfirmationModalProps> = ({
  name,
  isActive,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);
  const { hideModal } = useModal();

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
      // Toast success is handled by the caller or we can do it here. 
      // The caller handles it, so we just await onConfirm and close.
      hideModal();
    } catch (error: any) {
      console.error("Status update failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-start gap-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
            isActive
              ? "border-crmDanger-border bg-crmDanger-bg text-crmDanger"
              : "border-crmSuccess-border bg-crmSuccess-bg text-crmSuccess"
          }`}
        >
          {isActive ? <AlertTriangle size={20} /> : <Info size={20} />}
        </span>
        <div className="min-w-0">
          <h2 className="font-outfit text-lg font-semibold text-crmText">
            {isActive ? "Deactivate User" : "Activate User"}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-crmText-secondary">
            Are you sure you want to {isActive ? "deactivate" : "activate"}{" "}
            <span className="font-bold text-crmText">{name}</span>?
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={hideModal} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant={isActive ? "danger" : "primary"}
          onClick={handleConfirm}
          loading={loading}
        >
          {loading ? "Processing..." : isActive ? "Deactivate" : "Activate"}
        </Button>
      </div>
    </div>
  );
};

export default StatusConfirmationModal;
