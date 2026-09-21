import React, { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  disableOutsideClick?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title, disableOutsideClick = false }) => {
  if (!isOpen) return null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onModalClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = isOpen ? "hidden" : "";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const onModalClose = ()=>{
    document.body.style.overflow = '';
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center transition delay-150 duration-300 ease-in-out">
      {/* BACKDROP */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity delay-150 duration-300 ease-in-out"
        onClick={()=>{if (!disableOutsideClick) onModalClose();}}
      ></div>

      {/* MODAL */}
      <div className="relative z-50 max-h-[95vh] w-[90%] overflow-y-auto rounded-2xl border border-crmBorder bg-major p-6 shadow-crm-lg">
        {title && (
          <div className="mb-4 border-b border-crmBorder pb-3 font-outfit text-lg font-bold text-crmText">
            {title}
          </div>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
