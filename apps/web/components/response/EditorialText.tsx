"use client";

interface EditorialTextProps {
  intro: string;
  connector?: string;
  insight?: string;
  isArabic?: boolean;
  isStreaming?: boolean;
}

export function EditorialText({
  intro,
  connector,
  insight,
  isArabic = false,
  isStreaming = false,
}: EditorialTextProps) {
  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        fontFamily: isArabic
          ? "'Noto Serif Arabic', 'Noto Sans Arabic', serif"
          : "inherit",
      }}
    >
      {/* Intro paragraph with drop-cap */}
      <p
        className={`drop-cap${isStreaming ? " cursor-blink" : ""}`}
        style={{
          fontSize: "1rem",
          lineHeight: 1.75,
          color: "#2C2416",
          margin: 0,
          fontFamily: isArabic ? "'Noto Serif Arabic', serif" : "inherit",
        }}
      >
        {intro}
      </p>

      {/* Connector — italic bridge between top pick and alternatives */}
      {connector && (
        <p
          style={{
            fontSize: "0.9rem",
            lineHeight: 1.65,
            color: "#5C4A1E",
            margin: 0,
            paddingLeft: isArabic ? 0 : "16px",
            paddingRight: isArabic ? "16px" : 0,
            borderLeft: isArabic ? "none" : "3px solid #C9A84C",
            borderRight: isArabic ? "3px solid #C9A84C" : "none",
            fontStyle: "italic",
          }}
        >
          {connector}
        </p>
      )}

      {/* Insight callout */}
      {insight && (
        <div
          style={{
            background: "#FBF4E3",
            border: "1px solid #E8D5A0",
            borderRadius: "8px",
            padding: "12px 16px",
            display: "flex",
            gap: "10px",
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              fontSize: "16px",
              lineHeight: 1,
              marginTop: "2px",
              flexShrink: 0,
            }}
            aria-hidden
          >
            💡
          </span>
          <p
            style={{
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#7A5C10",
              margin: 0,
              fontStyle: "italic",
            }}
          >
            {insight}
          </p>
        </div>
      )}
    </div>
  );
}
