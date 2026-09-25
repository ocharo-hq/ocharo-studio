import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";
const allowed = {
  bootstrap: new Set([
    "bootstrap",
    "presentation",
    "application",
    "integration",
    "domain",
  ]),
  presentation: new Set(["presentation", "application", "domain"]),
  application: new Set(["application", "integration", "domain"]),
  integration: new Set(["integration", "domain"]),
  domain: new Set(["domain"]),
};
function permits(from, target) {
  const [layer, slice] = from.split("/");
  const [targetLayer, targetSlice] = target.split("/");
  if (!allowed[layer]?.has(targetLayer)) return false;
  return (
    layer === "bootstrap" || targetSlice === "common" || slice === targetSlice
  );
}
// Guard the rule itself against permitting the forbidden edges it is meant to detect.
assert.equal(
  permits("presentation/studio/page.tsx", "integration/studio/api.ts"),
  false,
);
assert.equal(
  permits("domain/studio/model.ts", "application/studio/state.ts"),
  false,
);
assert.equal(
  permits("application/studio/hook.ts", "domain/other/model.ts"),
  false,
);
assert.equal(
  permits("application/studio/hook.ts", "integration/studio/api.ts"),
  true,
);
const sourceRoot = path.resolve("src");
let imports = 0;
const failures = [];
for (const entry of fs.readdirSync(sourceRoot, { recursive: true })) {
  if (!/\.tsx?$/.test(entry) || entry === "main.tsx") continue;
  const source = ts.createSourceFile(
    entry,
    fs.readFileSync(path.join(sourceRoot, entry), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  function inspect(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;
      if (specifier.startsWith(".")) {
        const target = path.relative(
          sourceRoot,
          path.resolve(sourceRoot, path.dirname(entry), specifier),
        );
        if (!permits(entry, target)) failures.push(`${entry} → ${target}`);
        imports++;
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(source);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  `Architecture boundaries passed: ${imports} local imports; forbidden-edge rule checks passed.`,
);
