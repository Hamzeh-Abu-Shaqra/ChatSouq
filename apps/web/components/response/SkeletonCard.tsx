"use client";

import type { CSSProperties } from "react";

const SHIMMER_STYLE: CSSProperties = {
  background: "linear-gradient(90deg, #f0ece4 25%, #e8e0d0 50%, #f0ece4 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s infinite",
  borderRadius: "4px",
};

const GOLD_SHIMMER_STYLE: CSSProperties = {
  height: "4px",
  background: "linear-gradient(90deg, #e8d5a0 25%, #C9A84C 50%, #e8d5a0 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s infinite",
  borderRadius: 0,
};

function S({ w, h, mb, br }: { w?: string; h: string; mb?: string; br?: string }) {
  return (
    <div
      style={{
        ...SHIMMER_STYLE,
        width: w ?? "100%",
        height: h,
        marginBottom: mb,
        borderRadius: br ?? "4px",
      }}
    />
  );
}

export function FeaturedCardSkeleton() {
  return (
    <div
      style={{
        border: "1px solid #E8D5A0",
        borderRadius: "12px",
        overflow: "hidden",
        background: "#FAFAF8",
      }}
    >
      <div style={GOLD_SHIMMER_STYLE} />

      <div style={{ padding: "24px" }}>
        <S h="28px" w="60%" mb="12px" />

        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <S h="20px" w="80px" br="10px" />
          <S h="20px" w="60px" br="10px" />
        </div>

        <S h="14px" mb="8px" />
        <S h="14px" w="80%" mb="16px" />

        <div style={{ display: "flex", gap: "6px" }}>
          {[90, 70, 110].map((w, i) => (
            <S key={i} h="22px" w={`${w}px`} br="11px" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ResultCardSkeleton() {
  return (
    <div
      style={{
        border: "1px solid #E8D5A0",
        borderRadius: "10px",
        padding: "16px",
        background: "#FAFAF8",
      }}
    >
      <S h="20px" w="70%" mb="10px" />
      <S h="13px" mb="6px" />
      <S h="13px" w="60%" mb="14px" />
      <div style={{ display: "flex", gap: "6px" }}>
        <S h="20px" w="80px" br="10px" />
        <S h="20px" w="100px" br="10px" />
      </div>
    </div>
  );
}

export function ResponseSkeleton() {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[100, 90, 75, 60].map((w, i) => (
            <S key={i} h="16px" w={`${w}%`} />
          ))}
        </div>

        <FeaturedCardSkeleton />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
          <ResultCardSkeleton />
          <ResultCardSkeleton />
          <ResultCardSkeleton />
        </div>
      </div>
    </>
  );
}
