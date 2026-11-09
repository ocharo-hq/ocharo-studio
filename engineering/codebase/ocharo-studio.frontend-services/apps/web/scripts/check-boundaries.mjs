import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";
import { parse } from "vue/compiler-sfc";
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
  permits(
    "presentation/studio/pages/StudioPage.vue",
    "integration/studio/endpoints/StudioApi.ts",
  ),
  false,
);
assert.equal(
  permits(
    "domain/studio/models/DesignDocument.ts",
    "application/studio/StudioState.ts",
  ),
  false,
);
assert.equal(
  permits(
    "application/studio/hooks/UseStudio.ts",
    "domain/other/models/Other.ts",
  ),
  false,
);
assert.equal(
  permits(
    "application/studio/hooks/UseStudio.ts",
    "integration/studio/endpoints/StudioApi.ts",
  ),
  true,
);
const sourceRoot = path.resolve("src");
let imports = 0;
const failures = [];
for (const entry of fs.readdirSync(sourceRoot, { recursive: true })) {
  if (!/\.(ts|vue)$/.test(entry)) continue;
  const content = fs.readFileSync(path.join(sourceRoot, entry), "utf8");
  const descriptor = entry.endsWith(".vue") ? parse(content).descriptor : null;
  const source = ts.createSourceFile(
    entry,
    descriptor
      ? [descriptor.script?.content, descriptor.scriptSetup?.content]
          .filter(Boolean)
          .join("\n")
      : content,
    ts.ScriptTarget.Latest,
    true,
  );
  function inspect(node) {
    let specifier;
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifier = node.moduleSpecifier.text;
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifier = node.arguments[0].text;
    }
    if (specifier?.startsWith(".")) {
      const target = path.relative(
        sourceRoot,
        path.resolve(sourceRoot, path.dirname(entry), specifier),
      );
      if (!permits(entry, target)) failures.push(`${entry} → ${target}`);
      imports++;
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
