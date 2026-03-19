"use client";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ConfirmModal({ open, onClose }: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-white p-6 text-center border-8 [border-image:linear-gradient(to_right,#bf953f,#fcf6ba,#b38728)1]">
        <h2 className="text-2xl font-bold mb-4">¡Gracias!</h2>

        <p className="text-gray-700 mb-6">
          Tu confirmación fue enviada exitosamente.
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 bg-[#8a6d3b] text-white font-bold"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
