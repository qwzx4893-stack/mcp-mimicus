#!/usr/bin/env node
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {loadConfig} from './config.js';
import {Mimicus,createMcpServer} from './server.js';
async function main(){const command=process.argv[2]??'serve',config=loadConfig();if(command==='model-fetch')config.semanticDownload=true;const app=new Mimicus(config);let server:ReturnType<typeof createMcpServer>|undefined,closing=false;const close=async()=>{if(closing)return;closing=true;await app.close();await server?.close();};
 if(command==='serve'){server=createMcpServer(app);server.server.onclose=()=>void close();process.once('SIGINT',()=>void close());process.once('SIGTERM',()=>void close());await server.connect(new StdioServerTransport());return;}
 try{if(command==='search')console.log(JSON.stringify(await app.federation.search({query:process.argv.slice(3).join(' ')}),null,2));else if(command==='sources')console.log(JSON.stringify(app.federation.listSources(),null,2));else if(command==='model-check'||command==='model-fetch'){if(!await app.federation.semantic.init())throw new Error(JSON.stringify(app.federation.semantic.status()));console.log(JSON.stringify({status:app.federation.semantic.status(),integrity:await app.federation.semantic.verifyModel()}));}else if(command==='help')console.log('mimicus [serve|search brief|sources|model-check|model-fetch|help]\nTemporary live federation and visual browsing; no website database, worker, sync, migration or backup commands.');else throw new Error('Unknown command; use mimicus help. Persistent database/index/worker commands were removed.');}finally{await close();}
}
main().catch(e=>{process.stderr.write(JSON.stringify({level:'error',message:e instanceof Error?e.message:'Operation failed'})+'\n');process.exitCode=1;});
