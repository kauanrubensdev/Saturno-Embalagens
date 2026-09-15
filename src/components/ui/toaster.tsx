import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      toastOptions={{
        style: {
          background: "#ffffff",
          color: "#1a1a1a",
          border: "1px solid #e5e5e5",
          borderRadius: "12px",
          fontFamily: "inherit",
          fontSize: "14px",
        },
        className: "[&_[data-icon]]:text-orange-500",
      }}
      closeButton
    />
  );
}
