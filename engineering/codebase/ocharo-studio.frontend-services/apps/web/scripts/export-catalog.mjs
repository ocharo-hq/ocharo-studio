import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const require = (specifier) => {
    if (!specifier.startsWith("."))
      throw new Error(
        `Catalog contract must remain dependency-free: ${specifier}`,
      );
    return load(path.resolve(path.dirname(file), `${specifier}.ts`));
  };
  new Function("exports", "require", source)(exports, require);
  return exports;
}
const catalog = load(path.join(root, "src/domain/studio/catalog.ts"));
const contract = {
  garments: catalog.GARMENTS.map((garment) => ({
    id: garment.id,
    parts: garment.parts.map((part) => ({
      id: part.id,
      materialIds: catalog
        .getAvailableMaterials(garment.id, part.id)
        .map((material) => material.id),
    })),
  })),
  materialIds: catalog.MATERIALS.map((material) => material.id),
};
const target = path.resolve(
  root,
  "../../../ocharo-studio.backend-services/OcharoStudio.Application/Studio/State/catalog-contract.json",
);
const content = JSON.stringify(contract, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (fs.readFileSync(target, "utf8") !== content)
    throw new Error(
      "Shared catalog contract is stale; run pnpm catalog:export.",
    );
} else fs.writeFileSync(target, content);
console.log(
  `Verified catalog: ${contract.garments.length} garments, ${contract.materialIds.length} materials.`,
);
