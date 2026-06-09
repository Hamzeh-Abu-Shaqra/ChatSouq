"use client";

/**
 * LocationBanner — slim 40px banner at the top of the chat page.
 *
 * Shown once per browser session when GPS permission hasn't been granted or
 * dismissed. Stores the decision in localStorage as 'chatsouq_gps_permission'.
 *
 * Privacy: never logs coordinates, never sends to third parties.
 */

import { useEffect, useState } from "react";
import { setGpsPermissionState, getGpsPermissionState, getGpsLocationContext } from "../../lib/signals/gpsLocation";

interface Props {
  /** Called when GPS resolves to a neighbourhood, so the assembler can update immediately */
  onLocationResolved?: (neighbourhood: string) => void;
}

export default function LocationBanner({ onLocationResolved }: Props) {
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    // Only show if the user hasn't made a decision yet
    const perm = getGpsPermissionState();
    if (!perm) setVisible(true);
  }, []);

  if (!visible) return null;

  async function handleAllow() {
    setRequesting(true);
    try {
      const loc = await getGpsLocationContext();
      if (loc?.neighborhood) {
        onLocationResolved?.(loc.neighborhood);
      }
    } finally {
      setRequesting(false);
      setVisible(false);
    }
  }

  function handleSkip() {
    setGpsPermissionState("dismissed");
    setVisible(false);
  }

  return (
    <div
      className="flex items-center justify-center gap-3 px-4 text-[12px]"
      style={{
        height: "40px",
        background: "#FBF4E3",
        borderBottom: "0.5px solid #E8D5A0",
        flexShrink: 0,
      }}
    >
      <span style={{ color: "#7A5C10" }}>
        📍 Allow location for neighbourhood-specific results?
      </span>
      <button
        onClick={handleAllow}
        disabled={requesting}
        className="px-3 py-1 rounded-md text-white text-[11px] font-medium transition disabled:opacity-50"
        style={{ background: "#C9A84C" }}
      >
        {requesting ? "…" : "Allow"}
      </button>
      <button
        onClick={handleSkip}
        className="px-2 py-1 rounded-md text-[11px] transition"
        style={{ color: "#9ca3af" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#1A1A1A"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af"; }}
      >
        Skip
      </button>
    </div>
  );
}
