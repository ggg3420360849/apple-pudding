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
const parentSessionId = "parent-isolation-session";

local.setItem("applePuddingAnimalSessionsV3", JSON.stringify({
  sessions: {
    [parentSessionId]: {
      sessionId: parentSessionId,
      route: "report-analysis",
      profile: { name: "家长隔离测试", role: "parent", avatar: "🧪" },
      parentAccountId: "family-a",
      selectedChild: { id: "child-night", name: "夜间测试" }
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
    getElementById: (id) => id === "app" ? appRoot : { innerHTML: "" },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  fetch: () => { throw new Error("fetch should not run during isolation tests"); },
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

function setSessionStore(store) {
  vm.runInContext(`sessionStore = ${JSON.stringify(store)};`, context);
}

function findMatch(accountId, child) {
  return vm.runInContext(
    `(() => {
      const match = findLinkedChildSession(${JSON.stringify(accountId)}, ${JSON.stringify(child)});
      return match ? match.sessionId : null;
    })()`,
    context
  );
}

const targetChild = { id: "child-night", name: "夜间测试" };

const parentSession = {
  sessionId: parentSessionId,
  route: "report-analysis",
  profile: { name: "家长隔离测试", role: "parent", avatar: "🧪" },
  parentAccountId: "family-a",
  selectedChild: targetChild
};

const siblingSession = {
  sessionId: "child-sibling-session",
  profile: { name: "下午测试", role: "child", avatar: "☀️" },
  linkedAccountId: "family-a",
  linkedChildId: "child-afternoon",
  linkedChildProfile: { id: "child-afternoon", name: "下午测试" },
  progress: {
    quizTotal: 2,
    quizCorrect: 2,
    activities: [
      { type: "探索", label: "下午活动", animalId: "panda", time: new Date("2026-07-05T15:00:00+08:00").getTime() }
    ]
  },
  lastSyncedAt: "2026-07-05T15:00:00+08:00"
};

const unrelatedSession = {
  sessionId: "child-unrelated-session",
  profile: { name: "别家孩子", role: "child", avatar: "🌃" },
  linkedAccountId: "family-b",
  linkedChildId: "child-other",
  linkedChildProfile: { id: "child-other", name: "别家孩子" },
  progress: {
    quizTotal: 1,
    quizCorrect: 1,
    activities: [
      { type: "探索", label: "别家活动", animalId: "rabbit", time: new Date("2026-07-05T23:00:00+08:00").getTime() }
    ]
  },
  lastSyncedAt: "2026-07-05T23:00:00+08:00"
};

const exactMatchSession = {
  sessionId: "child-exact-session",
  profile: { name: "夜间测试", role: "child", avatar: "🌙" },
  linkedAccountId: "family-a",
  linkedChildId: "child-night",
  linkedChildProfile: { id: "child-night", name: "夜间测试" },
  progress: {
    quizTotal: 3,
    quizCorrect: 3,
    activities: [
      { type: "探索", label: "夜间活动", animalId: "panda", time: new Date("2026-07-05T23:30:00+08:00").getTime() }
    ]
  },
  lastSyncedAt: "2026-07-05T23:30:00+08:00"
};

const legacyNameMatchSession = {
  sessionId: "child-legacy-session",
  profile: { name: "夜间测试", role: "child", avatar: "🌙" },
  linkedAccountId: "family-a",
  progress: {
    quizTotal: 1,
    quizCorrect: 1,
    activities: [
      { type: "故事", label: "旧版匹配", animalId: "frog", time: new Date("2026-07-05T22:30:00+08:00").getTime() }
    ]
  },
  lastSyncedAt: "2026-07-05T22:30:00+08:00"
};

setSessionStore({
  sessions: {
    [parentSessionId]: parentSession,
    [siblingSession.sessionId]: siblingSession,
    [unrelatedSession.sessionId]: unrelatedSession
  },
  order: [parentSessionId, siblingSession.sessionId, unrelatedSession.sessionId]
});

if (findMatch("family-a", targetChild) !== null) {
  throw new Error("Sibling or unrelated child session must not match the selected child");
}

setSessionStore({
  sessions: {
    [parentSessionId]: parentSession,
    [siblingSession.sessionId]: siblingSession,
    [exactMatchSession.sessionId]: exactMatchSession
  },
  order: [parentSessionId, siblingSession.sessionId, exactMatchSession.sessionId]
});

if (findMatch("family-a", targetChild) !== exactMatchSession.sessionId) {
  throw new Error("Exact child session must win over same-account sibling sessions");
}

setSessionStore({
  sessions: {
    [parentSessionId]: parentSession,
    [legacyNameMatchSession.sessionId]: legacyNameMatchSession
  },
  order: [parentSessionId, legacyNameMatchSession.sessionId]
});

if (findMatch("family-a", targetChild) !== legacyNameMatchSession.sessionId) {
  throw new Error("Legacy child session without linkedChildId should still match by account + name");
}

console.log(`Frontend session isolation OK: ${sources.length} ordered modules loaded and child sessions stayed isolated`);
