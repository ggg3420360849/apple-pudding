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
      profile: { name: "冒烟测试", role: "child", avatar: "🧪" },
      linkedAccountId: "family-smoke",
      linkedChildId: "child-smoke",
      syncToken: "child-sync-token",
      lastSyncedAt: new Date().toISOString()
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
  addEventListener: () => {},
  removeEventListener: () => {},
  scrollTo: () => {},
  requestAnimationFrame: (callback) => callback(),
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
  const file = src.slice(1).split("?")[0];
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

if (!appRoot.innerHTML.includes("shell")) {
  throw new Error("Application shell was not rendered");
}
if (appRoot.innerHTML.includes('data-action="toggle-settings"') || appRoot.innerHTML.includes("退出登录")) {
  throw new Error("Child shell must not expose account settings or logout");
}

vm.runInContext('state.route = "imagine"; render()', context);
if (appRoot.innerHTML.includes('data-edit-part="')) {
  throw new Error("Imagine canvas must start without pre-built animal parts");
}
if ((appRoot.innerHTML.match(/class="material-rail"/g) || []).length !== 1) {
  throw new Error("Imagine materials must render as one continuous aligned grid");
}
if (!appRoot.innerHTML.includes("/static/assets/imagine/builder/bodies/")) {
  throw new Error("Imagine view must render the supplied custom animal assets");
}
if (!appRoot.innerHTML.includes("/static/assets/imagine/builder/heads/")) {
  throw new Error("Imagine view must render the separated head assets");
}
if (!appRoot.innerHTML.includes("/static/assets/imagine/builder/tail/")) {
  throw new Error("Imagine view must render the uploaded tail assets");
}
if (!appRoot.innerHTML.includes("/static/assets/imagine/builder/decorate/")) {
  throw new Error("Imagine view must render the uploaded decoration assets");
}
if (!appRoot.innerHTML.includes("/static/assets/imagine/builder/tail/transparent/")
    || !appRoot.innerHTML.includes("/static/assets/imagine/builder/decorate/transparent/")) {
  throw new Error("Tail and decoration assets must use real transparent PNGs");
}
if (appRoot.innerHTML.includes("/static/assets/imagine/custom/")) {
  throw new Error("Imagine view must not render the retired custom animal assets");
}
if (appRoot.innerHTML.includes("/static/assets/imagine/parts/")) {
  throw new Error("Imagine view must not render the retired SVG animal assets");
}
vm.runInContext('applyCreaturePart("leftHand", "panda"); applyCreaturePart("rightFoot", "rabbit"); applyCreaturePart("tail", "curly"); applyCreaturePart("decoration", "bamboo")', context);
if (!appRoot.innerHTML.includes('data-edit-part="leftHand"') || !appRoot.innerHTML.includes('data-edit-part="rightFoot"')) {
  throw new Error("Left/right hands and feet must be independently placeable");
}
if (appRoot.innerHTML.includes('data-edit-part="rightHand"') || appRoot.innerHTML.includes('data-edit-part="leftFoot"')) {
  throw new Error("Adding one limb must not add its opposite limb");
}
if (!appRoot.innerHTML.includes('data-edit-part="tail"') || !appRoot.innerHTML.includes('data-edit-part="decoration"')) {
  throw new Error("Uploaded tails and decorations must be placeable on the canvas");
}
vm.runInContext('state.draftCreature.snapshot = "data:image/webp;base64,TEST"; state.creations = [{ ...clone(state.draftCreature), parts: creaturePartLabelsFromDraft(state.draftCreature), name: "缩略图测试", time: Date.now() }]; render()', context);
if ((appRoot.innerHTML.match(/class="saved-creature-snapshot"/g) || []).length < 2) {
  throw new Error("Captured snapshot must render in both the form thumbnail and album");
}

(async () => {
  context.BlueAnimal.api = Object.freeze({
    ...context.BlueAnimal.api,
    validateChildSession: async () => {
      throw new context.BlueAnimal.ApiError("Not Found", 404, { detail: "Not Found" });
    }
  });

  await vm.runInContext("validateChildSession({ silent: true })", context);
  vm.runInContext("clearChildSessionCheckTimer()", context);

  if (session.getItem("applePuddingActiveSessionId") !== sessionId) {
    throw new Error("A missing validation endpoint must not revoke a valid child session");
  }

  context.BlueAnimal.api = Object.freeze({
    ...context.BlueAnimal.api,
    validateChildSession: async () => {
      throw new context.BlueAnimal.ApiError("未找到孩子档案", 404, { detail: "未找到孩子档案" });
    }
  });

  await vm.runInContext("validateChildSession({ silent: true })", context);

  const persisted = JSON.parse(local.getItem("applePuddingAnimalSessionsV3"));
  if (session.getItem("applePuddingActiveSessionId") !== null) {
    throw new Error("Deleted child must lose the active session");
  }
  if (persisted.sessions[sessionId] || persisted.order.includes(sessionId)) {
    throw new Error("Deleted child session must be removed from local storage");
  }
  if (context.location.href !== "/static/index-login.html") {
    throw new Error("Deleted child must be redirected to login");
  }

  console.log(`Runtime smoke test OK: ${sources.length} ordered modules loaded, rendered, and revoked a deleted child`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
