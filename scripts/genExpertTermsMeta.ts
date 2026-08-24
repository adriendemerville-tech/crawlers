/**
 * Génère src/data/expertTermsMeta.generated.ts : uniquement ce dont head() a
 * besoin (slug, terme, définition tronquée). La route /lexique/$slug lisait
 * expertTerms.ts (162 Ko) dans head(), code critique non découpé, donc chargé
 * par chaque visiteur du site.
 *
 * Usage : bun scripts/genExpertTermsMeta.ts
 * Un test (src/data/expertTermsMeta.test.ts) vérifie que le fichier est à jour.
 */
import { writeFileSync } from "node:fs";
import { buildExpertTermsMeta, serializeExpertTermsMeta } from "../src/data/expertTermsMeta.build";

const target = new URL("../src/data/expertTermsMeta.generated.ts", import.meta.url);
writeFileSync(target, serializeExpertTermsMeta(buildExpertTermsMeta()));
console.log("expertTermsMeta.generated.ts mis à jour");
