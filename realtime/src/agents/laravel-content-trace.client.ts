import { Injectable } from "@nestjs/common";
@Injectable()
export class LaravelContentTraceClient{
 private base():string{return(process.env.LARAVEL_API_URL??"http://backend-nginx/api/v1").replace(/\/$/,"")}
 private async request(path:string,init:RequestInit):Promise<any>{const response=await fetch(this.base()+path,{...init,headers:{"Content-Type":"application/json",...(init.headers||{})}});const json=await response.json().catch(()=>({}));if(!response.ok)throw new Error(json?.message||`Laravel respondió HTTP ${response.status}.`);return json}
 createRun(payload:Record<string,unknown>){return this.request("/internal/content-creator/runs",{method:"POST",body:JSON.stringify(payload)})}
 addSource(uuid:string,payload:Record<string,unknown>){return this.request(`/internal/content-creator/runs/${uuid}/sources`,{method:"POST",body:JSON.stringify(payload)})}
 addArtifact(uuid:string,payload:Record<string,unknown>){return this.request(`/internal/content-creator/runs/${uuid}/artifacts`,{method:"POST",body:JSON.stringify(payload)})}
 complete(uuid:string,payload:Record<string,unknown>){return this.request(`/internal/content-creator/runs/${uuid}/complete`,{method:"POST",body:JSON.stringify(payload)})}
 async fail(uuid:string,error:string):Promise<void>{await this.request(`/internal/content-creator/runs/${uuid}/fail`,{method:"POST",body:JSON.stringify({error:error.slice(0,10000)})}).catch(()=>undefined)}
}
