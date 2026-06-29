const fs = require("node:fs");
const vm = require("node:vm");

let checked = 0;
for (const name of fs.readdirSync("static").filter((name) => name.endsWith(".html"))) {
  const html = fs.readFileSync(`static/${name}`, "utf8");
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  scripts.forEach((match, index) => {
    new vm.Script(match[1], { filename: `static/${name}#inline-${index + 1}` });
    checked += 1;
  });
}
console.log(`Inline HTML script syntax OK: ${checked} scripts`);
