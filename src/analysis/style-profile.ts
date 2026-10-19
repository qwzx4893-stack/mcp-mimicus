/** Adapted from Design DNA src/capture/styles.ts at
 * a3bd0e057b52a3f16594073c876ead0cc554c553, MIT, Copyright 2026 olartgabo.
 * Palette counts, recurrent-spacing merging and font-family hierarchy are used
 * on the bounded observed element set; no paid extractor or font files used. */
import type { ElementRecord } from '../types.js';
export function cssColorToHex(color:string){
  const m=color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)/);
  if(!m)return /^#[0-9a-fA-F]{6}$/.test(color)?color.toLowerCase():null;
  if(m[4]!==undefined&&(m[4].endsWith('%')?parseFloat(m[4])/100:parseFloat(m[4]))<.1)return null;
  const hex=(v:string)=>Math.min(255,parseInt(v,10)).toString(16).padStart(2,'0');return '#'+hex(m[1]!)+hex(m[2]!)+hex(m[3]!);
}
export function styleProfile(elements:ElementRecord[]){
  const colors=new Map<string,number>(),spacing=new Map<number,number>(),families=new Map<string,Map<string,{size:number;weight:number;count:number}>>();
  for(const e of elements){
    for(const key of ['color','background-color']){const hex=cssColorToHex(e.styles[key]??'');if(hex)colors.set(hex,(colors.get(hex)??0)+1);}
    for(const key of ['padding','margin','gap'])for(const token of (e.styles[key]??'').split(/\s+/)){const value=parseFloat(token);if(Number.isFinite(value)&&value>=2&&value<=256)spacing.set(value,(spacing.get(value)??0)+1);}
    const family=(e.styles['font-family']??'').split(',')[0]!.trim().replace(/^["']|["']$/g,''),size=parseFloat(e.styles['font-size']??''),weight=parseFloat(e.styles['font-weight']??'');
    if(family&&Number.isFinite(size)&&Number.isFinite(weight)){let usages=families.get(family);if(!usages)families.set(family,usages=new Map());const key=`${size}:${weight}`,old=usages.get(key);if(old)old.count++;else usages.set(key,{size,weight,count:1});}
  }
  const kept:{value:number;count:number}[]=[];for(const [value,count]of [...spacing].filter(([,n])=>n>=3).sort((a,b)=>b[1]-a[1])){const near=kept.find(k=>Math.abs(k.value-value)<=1);if(near)near.count+=count;else kept.push({value,count});}
  return {palette:[...colors].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([hex,count])=>({hex,count})),spacingScale:kept.sort((a,b)=>b.count-a.count).slice(0,10).map(k=>k.value).sort((a,b)=>a-b),
    fonts:[...families].map(([family,usages])=>({family,total:[...usages.values()].reduce((n,u)=>n+u.count,0),usages:[...usages.values()].sort((a,b)=>b.size-a.size||b.weight-a.weight).slice(0,8)})).sort((a,b)=>b.total-a.total).slice(0,6),
    evidence:'Measured computed styles on selected elements; frequency and spacing scale are bounded-sample derived relationships, not recovered author design tokens.'};
}
