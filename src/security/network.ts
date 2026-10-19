import { lookup as dnsLookup } from 'node:dns/promises';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { connect, isIP, type Socket } from 'node:net';
import ipaddr from 'ipaddr.js';
import type { Config } from '../config.js';

export type Resolver = (host: string) => Promise<{ address: string; family: number }[]>;
export class NetworkPolicy {
  constructor(readonly config: Config, private resolver: Resolver = h => dnsLookup(h,{all:true,verbatim:true})) {}
  isDevelopment(u: URL) { return this.config.developmentOrigins.some(o=>new URL(o).origin===u.origin); }
  async target(raw: string) {
    const u=new URL(raw);
    if (!['http:','https:'].includes(u.protocol)||u.username||u.password) throw new Error('Unsafe URL scheme or credentials');
    if (u.href.length>2048) throw new Error('URL too long');
    const dev=this.isDevelopment(u);
    const approved=dev||this.config.allowedOrigins.some(o=>new URL(o).origin===u.origin);
    if (!approved) throw new Error('Origin is not operator-approved; configure MIMICUS_ALLOWED_ORIGINS');
    const host=u.hostname.replace(/^\[|\]$/g,'');
    if (!dev && (host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||(!host.includes('.')&&!isIP(host)))) throw new Error('Unsafe local hostname');
    let timer:ReturnType<typeof setTimeout>|undefined;
    const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await Promise.race([
      this.resolver(host),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('DNS resolution timed out')),Math.min(5000,this.config.timeoutMs));})
    ]).finally(()=>{if(timer)clearTimeout(timer);});
    if (!addresses.length) throw new Error('DNS produced no addresses');
    for(const a of addresses) {
      if (!ipaddr.isValid(a.address)) throw new Error('Invalid resolved address');
      const addr=ipaddr.process(a.address);const range=addr.range();
      if (dev) { if (range!=='loopback') throw new Error('Development origins must resolve exclusively to loopback'); }
      else if (range!=='unicast') throw new Error('Unsafe private, reserved, metadata or non-public address');
    }
    return {url:u,address:addresses[0]!.address,family:addresses[0]!.family};
  }
}

/** A connection's destination is validated once and pinned to a numeric IP.
 * DNS cannot change the connected destination between validation and use. */
export class GuardedProxy {
  private server?: Server; private sockets=new Set<Socket>(); private bytes=0;
  constructor(private policy:NetworkPolicy) {}
  async start() {
    const sockets=this.sockets;
    const track=(s:Socket)=>{if(sockets.size>=64){s.destroy();return;}sockets.add(s);s.on('error',()=>{});s.on('close',()=>sockets.delete(s));s.setTimeout(this.policy.config.timeoutMs,()=>s.destroy());};
    const budget=(chunk:Buffer)=>{this.bytes+=chunk.length;if(this.bytes>this.policy.config.maxBytes) for(const s of sockets)s.destroy();};
    const server=createServer(async(req,res)=>{
      try {
        if(!['GET','HEAD'].includes(req.method??'')) throw new Error('Read-only requests only');
        const target=await this.policy.target(req.url??'');
        if(target.url.protocol!=='http:')throw new Error('HTTPS requires a validated CONNECT tunnel');
        const headers:Record<string,string|string[]|undefined>={...req.headers,host:target.url.host}; delete headers['proxy-authorization'];delete headers['proxy-connection'];delete headers['cookie'];delete headers['authorization'];
        const upstream=httpRequest({hostname:target.address,family:target.family,port:target.url.port||80,path:target.url.pathname+target.url.search,method:req.method,headers},r=>{
          res.writeHead(r.statusCode??502,r.headers);r.on('data',budget);r.pipe(res);
        });
        upstream.setTimeout(this.policy.config.timeoutMs,()=>upstream.destroy());
        upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});
        req.on('aborted',()=>upstream.destroy());upstream.end();
      } catch {res.writeHead(403);res.end('Destination rejected by Mimicus network policy');}
    });
    server.on('connection',track);
    server.on('connect',async(req,client,head)=>{
      try {
        const target=await this.policy.target('https://'+req.url+'/');
        const upstream=connect({host:target.address,port:Number(target.url.port||443),family:target.family});track(upstream);
        client.on('error',()=>upstream.destroy());client.on('close',()=>upstream.destroy());
        upstream.on('error',()=>client.destroy());upstream.on('close',()=>client.destroy());
        upstream.once('connect',()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);client.pipe(upstream);upstream.on('data',budget);upstream.pipe(client);});
      } catch { client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); }
    });
    await new Promise<void>((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});this.server=server;
    return `http://127.0.0.1:${(server.address() as {port:number}).port}`;
  }
  async close() {for(const s of this.sockets)s.destroy();if(this.server)await new Promise<void>(ok=>this.server!.close(()=>ok()));}
}
