import { Injectable } from "@nestjs/common";
import { BrowserBridgeService } from "../browser/browser-bridge.service";
import { AgentRegistryService } from "./agent-registry.service";
import { GeminiService } from "./gemini.service";
import { LaravelContentTraceClient } from "./laravel-content-trace.client";

@Injectable()
export class ContentCreatorService{
 constructor(private readonly browser:BrowserBridgeService,private readonly registry:AgentRegistryService,private readonly gemini:GeminiService,private readonly trace:LaravelContentTraceClient){}
 async execute(input:{topic:string;apiKey:string;textModel:string}):Promise<string>{
  const agent=this.registry.get("lucia");if(!agent)throw new Error("No se encontró la definición del agente Lucía.");
  const sourceUrls=[...new Set((agent.tools.match(/https?:\/\/[^\s)>`]+/g)||[]).map(url=>url.replace(/[.,;]+$/,"")))];
  if(!sourceUrls.length)throw new Error("Lucía no tiene URLs fuente configuradas en Tools.md.");
  if(!this.browser.hasCollector())throw new Error("La extensión Gaspronal Browser Collector no está conectada.");
  const created=await this.trace.createRun({agent:"lucia",topic:input.topic,source_urls:sourceUrls}),uuid=String(created?.data?.uuid||"");if(!uuid)throw new Error("Laravel no devolvió UUID de trazabilidad.");
  try{
   const collected:Array<Record<string,unknown>>=[];
   for(const url of sourceUrls){const result=await this.browser.scrape(url);const normalized={url,title:String(result.title||""),description:String(result.description||""),text:String(result.text||"").slice(0,120000),headings:Array.isArray(result.headings)?result.headings:[],links:Array.isArray(result.links)?result.links:[],images:Array.isArray(result.images)?result.images:[]};collected.push(normalized);await this.trace.addSource(uuid,normalized)}
   const corpus=collected.map(item=>`FUENTE: ${item.url}\nTÍTULO: ${item.title}\nDESCRIPCIÓN: ${item.description}\nCONTENIDO:\n${item.text}`).join("\n\n---\n\n").slice(0,300000);
   const plan=this.parseJson(await this.gemini.generate({apiKey:input.apiKey,model:input.textModel,system:"Eres estratega editorial industrial de Gaspronal. Trabaja solo con hechos sustentados por las fuentes. Devuelve JSON válido, sin markdown.",message:`Tema: ${input.topic}\nDevuelve exactamente {"angle":"...","working_title":"...","image_prompts":["...","...","...","...","..."]}. Los 5 prompts deben ser distintos, pertinentes, sin logos inventados ni texto incrustado.\nFUENTES:\n${corpus}`}));
   const prompts=Array.isArray(plan.image_prompts)?plan.image_prompts.map(String).filter(Boolean).slice(0,5):[];if(prompts.length!==5)throw new Error("Gemini no devolvió exactamente cinco prompts de imagen.");
   const imagePaths:string[]=[],imageModel=process.env.GEMINI_IMAGE_MODEL?.trim()||"gemini-3.1-flash-image";
   for(let index=0;index<5;index++){const image=await this.gemini.generateImage({apiKey:input.apiKey,model:imageModel,prompt:prompts[index]});const artifact=await this.trace.addArtifact(uuid,{type:"image",sequence:index+1,prompt:prompts[index],mime_type:image.mimeType,data_base64:image.data});imagePaths.push(String(artifact?.data?.path||""))}
   const copy=this.parseJson(await this.gemini.generate({apiKey:input.apiKey,model:input.textModel,system:"Eres redactor SEO senior de Gaspronal. No inventes datos. Devuelve JSON válido, sin markdown.",message:`Redacta un borrador basado únicamente en las fuentes y el plan ${JSON.stringify(plan)}. Devuelve {"title":"...","excerpt":"...","content":"...","seo_title":"...","seo_description":"..."}.\nFUENTES:\n${corpus}`}));
   const completed=await this.trace.complete(uuid,{...copy,plan,image_paths:imagePaths,source_urls:sourceUrls});
   return["Contenido generado y guardado como borrador.",`Trazabilidad: ${uuid}`,`Post: ${String(completed?.data?.post_id||"pendiente")}`,`Imágenes persistidas: ${imagePaths.length}/5.`].join("\n");
  }catch(error){await this.trace.fail(uuid,error instanceof Error?error.message:String(error));throw error}
 }
 private parseJson(raw:string):any{const clean=raw.trim().replace(/^\`\`\`(?:json)?/i,"").replace(/\`\`\`$/,"").trim();try{return JSON.parse(clean)}catch{const start=clean.indexOf("{"),end=clean.lastIndexOf("}");if(start>=0&&end>start)return JSON.parse(clean.slice(start,end+1));throw new Error("Gemini devolvió JSON inválido.")}}
}
