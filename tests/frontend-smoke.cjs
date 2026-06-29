const fs = require("node:fs");
const vm = require("node:vm");

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

const local = storage();
const session = storage();
const appRoot = { innerHTML: "" };
const sessionId = "smoke-session";
local.setItem("applePuddingAnimalSessionsV3", JSON.stringify({
  sessions: {
    [sessionId]: {
      sessionId,
      route: "map",
      profile: { name: "冒烟测试", role: "child", avatar: "🧪" }
    }
  },
  order: [sessionId]
}));
session.setItem("applePuddingActiveSessionId", sessionId);

const context = {
  console,
  Blob,
  localStorage: local,
  sessionStorage: session,
  location: { href: "http://app.test/" },
  document: {
    getElementById: (id) => id === "app" ? appRoot : { innerHTML: "" },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  fetch: () => { throw new Error("fetch should not run during bootstrap"); },
  setTimeout,
  clearTimeout,
  URL,
  Map,
  Date,
  JSON,
  Math
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

const sources = [...fs.readFileSync("static/index.html", "utf8").matchAll(/<script src="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((src) => src.startsWith("/static/src/"));

for (const src of sources) {
  const file = src.slice(1);
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

if (!appRoot.innerHTML.includes("shell")) {
  throw new Error("Application shell was not rendered");
}
console.log(`Runtime smoke test OK: ${sources.length} ordered modules loaded and rendered`);
