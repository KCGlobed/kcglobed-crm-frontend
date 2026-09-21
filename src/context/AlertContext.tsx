import React, { createContext, useContext, useState, type ReactNode } from "react";

type AlertType = "success" | "error" | "warning" | "info";

interface Alert {
  id: number;
  message: string;
  type: AlertType;
}

interface ConfirmOptions {
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface AlertContextProps {
  alerts: Alert[];
  showAlert: (message: string, type?: AlertType) => void;
  showConfirm: (options: ConfirmOptions) => void;
  removeAlert: (id: number) => void;
}

const AlertContext = createContext<AlertContextProps | undefined>(undefined);

const alertStyles: Record<AlertType, string> = {
  success: "bg-green-600 text-white",
  error: "bg-red-600 text-white",
  warning: "bg-yellow-500 text-black",
  info: "bg-blue-600 text-white",
};

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);

  const showAlert = (message: string, type: AlertType = "info") => {
    const id = Date.now();
    setAlerts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeAlert(id), 2000);
  };

  const showConfirm = (options: ConfirmOptions) => {
    setConfirm(options);
  };

  const removeAlert = (id: number) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  const handleConfirm = () => {
    confirm?.onConfirm();
    setConfirm(null);
  };

  const handleCancel = () => {
    confirm?.onCancel?.();
    setConfirm(null);
  };

  return (
    <AlertContext.Provider value={{ alerts, showAlert, showConfirm, removeAlert }}>
      {children}

      {/* Toast Alerts */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 flex flex-col gap-3 pointer-events-none">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`pointer-events-auto w-full rounded-lg px-4 py-3 shadow-lg animate-fadeSlideIn flex items-center justify-between text-sm font-medium ${alertStyles[alert.type]}`}
          >
            <span>{alert.message}</span>
            <button
              onClick={() => removeAlert(alert.id)}
              className="ml-4 text-xs underline cursor-pointer hover:opacity-80"
            >
              Close
            </button>
          </div>
        ))}
      </div>

      {/* Confirm Dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl animate-scaleUp">
            <p className="mb-5 text-gray-800 text-sm leading-relaxed">{confirm.message}</p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={handleCancel}
                className="rounded-lg bg-gray-100 hover:bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) throw new Error("useAlert must be used within AlertProvider");
  return context;
};
