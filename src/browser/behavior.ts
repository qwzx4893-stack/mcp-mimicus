import type { Sequence } from '../types.js';
/** Stable, deliberately quantized behavior facts. Raw frame timing stays in
 * immutable evidence; it is never an exact content-change detector. */
export function summarizeSequence(s:Sequence){
  const round=(n:number,step=1)=>Math.round(n/step)*step;
  const xs=s.samples.map(x=>x.box.x),ys=s.samples.map(x=>x.box.y+x.scrollY),op=s.samples.map(x=>x.opacity);
  return {trigger:s.trigger,settled:s.settled,
    displacementX:xs.length?round(Math.max(...xs)-Math.min(...xs)):0,
    displacementDocumentY:ys.length?round(Math.max(...ys)-Math.min(...ys)):0,
    opacityRange:op.length?[round(Math.min(...op),.01),round(Math.max(...op),.01)]:[],
    states:[...new Set(s.samples.filter(x=>x.state).map(x=>JSON.stringify(x.state)))].sort(),
    scrollPositions:s.trigger==='scroll'?s.samples.map(x=>({scrollY:round(x.scrollY),x:round(x.box.x),documentY:round(x.box.y+x.scrollY)})):undefined};
}
