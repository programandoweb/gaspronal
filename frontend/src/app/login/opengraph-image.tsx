import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Gaspronal Industrias y Servicios: acceso a la plataforma empresarial";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          overflow: "hidden",
          position: "relative",
          fontFamily: "Arial, sans-serif",
          color: "#ffffff",
          background: "linear-gradient(120deg, #041d33 0%, #064a78 57%, #0078b5 100%)",
        }}
      >
        <div style={{ position: "absolute", top: -160, right: -130, width: 640, height: 640, borderRadius: "50%", border: "85px solid rgba(40,188,223,.12)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: -260, left: 340, width: 900, height: 450, borderRadius: "50%", background: "rgba(2,140,190,.15)", display: "flex" }} />
        <div style={{ width: "100%", display: "flex", flexDirection: "column", padding: "58px 72px", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "#0abde3", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 19, fontSize: 36, fontWeight: 900 }}>G</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: 1 }}>GASPRONAL</div>
              <div style={{ fontSize: 15, letterSpacing: 3, color: "#a4e8f8" }}>INDUSTRIAS Y SERVICIOS S.A.S.</div>
            </div>
          </div>
          <div style={{ width: 92, height: 6, background: "#16c9e8", borderRadius: 8, marginTop: 65, display: "flex" }} />
          <div style={{ fontSize: 69, fontWeight: 800, lineHeight: 1.08, marginTop: 25, maxWidth: 1000 }}>Bienvenido a la plataforma empresarial</div>
          <div style={{ fontSize: 27, color: "#bdeaf6", marginTop: 30 }}>Fabricación industrial · Redes de gas · Servicio técnico</div>
          <div style={{ display: "flex", alignItems: "center", marginTop: "auto" }}>
            <div style={{ border: "2px solid rgba(255,255,255,.4)", borderRadius: 16, padding: "13px 22px", fontSize: 21, fontWeight: 700, background: "rgba(255,255,255,.08)" }}>Acceso seguro</div>
            <div style={{ marginLeft: "auto", fontSize: 20, color: "#c5edf7" }}>gaspronal.programandoweb.net</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
