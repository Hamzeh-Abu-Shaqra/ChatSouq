import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Embedder } from "./types";

export const EMBEDDING_DIM = 384;

const MODEL = "Xenova/all-MiniLM-L6-v2";

function resolveCacheDir(): string {
  const override = process.env.CHATSOUQ_MODELS_DIR;
  if (override) return override;
  try {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.models");
  } catch {
    return path.resolve(process.cwd(), ".models");
  }
}

/**
 * Local MiniLM embedder — dynamically imports @xenova/transformers so that
 * environments where onnxruntime-node native binaries are unavailable (e.g.
 * Vercel Lambda) fail gracefully at first use instead of crashing on import.
 */
export class LocalEmbedder implements Embedder {
  readonly name = "minilm-l6-v2";
  readonly dimensions = EMBEDDING_DIM;
  private static pipe: Promise<unknown> | null = null;

  private async extractor(): Promise<unknown> {
    if (!LocalEmbedder.pipe) {
      // Dynamic import so module-level crashes don't kill the whole function.
      const xf = await import("@xenova/transformers");
      xf.env.cacheDir = resolveCacheDir();
      xf.env.allowRemoteModels = true;
      LocalEmbedder.pipe = xf.pipeline("feature-extraction", MODEL);
    }
    return LocalEmbedder.pipe;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      const extractor = await this.extractor() as (
        texts: string[],
        opts: { pooling: string; normalize: boolean }
      ) => Promise<{ data: Float32Array }>;
      const dim = this.dimensions;
      const out: number[][] = [];
      const SUB = 64;
      for (let start = 0; start < texts.length; start += SUB) {
        const chunk = texts.slice(start, start + SUB).map((t) => t || " ");
        const tensor = await extractor(chunk, { pooling: "mean", normalize: true });
        const data = tensor.data as Float32Array;
        for (let i = 0; i < chunk.length; i++) {
          out.push(Array.from(data.slice(i * dim, (i + 1) * dim)));
        }
      }
      return out;
    } catch {
      console.warn("[ai] LocalEmbedder.embed failed — falling back to zero vectors");
      return texts.map(() => new Array(EMBEDDING_DIM).fill(0) as number[]);
    }
  }
}

/**
 * Zero-vector fallback used when the local ONNX runtime can't load
 * (e.g. Vercel Lambda environment). Retrieval falls back to pure trigram
 * text search which is still accurate for keyword-heavy queries.
 */
class NullEmbedder implements Embedder {
  readonly name = "null";
  readonly dimensions = EMBEDDING_DIM;
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => new Array(EMBEDDING_DIM).fill(0) as number[]);
  }
}

let _embedder: Embedder | null = null;

export function getEmbedder(): Embedder {
  if (_embedder) return _embedder;
  try {
    _embedder = new LocalEmbedder();
  } catch {
    console.warn("[ai] LocalEmbedder failed to initialize — falling back to text-only search.");
    _embedder = new NullEmbedder();
  }
  return _embedder;
}
