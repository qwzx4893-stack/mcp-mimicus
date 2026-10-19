import { z } from 'zod';
import type { CssMotion } from './browser/css-motion.js';

export const Category = z.enum(['layout', 'typography', 'motion', 'interaction', 'scroll', 'canvas']);
export type Box = { x: number; y: number; width: number; height: number };
export type ElementRecord = {
  signals?:{transformed:boolean;interactive:boolean;scrollHint:boolean;componentRole:string;childCount:number};
  selector: string; tag: string; parent: string | null; box: Box;
  styles: Record<string, string>; variables: Record<string, string>;
  accessible: { role: string | null; focusable: boolean; labelPresent: boolean; headingLevel: number | null };
};
export type AnimationRecord = {
  selector: string; kind: string; name: string | null; playState: string;
  timing: { duration: number | string; delay: number; iterations: number | string; easing: string; fill: string; direction: string };
  keyframes: Record<string, string | number | null>[];
};
export type Sample = { t: number; scrollY: number; progress: number; box: Box; transform: string; opacity: number; visibility: string; clipPath: string; filter: string;strokeDashoffset?:string;containerScroll?:{selector:string;axis:'x'|'y';position:number;maximum:number};
  state?:{expanded:string|null;pressed:string|null;focused:boolean;controlled:{id:string;display:string;visible:boolean}[]} };
export type Sequence = { selector: string; trigger: 'time' | 'scroll' | 'hover' | 'focus' | 'click' | 'pointer' | 'drag' | 'touch'; samples: Sample[]; settled: boolean; limitation?: string; phases?:{name:string;startMs:number;endMs:number}[];frameIntervals?:number[];inputs?:{t:number;x:number;y:number}[] };
export type ViewportObservation = {
  cssMotion?:CssMotion;
  viewport: { width: number; height: number }; reducedMotion: boolean;
  elements: ElementRecord[]; animations: AnimationRecord[]; sequences: Sequence[];
  cssKeyframes: { name: string; frames: { key: string; css: string }[] }[];
  scrollTriggers: { selector: string | null; start: number; end: number; pin: boolean; scrub: number | boolean; progress: number }[];
  engines: string[]; canvas: { count: number; limitation: string; probes?:{readable:boolean;frames:unknown[];changed:boolean|null;limitation:string}[] };
  diagnostics: { blocked: number; errors: string[]; frameIntervals: number[]; inaccessibleStylesheets: number; truncated: boolean };
};
export const ComponentSchema = z.object({
  id: z.string(), sourceId: z.string(), title: z.string(), family: z.string(), category: Category,
  tags: z.array(z.string()), description: z.string(), selector: z.string(),
  evidenceIds: z.array(z.string()).min(1), confidence: z.number().min(0).max(1),
  confidenceKind: z.enum(['directly-measured', 'derived-from-measurements', 'inferred-with-uncertainty']),
  facts: z.record(z.string(), z.unknown()), limitations: z.array(z.string()),
  observedAt:z.string(),
  usage: z.string().default('Behavioral reference only; use original code and authorized assets.')
});
export type ComponentEvidence = z.infer<typeof ComponentSchema>;
export type Observation = { id: string; sourceId: string; capturedAt: string; durationMs: number; fingerprint: string; scopeKey: string; complete: boolean; targetSelector?: string; views: ViewportObservation[]; limitations: string[] };

export function safeLabel(s: string): string {
  return s.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, 160);
}
