import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/deploy-cf-worker.yml", "utf8");
const wranglerToml = readFileSync("wrangler.toml", "utf8");

describe("job deploy Cloudflare", () => {
  it("installe bun avant wrangler-action et lui demande explicitement bun", () => {
    const bun = workflow.indexOf("uses: oven-sh/setup-bun@v2");
    const action = workflow.indexOf("uses: cloudflare/wrangler-action@v3");
    expect(bun).toBeGreaterThan(-1);
    expect(action).toBeGreaterThan(bun);
    expect(workflow).toContain("packageManager: bun");
    expect(workflow).toContain('command: "deploy --config wrangler.toml"');
  });

  it("déploie wrangler.toml, pas le build Lovable absent", () => {
    const redirect = JSON.parse(readFileSync(".wrangler/deploy/config.json", "utf8")) as {
      configPath?: string;
    };
    expect(redirect.configPath).toContain("dist/server/wrangler.json");
    expect(readFileSync(".gitignore", "utf8")).toMatch(/^dist$/m);
    expect(workflow).toContain('command: "deploy --config wrangler.toml"');
  });
});

describe("périmètre du Worker", () => {
  it("n'attache le Worker qu'à /functions/v1/*", () => {
    const routesStart = wranglerToml.indexOf("routes = [");
    const routesEnd = wranglerToml.indexOf("]", routesStart);
    const routes = wranglerToml.slice(routesStart, routesEnd);
    expect(routes).toContain('pattern = "crawlers.fr/functions/v1/*"');
    expect(routes).toContain('pattern = "www.crawlers.fr/functions/v1/*"');
    expect(routes.includes('pattern = "crawlers.fr/*"')).toBe(false);
    expect(routes.includes('pattern = "www.crawlers.fr/*"')).toBe(false);
    expect(routes.includes("*/*")).toBe(false);
  });
});
