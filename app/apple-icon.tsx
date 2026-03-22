import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#2b3245",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "36px",
          fontSize: 90,
          fontWeight: 800,
          letterSpacing: "-2px",
        }}
      >
        <span style={{ color: "white" }}>d</span>
        <span style={{ color: "#f5c842" }}>c</span>
      </div>
    ),
    { ...size }
  );
}
