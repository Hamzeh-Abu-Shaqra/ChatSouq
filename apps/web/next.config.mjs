// Env is loaded by Next from apps/web/.env.local (mirrors the repo-root .env).
// transformers.js pulls in the native ONNX runtime (a .node binary) + sharp,
// which webpack can't parse. They must stay external and load via Node's runtime
// require. serverExternalPackages alone isn't enough here because @chatsouq/ai is
// transpiled, so the import chain is bundled — we also force them as webpack
// externals on the server build.
const NATIVE_EXTERNALS = ["@xenova/transformers", "onnxruntime-node", "sharp"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@chatsouq/core", "@chatsouq/db", "@chatsouq/ai"],
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: NATIVE_EXTERNALS,
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push(
        Object.fromEntries(NATIVE_EXTERNALS.map((p) => [p, `commonjs ${p}`]))
      );
    }
    return config;
  },
};

export default nextConfig;
