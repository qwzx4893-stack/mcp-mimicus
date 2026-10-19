import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from './config.js';
export const MODEL_REVISION = '751bff37182d3f1213fa05d7196b954e230abad9';
export const MODEL_ID = `Xenova/all-MiniLM-L6-v2@${MODEL_REVISION}:q8:mean:l2`;
const artifacts = [
  { path: 'config.json', git: '72147e4ff4426ebedbfa2146c4a0999def51a313' },
  { path: 'tokenizer.json', git: 'c17ed520ed8438736732a54957a69306b8822215' },
  { path: 'tokenizer_config.json', git: '37fca74771bc76a8e01178ce3a6055a0995f8093' },
  {
    path: 'onnx/model_quantized.onnx',
    sha256: 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1',
  },
];
type Extractor = ((
  texts: string[],
  options: { pooling: 'mean'; normalize: true },
) => Promise<{ tolist(): number[][] }>) & { dispose?(): Promise<void> };
/** Model software may be cached. Candidate text/vectors exist only inside embed(). */
export class LocalSemantic {
  readonly name = MODEL_ID;
  private extractor?: Extractor;
  private loading?: Promise<boolean>;
  private error?: string;
  private pending = 0;
  private queue: Promise<void> = Promise.resolve();
  private closed = false;
  constructor(readonly config: Config) {}
  status() {
    return {
      enabled: this.config.semanticEnabled,
      model: MODEL_ID,
      state: this.extractor
        ? 'ready'
        : this.loading
          ? 'loading'
          : this.error
            ? 'unavailable'
            : 'not-loaded',
      error: this.error ?? null,
      cpuThreads: this.config.semanticThreads,
      pending: this.pending,
      siteVectorsPersisted: false,
      modelCacheDir: this.config.modelCacheDir,
    };
  }
  async verifyModel() {
    const root = join(this.config.modelCacheDir, 'Xenova', 'all-MiniLM-L6-v2', MODEL_REVISION);
    for (const a of artifacts) {
      const data = await readFile(join(root, a.path));
      const digest = a.sha256
        ? createHash('sha256').update(data).digest('hex')
        : createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
      if (digest !== (a.sha256 ?? a.git))
        throw new Error('Pinned model integrity mismatch: ' + a.path);
    }
    return { revision: MODEL_REVISION, verifiedFiles: artifacts.length };
  }
  async init() {
    if (this.closed) throw new Error('Semantic runtime is closed');
    if (!this.config.semanticEnabled) return false;
    if (this.extractor) return true;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const { pipeline } = await import('@huggingface/transformers');
        if (!this.config.semanticDownload) await this.verifyModel();
        const extractor = (await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
          revision: MODEL_REVISION,
          dtype: 'q8',
          device: 'cpu',
          local_files_only: !this.config.semanticDownload,
          cache_dir: this.config.modelCacheDir,
          session_options: { intraOpNumThreads: this.config.semanticThreads, interOpNumThreads: 1 },
        })) as unknown as Extractor;
        try {
          await this.verifyModel();
        } catch (e) {
          await extractor.dispose?.();
          throw e;
        }
        this.extractor = extractor;
        this.error = undefined;
        return true;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Model unavailable';
        return false;
      }
    })();
    try {
      return await this.loading;
    } finally {
      this.loading = undefined;
    }
  }
  async embed(texts: string[], signal?: AbortSignal) {
    if (texts.length > 201) throw new Error('Temporary embedding batch exceeds 201 texts');
    if (this.pending >= 8) throw new Error('Local inference queue full');
    if (this.closed) throw new Error('Semantic runtime closed');
    this.pending++;
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((ok) => (release = ok));
    try {
      await previous;
      signal?.throwIfAborted();
      if (!(await this.init())) throw new Error(this.error ?? 'Semantic retrieval disabled');
      signal?.throwIfAborted();
      const unique = [...new Set(texts.map((t) => t.slice(0, 1800)))],
        output = unique.length
          ? (await this.extractor!(unique, { pooling: 'mean', normalize: true })).tolist()
          : [];
      signal?.throwIfAborted();
      return texts.map((t) => {
        const vector = new Float32Array(output[unique.indexOf(t.slice(0, 1800))]!);
        if (vector.length !== 384 || !vector.every(Number.isFinite))
          throw new Error('Invalid MiniLM output');
        return vector;
      });
    } finally {
      this.pending--;
      release();
    }
  }
  async close() {
    this.closed = true;
    await this.queue;
    await this.loading;
    await this.extractor?.dispose?.();
    this.extractor = undefined;
  }
}
export const cosine = (a: Float32Array, b: Float32Array) => {
  if (a.length !== b.length) throw new Error('Vector dimension mismatch');
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
};
