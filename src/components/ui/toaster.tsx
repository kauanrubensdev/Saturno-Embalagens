import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      toastOptions={{
        style: {
          background: 'var(--card)',
          color: 'var(--foreground)',
          border: "1px solid var(--border)",
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
