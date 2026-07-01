import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // process.cwd() depends on the directory `next dev`/`next build` is
    // invoked from, which is unreliable when this checkout is nested inside
    // another repo's tree (e.g. a git worktree under .claude/worktrees/) —
    // Turbopack's workspace-root inference can walk up and find the OUTER
    // repo's package.json/lockfile instead. Anchor to this config file's own
    // directory so it's always correct regardless of invocation cwd or nesting.
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
};

export default nextConfig;
