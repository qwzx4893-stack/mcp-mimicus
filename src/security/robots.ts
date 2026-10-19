/** Preserved bounded user-agent/longest-match parser from the verified browser. */
export function robotsAllowed(text:string,path:string){
 const groups:{agents:string[];rules:{allow:boolean;path:string}[]}[]=[];let group:typeof groups[number]|undefined;
 for(const raw of text.split(/\r?\n/)){const m=raw.split('#')[0]!.trim().match(/^([\w-]+)\s*:\s*(.*)$/);if(!m)continue;const key=m[1]!.toLowerCase(),value=m[2]!.trim();if(key==='user-agent'){if(!group||group.rules.length){group={agents:[],rules:[]};groups.push(group);}group.agents.push(value.toLowerCase());}if(group&&(key==='allow'||key==='disallow')&&value)group.rules.push({allow:key==='allow',path:value});}
 const specific=groups.filter(g=>g.agents.some(a=>a.includes('mimicus'))),active=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
 const matches=active.flatMap(g=>g.rules).filter(r=>{const p=r.path.replace(/[.+?^{}()|[\]\\]/g,'\\$&').replaceAll('*','.*');try{return new RegExp('^'+p).test(path);}catch{return true;}}).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));return matches[0]?.allow??true;
}
