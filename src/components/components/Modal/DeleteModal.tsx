import { useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle } from "lucide-react";
import { useModal } from "../../../context/ModalContext";
import Button from "../../common/Button";

type DeleteConfirmationModalProps = {
  id: number | string;
  name: string;
  onDelete: (id: number | string) => Promise<void>;
};

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  id,
  name,
  onDelete,
}) => {
  const [loading, setLoading] = useState(false);
  const { hideModal } = useModal();

  const autoLabel = name?.split(" ")?.[0]?.toLowerCase() || "item";

  const handleDelete = async () => {
    try {
      setLoading(true);
      await onDelete(id);
      toast.success(`${autoLabel} deleted successfully!`);
      hideModal();
    } catch (error: any) {
      console.error("Delete failed:", error);
      const errorMessage =
        typeof error === "string"
          ? error
          : error?.message || `Failed to delete ${autoLabel}. Please try again.`;
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-crmDanger-border bg-crmDanger-bg text-crmDanger">
          <AlertTriangle size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="font-outfit text-lg font-semibold text-crmText">
            Delete Confirmation
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-crmText-secondary">
            Are you sure you want to delete{" "}
            <span className="font-bold text-crmText">{name}</span>? This action cannot be undone.
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={hideModal} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleDelete} loading={loading}>
          {loading ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
