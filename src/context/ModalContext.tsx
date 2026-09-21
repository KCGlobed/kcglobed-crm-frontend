// src/context/ModalContext.tsx
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react"; 

type ModalType = "default" | "success" | "error" | "custom";
type ModalSize = "sm" | "md" | "lg" |"xl"|"xxl";

interface ModalData {
  title?: string;
  content: ReactNode;
  type?: ModalType;
  size?: ModalSize;
}

interface ModalContextType {
  showModal: (data: ModalData) => void;
  hideModal: () => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) throw new Error("useModal must be used within ModalProvider");
  return context;
};

const getSizeClass = (size: ModalSize = "md"): string => {
  switch (size) {
    case "sm":
      return "max-w-sm";
    case "md":
      return "max-w-md";
    case "lg":
      return "max-w-3xl";
    case "xl":
      return "max-w-5xl";
    case "xxl":
      return "max-w-7xl";
    default:
      return "max-w-md";
  }
};

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [modalData, setModalData] = useState<ModalData | null>(null);

  const showModal = (data: ModalData) => setModalData(data);
  const hideModal = () => setModalData(null);

  return (
    <ModalContext.Provider value={{ showModal, hideModal }}>
      {children}
      {modalData && (
        <div
          className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
          onClick={hideModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`animate-scaleUp relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-crmBorder bg-major p-6 shadow-crm-lg ${getSizeClass(
              modalData.size
            )}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={hideModal}
              className="absolute right-3 top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-lg leading-none text-crmText-tertiary transition-colors hover:bg-major-muted hover:text-crmText"
              aria-label="Close modal"
            >
              ✕
            </button>
            {modalData.title && (
              <h2 className="mb-5 pr-10 font-outfit text-lg font-semibold text-crmText">
                {modalData.title}
              </h2>
            )}
            <div>{modalData.content}</div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};

