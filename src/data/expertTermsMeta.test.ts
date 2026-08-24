import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildExpertTermsMeta, serializeExpertTermsMeta } from "./expertTermsMeta.build";

describe("expertTermsMeta.generated.ts", () => {
  it("reste synchronisé avec expertTerms.ts", () => {
    const onDisk = readFileSync(new URL("./expertTermsMeta.generated.ts", import.meta.url), "utf8");
    expect(onDisk).toBe(serializeExpertTermsMeta(buildExpertTermsMeta()));
  });
});
