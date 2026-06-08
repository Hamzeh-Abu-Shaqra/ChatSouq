// Feasibility probe: can we run a real local semantic embedder on this machine?
import { pipeline, env } from "@xenova/transformers";

// Cache models under the repo so re-runs are offline.
env.cacheDir = new URL("../.models", import.meta.url).pathname;

const t0 = Date.now();
const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
console.log(`model loaded in ${Date.now() - t0}ms`);

const texts = [
  "a birthday gift for my wife who likes perfume",
  "Chanel Coco Mademoiselle Eau de Parfum for women",
  "DeWalt cordless power drill 18V",
];
const t1 = Date.now();
const out = await extractor(texts, { pooling: "mean", normalize: true });
console.log(`embedded ${texts.length} texts in ${Date.now() - t1}ms`);
console.log("dims:", out.dims);

const dim = out.dims[1];
const vecs = [];
for (let i = 0; i < texts.length; i++) {
  vecs.push(Array.from(out.data.slice(i * dim, (i + 1) * dim)));
}
const cos = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
console.log("cos(query, perfume) =", cos(vecs[0], vecs[1]).toFixed(3), "(should be HIGH)");
console.log("cos(query, drill)   =", cos(vecs[0], vecs[2]).toFixed(3), "(should be LOW)");
