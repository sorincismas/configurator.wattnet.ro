/* eslint-disable @next/next/no-img-element */
import type { FirmSettings } from "@/lib/model/types";

/** sigla: imaginea incarcata in biblioteca sau sigla text implicita */
export function Logo({ firm, size = 28, dark = false }: { firm?: FirmSettings; size?: number; dark?: boolean }) {
  if (firm?.logoDataUrl) return <img src={firm.logoDataUrl} alt={firm.name} style={{ height: size }} />;
  return (
    <svg height={size} viewBox="0 0 168 32" role="img" aria-label="WATTNET">
      <rect x="0" y="2" width="28" height="28" rx="5" fill="#f2c200" />
      <path d="M16.5 6 L8.5 18 H14 L11.5 26 L20 13.5 H14.5 Z" fill="#14181f" />
      <text x="36" y="23" fontFamily="ui-sans-serif, system-ui, Arial" fontSize="19" fontWeight="800" letterSpacing="1.5" fill={dark ? "#ffffff" : "#14181f"}>
        WATTNET
      </text>
    </svg>
  );
}
