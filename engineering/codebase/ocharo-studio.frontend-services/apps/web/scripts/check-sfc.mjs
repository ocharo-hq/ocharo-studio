import fs from "node:fs";
import path from "node:path";
import { compileScript, compileTemplate, parse } from "vue/compiler-sfc";

let count = 0;
for (const file of fs.readdirSync("src", { recursive: true })) {
  if (!file.endsWith(".vue")) continue;
  const filename = path.resolve("src", file);
  const { descriptor, errors } = parse(fs.readFileSync(filename, "utf8"), {
    filename,
  });
  if (errors.length) throw new Error(`${file}: ${errors.join("\n")}`);
  if (descriptor.styles.length)
    throw new Error(`${file}: styles belong in the shared CSS files`);
  const script = compileScript(descriptor, { id: file });
  if (descriptor.template) {
    const result = compileTemplate({
      id: file,
      filename,
      source: descriptor.template.content,
      compilerOptions: { bindingMetadata: script.bindings },
    });
    if (result.errors.length)
      throw new Error(`${file}: ${result.errors.join("\n")}`);
  }
  count++;
}
console.log(`Compiled ${count} Vue single-file components.`);
