"use client";

import { useEffect } from "react";

export function isArabic(text: string): boolean {
  return /[؀-ۿ]/.test(text);
}

/** Injects Noto Arabic fonts when Arabic content is detected — only once. */
export function useArabicFonts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const id = "noto-arabic-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Noto+Serif+Arabic:wght@400;500&family=Noto+Sans+Arabic:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, [enabled]);
}
