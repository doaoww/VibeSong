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
  // ffmpeg-static resolves its bundled ffmpeg binary via a __dirname-based
  // path, which Turbopack's server-route bundler rewrites to a virtual path
  // that doesn't resolve to a real file at runtime, causing fluent-ffmpeg's
  // spawn call to fail with ENOENT. Opt both packages out of the server
  // bundle so they load via native `require` instead.
  serverExternalPackages: ["ffmpeg-static", "fluent-ffmpeg"],
};

export default nextConfig;
