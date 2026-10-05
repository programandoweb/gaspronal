import { HttpAdapterHost } from "@nestjs/core";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

type PendingTask={resolve:(value:Record<string,unknown>)=>void;reject:(error:Error)=>void;timer:NodeJS.Timeout};

@Injectable()
export class BrowserBridgeService implements OnModuleInit,OnModuleDestroy{
 private readonly logger=new Logger(BrowserBridgeService.name);
 private readonly clients=new Set<WebSocket>();
 private readonly pending=new Map<string,PendingTask>();
 private wss?:WebSocketServer;
 private upgradeHandler?:(request:IncomingMessage,socket:any,head:Buffer)=>void;
 constructor(private readonly adapterHost:HttpAdapterHost){}
 onModuleInit():void{
  const path=process.env.BROWSER_SOCKET_PATH?.trim()||"/browser";
  const httpServer=this.adapterHost.httpAdapter.getHttpServer();
  this.wss=new WebSocketServer({noServer:true});
  this.upgradeHandler=(request,socket,head)=>{
   let pathname="";try{pathname=new URL(request.url||"/","http://localhost").pathname}catch{return}
   if(pathname!==path)return;
   this.wss?.handleUpgrade(request,socket,head,client=>this.attach(client));
  };
  httpServer.on("upgrade",this.upgradeHandler);
  this.logger.log(`Browser Agent WebSocket disponible en ${path} (sin autenticación temporal).`);
 }
 onModuleDestroy():void{
  const httpServer=this.adapterHost.httpAdapter.getHttpServer();
  if(this.upgradeHandler)httpServer.off("upgrade",this.upgradeHandler);
  this.wss?.close();
  for(const task of this.pending.values()){clearTimeout(task.timer);task.reject(new Error("Browser bridge detenido."))}
  this.pending.clear();
 }
 hasCollector():boolean{return [...this.clients].some(client=>client.readyState===WebSocket.OPEN)}
 async scrape(url:string):Promise<Record<string,unknown>>{
  const client=[...this.clients].find(item=>item.readyState===WebSocket.OPEN);
  if(!client)throw new Error("No hay una extensión Gaspronal Browser Collector conectada.");
  const taskId=randomUUID(),timeoutMs=Math.max(10000,Number(process.env.BROWSER_TASK_TIMEOUT_MS||90000));
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(taskId);reject(new Error(`Timeout recolectando ${url}`))},timeoutMs);
   this.pending.set(taskId,{resolve,reject,timer});
   client.send(JSON.stringify({event:"browser:task",data:{taskId,type:"SCRAPE_URL",url}}));
  });
 }
 private attach(client:WebSocket):void{
  this.clients.add(client);
  client.send(JSON.stringify({event:"browser:ready",data:{collector:"gaspronal"}}));
  client.on("message",raw=>{
   let envelope:any;try{envelope=JSON.parse(String(raw))}catch{return}
   if(envelope?.event==="browser:hello"){this.logger.log(`Recolector conectado: ${String(envelope?.data?.name||"Chrome")}`);return}
   if(envelope?.event!=="browser:result")return;
   const taskId=String(envelope?.data?.taskId||""),pending=this.pending.get(taskId);if(!pending)return;
   clearTimeout(pending.timer);this.pending.delete(taskId);
   envelope?.data?.status==="success"?pending.resolve((envelope.data.result||{}) as Record<string,unknown>):pending.reject(new Error(String(envelope?.data?.error||"El recolector devolvió un error.")));
  });
  client.on("close",()=>this.clients.delete(client));
  client.on("error",error=>this.logger.warn(`Browser collector: ${error.message}`));
 }
}
