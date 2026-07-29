import * as React from "react";
import { Input } from "@/components/ui/input";

function normalizeMoneyInput(input: string): string {
  const normalized = input.replace(/,/g, "").replace(/[^\d.]/g, "");
  const hasDot = normalized.includes(".");
  const [rawWhole, ...decimalParts] = normalized.split(".");
  const wholeDigits = rawWhole.replace(/\D/g, "");
  const whole = wholeDigits.replace(/^0+(?=\d)/, "");
  const decimal = decimalParts.join("").replace(/\D/g, "").slice(0, 2);

  if (hasDot) return `${whole || "0"}.${decimal}`;
  return whole;
}

function formatMoneyInput(value: string): string {
  if (!value) return "";
  const hasDot = value.includes(".");
  const [whole = "", decimal = ""] = value.split(".");
  const groupedWhole = (whole || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return hasDot ? `${groupedWhole}.${decimal}` : groupedWhole;
}

export function MoneyInput({
  value,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={formatMoneyInput(value)}
      onChange={(event) => onValueChange(normalizeMoneyInput(event.target.value))}
    />
  );
}
