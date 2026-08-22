import { forwardRef } from "react";

export const LegacyInput = forwardRef<HTMLInputElement, { label: string }>(function LegacyInput({ label }, ref) {
  return <input aria-label={label} ref={ref} />;
});
