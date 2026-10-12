import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Gaspronal | Contratos de venta y fabricación · Entrega en 30 días calendario";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display:"flex", width:"100%",height:"100%",background:"#1F252B",color:"#fff",fontFamily:"Arial, sans-serif",position:"relative",overflow:"hidden" }}>
      <div style={{display:"flex",position:"absolute",left:0,top:0,width:16,height:630,background:"#F37021"}} />
      <div style={{display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"60px 35px 50px 78px",width:720,height:"100%"}}>
        <div style={{display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",fontSize:23,fontWeight:700,color:"#F37021",letterSpacing:3}}>GASPRONAL · INFORMACIÓN CONTRACTUAL</div>
          <div style={{display:"flex",fontSize:63,fontWeight:800,lineHeight:1.06,marginTop:34,letterSpacing:-2}}>Contratos de venta y fabricación</div>
          <div style={{display:"flex",fontSize:28,lineHeight:1.4,color:"#d3dce5",marginTop:26}}>Condiciones de pago, entrega, recepción y garantías.</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:18}}>
          <div style={{display:"flex",background:"#005C99",padding:"14px 24px",borderRadius:14,fontSize:26,fontWeight:800}}>30 DÍAS CALENDARIO</div>
        </div>
      </div>
      <div style={{display:"flex",width:480,height:630,alignItems:"center",justifyContent:"center",background:"#005C99",position:"relative"}}>
        <div style={{display:"flex",position:"absolute",width:360,height:470,background:"#ffffff",borderRadius:18,transform:"rotate(-8deg)",top:88,left:60,boxShadow:"0 25px 45px rgba(0,0,0,.22)"}} />
        <div style={{display:"flex",position:"absolute",flexDirection:"column",width:350,height:462,background:"#f5f8fb",borderRadius:18,top:76,left:77,padding:"43px 36px",transform:"rotate(3deg)"}}>
          <div style={{display:"flex",fontSize:23,fontWeight:800,color:"#005C99"}}>ACUERDO COMERCIAL</div>
          <div style={{display:"flex",height:6,width:260,background:"#b5c8d7",borderRadius:8,marginTop:44}}/>
          <div style={{display:"flex",height:6,width:245,background:"#b5c8d7",borderRadius:8,marginTop:22}}/>
          <div style={{display:"flex",height:6,width:260,background:"#b5c8d7",borderRadius:8,marginTop:22}}/>
          <div style={{display:"flex",height:6,width:215,background:"#b5c8d7",borderRadius:8,marginTop:22}}/>
          <div style={{display:"flex",height:6,width:250,background:"#b5c8d7",borderRadius:8,marginTop:22}}/>
          <div style={{display:"flex",marginTop:57,justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",height:4,width:155,background:"#005C99"}}/>
            <div style={{display:"flex",height:72,width:72,border:"6px solid #F37021",borderRadius:50,alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:900,color:"#F37021"}}>✓</div>
          </div>
          <div style={{display:"flex",color:"#64748b",fontSize:17,marginTop:9}}>FIRMA Y ACEPTACIÓN</div>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
