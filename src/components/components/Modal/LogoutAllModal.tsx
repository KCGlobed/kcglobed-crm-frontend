import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { TriangleAlert } from "lucide-react";
import { useModal } from "../../../context/ModalContext";
import { useAppDispatch } from "../../../hooks/useAppDispatch";
import { logoutAllDevices } from "../../../store/slices/authSlice";
import Button from "../../common/Button";

const LogoutAllModal: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { hideModal } = useModal();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogoutAll = async () => {
    try {
      setLoading(true);
      await dispatch(logoutAllDevices()).unwrap();
      toast.success("Logged out from all devices");
      hideModal();
      navigate("/login", { replace: true });
    } catch (error: any) {
      const errorMessage =
        typeof error === "string"
          ? error
          : error?.message || "Failed to logout from all devices. Please try again.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-crmDanger-border bg-crmDanger-bg text-crmDanger">
          <TriangleAlert size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="font-outfit text-lg font-semibold text-crmText">
            Logout from all devices?
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-crmText-secondary">
            This will end every active session for your account, including this one. You will
            need to login again on each device.
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={hideModal} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleLogoutAll} loading={loading}>
          {loading ? "Logging out..." : "Logout Everywhere"}
        </Button>
      </div>
    </div>
  );
};

export default LogoutAllModal;
