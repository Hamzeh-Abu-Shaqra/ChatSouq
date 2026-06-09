"use client";

import { useRouter } from "next/navigation";

interface Chip {
  label: string;
  query?: string;
  href?: string;
}

const DEFAULT_CHIPS: Chip[] = [
  { label: "Restaurants", query: "Best restaurants in Amman" },
  { label: "Gifts",       query: "Gift ideas in Amman" },
  { label: "Gyms",        query: "Best gym near me in Amman" },
  { label: "Salons",      query: "Top salons in Amman" },
  { label: "Cafes",       query: "Best coffee shops in Amman" },
  { label: "Activities",  query: "Things to do in Amman" },
  { label: "Clinics",     query: "Find a clinic or doctor in Amman" },
  { label: "Shopping",    query: "Shopping in Amman" },
];

interface CategoryChipsProps {
  chips?: Chip[];
  className?: string;
  onSelect?: (chip: Chip) => void;
}

export function CategoryChips({ chips = DEFAULT_CHIPS, className = "", onSelect }: CategoryChipsProps) {
  const router = useRouter();

  function handleChip(chip: Chip) {
    if (onSelect) {
      onSelect(chip);
      return;
    }
    if (chip.href) {
      router.push(chip.href);
    } else if (chip.query) {
      router.push(`/chat?q=${encodeURIComponent(chip.query)}`);
    }
  }

  return (
    <div className={`flex items-center gap-2 overflow-x-auto scrollbar-hide ${className}`}>
      {chips.map((chip) => (
        <button
          key={chip.label}
          onClick={() => handleChip(chip)}
          className="flex-shrink-0 text-[13px] text-[#1A1A1A] rounded-full px-[14px] py-1.5 transition-all duration-150 whitespace-nowrap"
          style={{
            border: "0.5px solid #E8E4DC",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "#FBF4E3";
            el.style.borderColor = "#E8D5A0";
            el.style.color = "#7A5C10";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "";
            el.style.borderColor = "#E8E4DC";
            el.style.color = "#1A1A1A";
          }}
          onMouseDown={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "";
          }}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
