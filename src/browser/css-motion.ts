/** CSS declaration mapping adapted from PicassoWeb extract-animations/extractor.ts
 * 9134aa76b79e47ea66ea7bdf913f6c769e6b138b, MIT. The upstream per-effect list
 * mapping is retained; balanced comma parsing fixes cubic-bezier()/steps() lists.
 * Executed in the page; no remote source CSS or assets are retained. */
export function captureCssMotion({selectors}:{selectors:string[]}){
  const split=(value:string)=>{const result:string[]=[];let depth=0,start=0;for(let i=0;i<value.length;i++){if(value[i]==='(')depth++;if(value[i]===')')depth--;if(value[i]===','&&depth===0){result.push(value.slice(start,i).trim());start=i+1;}}result.push(value.slice(start).trim());return result;};
  const at=(values:string[],index:number)=>values[index%Math.max(1,values.length)]??'';
  const ms=(value:string)=>{const n=parseFloat(value);return Number.isFinite(n)?n*(value.endsWith('ms')?1:1000):null;};
  return selectors.slice(0,200).flatMap(selector=>{
    const element=document.querySelector(selector);if(!element)return [];const style=getComputedStyle(element);
    const names=split(style.animationName),durations=split(style.animationDuration),delays=split(style.animationDelay),easings=split(style.animationTimingFunction),iterations=split(style.animationIterationCount),directions=split(style.animationDirection),fills=split(style.animationFillMode),timelines=split(style.getPropertyValue('animation-timeline')),rangeStarts=split(style.getPropertyValue('animation-range-start')),rangeEnds=split(style.getPropertyValue('animation-range-end'));
    const animations=names.filter(n=>n&&n!=='none').map((name,index)=>({name,durationMs:ms(at(durations,index)),delayMs:ms(at(delays,index)),easing:at(easings,index),iterations:at(iterations,index),direction:at(directions,index),fill:at(fills,index),timeline:at(timelines,index),rangeStart:at(rangeStarts,index),rangeEnd:at(rangeEnds,index)}));
    const props=split(style.transitionProperty),td=split(style.transitionDuration),tl=split(style.transitionDelay),te=split(style.transitionTimingFunction);
    const transitions=props.map((property,index)=>({property,durationMs:ms(at(td,index)),delayMs:ms(at(tl,index)),easing:at(te,index)})).filter(t=>(t.durationMs??0)>0);
    let svg:{pathLength:number|null;viewBox:string|null;mask:string;clipPath:string;strokeDasharray:string;strokeDashoffset:string}|undefined;
    if(element instanceof SVGElement){let length:number|null=null;try{if(element instanceof SVGGeometryElement){const n=element.getTotalLength();length=Number.isFinite(n)?n:null;}}catch{}
      svg={pathLength:length,viewBox:element.getAttribute('viewBox'),mask:style.getPropertyValue('mask-image').slice(0,300),clipPath:style.clipPath.slice(0,300),strokeDasharray:style.strokeDasharray,strokeDashoffset:style.strokeDashoffset};}
    return animations.length||transitions.length||svg?[{selector,animations,transitions,svg,evidence:'computed-declarations' as const}]:[];
  });
}
export type CssMotion=ReturnType<typeof captureCssMotion>;
/** Animation phase is evidence, not a change to the underlying declaration. */
export function stableCssMotion(motion:CssMotion|undefined){return motion?.map(m=>({...m,svg:m.svg?{...m.svg,strokeDashoffset:undefined,clipPath:undefined}:undefined}));}
