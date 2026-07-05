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
const parentSessionId = "parent-refresh-session";

local.setItem("parentToken", "parent-token");
local.setItem("parentAccount", JSON.stringify({ id: "family-refresh" }));
local.setItem("applePuddingAnimalSessionsV3", JSON.stringify({
  sessions: {
    [parentSessionId]: {
      sessionId: parentSessionId,
      route: "report-overview",
      profile: { name: "家长刷新测试", role: "parent", avatar: "🧪" },
      parentAccountId: "family-refresh",
      selectedChild: {
        id: "child-night",
        name: "夜间孩子",
        last_synced_at: "2026-07-05T09:32:00+08:00"
      }
    }
  },
  order: [parentSessionId]
}));
session.setItem("applePuddingActiveSessionId", parentSessionId);

const context = {
  console,
  Blob,
  localStorage: local,
  sessionStorage: session,
  location: { href: "http://app.test/" },
  document: {
    getElementById: (id) => {
      if (id === "app") return appRoot;
      if (id === "toast") return { textContent: "", classList: { remove() {}, add() {} } };
      return { innerHTML: "", classList: { remove() {}, add() {} } };
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  fetch: () => { throw new Error("fetch should not run during refresh feedback tests"); },
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
  const file = src.slice(1).split("?")[0];
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

context.BlueAnimal.api = Object.freeze({
  ...context.BlueAnimal.api,
  getChildProfile: async () => ({
    child: {
      id: "child-night",
      name: "夜间孩子",
      last_synced_at: "2026-07-05T09:32:00+08:00",
      synced_progress: {
        visits: {},
        activities: []
      },
      synced_creations_count: 0
    }
  })
});

(async () => {
  const beforeText = vm.runInContext("formatParentSyncStatusText(state.selectedChild)", context);
  if (!beforeText.startsWith("上次同步：")) {
    throw new Error("Before manual refresh the parent view should show the last sync time");
  }

  const refreshed = await vm.runInContext("refreshSelectedChildSyncData({ silent: false })", context);
  if (!refreshed) {
    throw new Error("Manual refresh should resolve successfully");
  }

  const afterText = vm.runInContext("formatParentSyncStatusText(state.selectedChild)", context);
  if (!afterText.startsWith("刷新完成：")) {
    throw new Error("After manual refresh the parent view should show refresh completion time");
  }

  vm.runInContext('state.selectedChild = { id: "child-other", name: "另一个孩子", last_synced_at: "2026-07-04T20:00:00+08:00" }', context);
  const otherChildText = vm.runInContext("formatParentSyncStatusText(state.selectedChild)", context);
  if (!otherChildText.startsWith("上次同步：")) {
    throw new Error("Refresh completion state must not leak to a different child");
  }

  console.log(`Frontend refresh feedback OK: ${sources.length} ordered modules loaded and parent refresh state rendered`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
