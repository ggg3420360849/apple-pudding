let sessionStore = loadSessionStore();
let state = loadState();
const app = document.getElementById("app");
let draggedCreaturePart = null;
const creaturePointers = new Map();
let creatureGesture = null;
const CHILD_SYNC_INTERVAL_STORAGE_KEY = "applePuddingChildSyncIntervalHours";
const CHILD_SYNC_INTERVAL_OPTIONS = [3, 6, 9, 12];
const CHILD_SESSION_CHECK_INTERVAL_MS = 30 * 1000;
let childSyncTimer = null;
let childSyncPromise = null;
let childSyncRerunRequested = false;
let childSessionCheckTimer = null;
let childSessionCheckPromise = null;
let childSessionCheckUnavailable = false;

function getChildSyncIntervalHours() {
    const saved = Number(window.localStorage.getItem(CHILD_SYNC_INTERVAL_STORAGE_KEY));
    return CHILD_SYNC_INTERVAL_OPTIONS.includes(saved) ? saved : 6;
}

function getChildSyncIntervalMs() {
    return getChildSyncIntervalHours() * 60 * 60 * 1000;
}

function clone(value) {
    return typeof structuredClone === "function"
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value));
}

function loadSessionStore() {
    try {
        const saved = BlueAnimal.storage.persistent.read(STORE_KEY);
        if (saved && saved.sessions) return saved;

        const legacy = BlueAnimal.storage.persistent.read(LEGACY_STORE_KEY);
        if (legacy && legacy.profile) {
            const id = legacy.sessionId || makeSessionId();
            const migrated = mergeState(clone(defaultState), legacy);
            migrated.sessionId = id;
            const store = { sessions: { [id]: migrated }, order: [id] };
            BlueAnimal.storage.persistent.write(STORE_KEY, store);
            BlueAnimal.storage.session.write(ACTIVE_SESSION_KEY, id);
            return store;
        }

        return { sessions: {}, order: [] };
    } catch (error) {
        console.error('Failed to load session store:', error);
        // 清除损坏的数据
        try {
            BlueAnimal.storage.persistent.remove(STORE_KEY);
            BlueAnimal.storage.persistent.remove(LEGACY_STORE_KEY);
        } catch (cleanupError) {
            console.error('Failed to cleanup corrupted data:', cleanupError);
        }
        return { sessions: {}, order: [] };
    }
}

function loadState() {
    const activeId = BlueAnimal.storage.session.read(ACTIVE_SESSION_KEY);
    if (activeId && sessionStore.sessions[activeId]) {
        const loaded = mergeState(clone(defaultState), sessionStore.sessions[activeId]);
        synchronizeGrasslandUnlocks(loaded);
        return loaded;
    }
    return clone(defaultState);
}

function synchronizeGrasslandUnlocks(targetState) {
    const rabbitUnlocked = targetState.animalUnlocks?.rabbit?.unlocked;
    const elephantUnlocked = targetState.animalUnlocks?.elephant?.unlocked;
    if (!rabbitUnlocked && !elephantUnlocked) return;

    const unlockedAt = targetState.animalUnlocks.rabbit?.unlockedAt
        || targetState.animalUnlocks.elephant?.unlockedAt
        || new Date().toISOString();

    ["rabbit", "elephant"].forEach((animalId) => {
        targetState.animalUnlocks[animalId] = {
            interactionCount: 0,
            quizPassed: false,
            quickQACount: 0,
            ...(targetState.animalUnlocks[animalId] || {}),
            unlocked: true,
            unlockedAt
        };
    });
}

function mergeState(base, saved) {
    const merged = { ...base, ...saved };
    delete merged.qaRequest;
    delete merged.careDoctorModal;
    delete merged.careFeedConfirm;
    delete merged.syncRefreshLoading;
    merged.dailyQuizGeneration = {};
    merged.progress = { ...base.progress, ...(saved.progress || {}) };
    merged.progress.visits = {
        ...(base.progress?.visits || {}),
        ...((saved.progress || {}).visits || {})
    };
    merged.progress.activities = Array.isArray((saved.progress || {}).activities)
        ? (saved.progress || {}).activities
        : [...(base.progress?.activities || [])];
    const savedDraftCreature = saved.draftCreature || {};
    // Canvas versions migrate incompatible part layouts (v1 made it blank;
    // v2 split paired hands and feet into four independently movable parts).
    // Drafts saved by the old UI are cleared once so returning children also
    // start with an empty sheet instead of inheriting the former demo animal.
    merged.draftCreature = savedDraftCreature.canvasVersion === base.draftCreature.canvasVersion
        ? { ...base.draftCreature, ...savedDraftCreature }
        : { ...base.draftCreature };
    merged.draftCreature.transforms = {
        ...base.draftCreature.transforms,
        ...(savedDraftCreature.canvasVersion === base.draftCreature.canvasVersion
            ? (savedDraftCreature.transforms || {})
            : {})
    };
    merged.animalUnlocks = { ...base.animalUnlocks, ...(saved.animalUnlocks || {}) };
    return merged;
}

function normalizeProgressSnapshot(progress = {}) {
    return mergeState(clone(defaultState), {
        progress: {
            ...(progress || {}),
            visits: { ...((progress || {}).visits || {}) },
            activities: Array.isArray(progress?.activities) ? progress.activities : []
        }
    }).progress;
}

function buildLegacyChildProgressSnapshot(child = {}) {
    return normalizeProgressSnapshot({
        visits: Object.fromEntries((child.animals_explored || []).map((animalId) => [animalId, 1])),
        questions: 0,
        stories: child.stories_created || 0,
        quizTotal: child.questions_answered || 0,
        quizCorrect: child.questions_correct || 0,
        activities: []
    });
}

function extractChildProgressSnapshot(child = {}) {
    const syncedProgress = child?.synced_progress;
    if (syncedProgress && typeof syncedProgress === "object" && Object.keys(syncedProgress).length) {
        return normalizeProgressSnapshot(syncedProgress);
    }
    return buildLegacyChildProgressSnapshot(child);
}

function getChildSyncedCreationsCount(child = {}) {
    const raw = child?.synced_creations_count ?? child?.synced_progress?.creations;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function makeSyncedCreationPlaceholders(count = 0) {
    return Array.from({ length: Math.max(0, Number(count) || 0) }, (_, index) => ({
        id: `synced-creation-${index + 1}`,
        synced: true
    }));
}

function getLastSyncedTimestamp(sessionData = {}) {
    const raw = sessionData.lastSyncedAt
        || sessionData.linkedChildProfile?.last_synced_at
        || sessionData.selectedChild?.last_synced_at;
    const timestamp = raw ? Date.parse(raw) : 0;
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function getSessionListFromStore() {
    const sessions = sessionStore?.sessions && typeof sessionStore.sessions === "object"
        ? sessionStore.sessions
        : {};
    const orderedIds = Array.isArray(sessionStore?.order) ? sessionStore.order : [];
    const seen = new Set();
    const orderedSessions = orderedIds
        .map((id) => {
            seen.add(id);
            return sessions[id];
        })
        .filter(Boolean);
    const unorderedSessions = Object.entries(sessions)
        .filter(([id]) => !seen.has(id))
        .map(([, sessionData]) => sessionData)
        .filter(Boolean);

    return [...orderedSessions, ...unorderedSessions];
}

function childSyncEligible(sessionData = state) {
    return Boolean(
        sessionData?.profile?.role === "child"
        && sessionData?.linkedAccountId
        && sessionData?.linkedChildId
        && sessionData?.syncToken
        && sessionData?.sessionId
    );
}

function isInvalidChildSessionError(error) {
    if (!(error instanceof BlueAnimal.ApiError)) return false;
    if ([401, 403].includes(error.status)) return true;
    return error.status === 404 && error.payload?.detail === "未找到孩子档案";
}

function isMissingChildSessionCheckEndpoint(error) {
    return error instanceof BlueAnimal.ApiError
        && error.status === 404
        && error.payload?.detail === "Not Found";
}

function clearChildSessionCheckTimer() {
    if (childSessionCheckTimer) {
        window.clearTimeout(childSessionCheckTimer);
        childSessionCheckTimer = null;
    }
}

function invalidateChildSession(sessionId) {
    if (!sessionId) return;

    delete sessionStore.sessions[sessionId];
    sessionStore.order = sessionStore.order.filter((id) => id !== sessionId);
    BlueAnimal.storage.persistent.write(STORE_KEY, sessionStore);

    if (state.sessionId === sessionId) {
        BlueAnimal.storage.session.remove(ACTIVE_SESSION_KEY);
        clearChildAutoSyncTimer();
        clearChildSessionCheckTimer();
        state = clone(defaultState);
        window.location.href = "/static/index-login.html";
    }
}

function scheduleChildSessionCheck() {
    clearChildSessionCheckTimer();
    if (!childSyncEligible(state) || childSessionCheckUnavailable) return;

    childSessionCheckTimer = window.setTimeout(() => {
        validateChildSession({ silent: true });
    }, CHILD_SESSION_CHECK_INTERVAL_MS);
}

async function validateChildSession({ silent = false } = {}) {
    if (!childSyncEligible(state)) return false;
    if (childSessionCheckPromise) return childSessionCheckPromise;

    const sessionId = state.sessionId;
    const childId = state.linkedChildId;
    const token = state.syncToken;

    childSessionCheckPromise = (async () => {
        try {
            await BlueAnimal.api.validateChildSession(childId, token);
            childSessionCheckUnavailable = false;
            return true;
        } catch (error) {
            if (isMissingChildSessionCheckEndpoint(error)) {
                childSessionCheckUnavailable = true;
                return false;
            }
            if (isInvalidChildSessionError(error)) {
                invalidateChildSession(sessionId);
                return false;
            }
            console.error("检查孩子会话状态失败:", error);
            if (!silent) showToast("暂时无法检查账户状态");
            return false;
        } finally {
            childSessionCheckPromise = null;
            scheduleChildSessionCheck();
        }
    })();

    return childSessionCheckPromise;
}

function persistDetachedSession(sessionId, nextState) {
    if (!sessionId) return;
    sessionStore.sessions[sessionId] = mergeState(clone(defaultState), nextState);
    sessionStore.order = [sessionId, ...sessionStore.order.filter((id) => id !== sessionId)];
    BlueAnimal.storage.persistent.write(STORE_KEY, sessionStore);
}

function getSessionCreationCount(sessionData = {}) {
    if (Array.isArray(sessionData.creations) && sessionData.creations.length) {
        return sessionData.creations.length;
    }
    const progressCount = Number(sessionData.progress?.creations);
    if (Number.isFinite(progressCount) && progressCount > 0) {
        return progressCount;
    }
    return getChildSyncedCreationsCount(sessionData.linkedChildProfile);
}

function clearChildAutoSyncTimer() {
    if (childSyncTimer) {
        window.clearTimeout(childSyncTimer);
        childSyncTimer = null;
    }
}

function scheduleChildAutoSync() {
    clearChildAutoSyncTimer();
    if (!childSyncEligible(state)) return;

    const elapsed = Date.now() - getLastSyncedTimestamp(state);
    const delay = Math.max(0, getChildSyncIntervalMs() - Math.max(0, elapsed));

    childSyncTimer = window.setTimeout(async () => {
        await syncChildProgress({ force: true, silent: true });
    }, delay);
}

async function syncStoredChildSession(sessionData = state, {
    force = false,
    silent = false,
    tokenOverride = "",
    childIdOverride = "",
    accountIdOverride = "",
    linkedChildProfileOverride = null
} = {}) {
    const syncToken = tokenOverride || sessionData.syncToken;
    const childId = childIdOverride || sessionData.linkedChildId || sessionData.linkedChildProfile?.id;
    const canSync = Boolean(
        sessionData?.profile?.role === "child"
        && childId
        && syncToken
        && sessionData?.sessionId
    );
    if (!canSync) return false;

    const lastSyncedAt = getLastSyncedTimestamp(sessionData);
    if (!force && lastSyncedAt && (Date.now() - lastSyncedAt) < getChildSyncIntervalMs()) {
        scheduleChildAutoSync();
        return false;
    }

    if (childSyncPromise) {
        if (force && sessionData?.sessionId === state.sessionId) {
            childSyncRerunRequested = true;
        }
        return childSyncPromise;
    }

    const sessionId = sessionData.sessionId;
    childSyncPromise = (async () => {
        try {
            const payload = await BlueAnimal.api.syncChildProgress({
                child_id: childId,
                progress: normalizeProgressSnapshot(sessionData.progress),
                creations_count: getSessionCreationCount(sessionData)
            }, syncToken);

            const syncedChild = payload.child || null;
            const nextLinkedChildProfile = syncedChild
                || linkedChildProfileOverride
                || sessionData.linkedChildProfile
                || null;
            const syncedAt = syncedChild?.last_synced_at || new Date().toISOString();
            const nextSession = mergeState(clone(defaultState), {
                ...sessionData,
                linkedAccountId: accountIdOverride || sessionData.linkedAccountId,
                linkedChildId: childId,
                linkedChildProfile: nextLinkedChildProfile,
                lastSyncedAt: syncedAt
            });

            if (state.sessionId === sessionId) {
                state = nextSession;
                saveState();
            } else {
                persistDetachedSession(sessionId, nextSession);
            }

            if (!silent) {
                showToast("已同步学习数据");
            }
            return true;
        } catch (error) {
            if (isInvalidChildSessionError(error)) {
                invalidateChildSession(sessionId);
                return false;
            }
            console.error("同步孩子学习数据失败:", error);
            if (!silent) {
                showToast("同步失败，请稍后重试");
            }
            return false;
        } finally {
            childSyncPromise = null;
            const shouldRerun = childSyncRerunRequested;
            childSyncRerunRequested = false;
            scheduleChildAutoSync();
            if (shouldRerun && childSyncEligible(state)) {
                syncChildProgress({ force: true, silent: true });
            }
        }
    })();

    return childSyncPromise;
}

async function syncChildProgress(options = {}) {
    return syncStoredChildSession(state, options);
}

function readStoredParentAccountId() {
    try {
        const account = JSON.parse(window.localStorage.getItem("parentAccount") || "{}");
        return account.account_id || account.id || "";
    } catch (error) {
        console.error("读取家长账户缓存失败:", error);
        return "";
    }
}

function getSessionActivityTimestamp(sessionData = {}) {
    const latestActivityTime = Number(sessionData.progress?.activities?.[0]?.time || 0);
    return Math.max(
        Number.isFinite(latestActivityTime) ? latestActivityTime : 0,
        getLastSyncedTimestamp(sessionData)
    );
}

function getProgressSummary(progress = {}) {
    const activities = Array.isArray(progress?.activities) ? progress.activities : [];
    const latestActivityTime = activities.reduce((latest, item) => {
        const timestamp = Number(item?.time || 0);
        return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
    }, 0);

    return {
        quizTotal: Number(progress?.quizTotal || 0),
        quizCorrect: Number(progress?.quizCorrect || 0),
        activityCount: activities.length,
        latestActivityTime
    };
}

function getChildServerProgressSummary(child = {}) {
    const progress = child?.synced_progress && typeof child.synced_progress === "object"
        ? child.synced_progress
        : {};
    const summary = getProgressSummary(progress);
    summary.quizTotal = Math.max(summary.quizTotal, Number(child?.questions_answered || 0));
    summary.quizCorrect = Math.max(summary.quizCorrect, Number(child?.questions_correct || 0));
    summary.syncedAt = Date.parse(child?.last_synced_at || "") || 0;
    return summary;
}

function getChildSessionProgressSignal(sessionData = {}, child = {}) {
    const local = getProgressSummary(sessionData.progress || {});
    const remote = getChildServerProgressSummary(child);
    const newerThanServer = local.latestActivityTime > remote.syncedAt + 1000;
    const hasMoreQuiz = local.quizTotal > remote.quizTotal || local.quizCorrect > remote.quizCorrect;
    const hasMoreActivities = local.activityCount > remote.activityCount;
    return {
        ...local,
        hasUnsyncedProgress: newerThanServer || hasMoreQuiz || hasMoreActivities,
        rank: (newerThanServer ? 100000 : 0)
            + (hasMoreQuiz ? 50000 : 0)
            + (hasMoreActivities ? 10000 : 0)
            + local.quizTotal * 100
            + local.activityCount
    };
}

function shouldUploadChildSession(sessionData = {}, child = {}) {
    const signal = getChildSessionProgressSignal(sessionData, child);
    return signal.hasUnsyncedProgress || (!child?.last_synced_at && (signal.quizTotal || signal.activityCount));
}

function normalizeMatchText(value = "") {
    return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getChildSessionMatchScore(sessionData = {}, accountId, child = {}) {
    if (sessionData?.profile?.role !== "child") return 0;

    const childId = String(child?.id || "");
    const childName = normalizeMatchText(child?.name);
    const sessionChildId = String(sessionData.linkedChildId || sessionData.linkedChildProfile?.id || sessionData.selectedChild?.id || "");
    const sessionChildName = normalizeMatchText(
        sessionData.linkedChildProfile?.name
        || sessionData.selectedChild?.name
        || sessionData.profile?.name
    );
    const sessionAccountId = String(sessionData.linkedAccountId || "");
    const sameChildId = Boolean(childId && sessionChildId && childId === sessionChildId);
    const sameChildName = Boolean(childName && sessionChildName && childName === sessionChildName);
    const sameAccount = Boolean(accountId && sessionAccountId && String(accountId) === sessionAccountId);

    if (sameChildId) {
        return 100 + (sameAccount ? 20 : 0);
    }

    // Legacy child sessions may be missing linkedChildId, so fall back to
    // account + name only when both identifiers match together.
    if (sameAccount && sameChildName) {
        return 60;
    }

    return 0;
}

function findLinkedChildSession(accountId, child) {
    const storedSessions = getSessionListFromStore();
    const childSessions = storedSessions
        .filter((sessionData) => sessionData?.profile?.role === "child");

    const candidates = childSessions
        .map((sessionData) => ({
            sessionData,
            score: getChildSessionMatchScore(sessionData, accountId, child),
            signal: getChildSessionProgressSignal(sessionData, child)
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => {
            if (b.signal.hasUnsyncedProgress !== a.signal.hasUnsyncedProgress) {
                return b.signal.hasUnsyncedProgress ? 1 : -1;
            }
            if (b.signal.rank !== a.signal.rank) return b.signal.rank - a.signal.rank;
            if (b.score !== a.score) return b.score - a.score;
            return getSessionActivityTimestamp(b.sessionData) - getSessionActivityTimestamp(a.sessionData);
        });

    if (candidates[0]?.sessionData) {
        return candidates[0].sessionData;
    }

    return null;
}

async function refreshSelectedChildSyncData({ silent = false } = {}) {
    const parentAccountId = state.parentAccountId || readStoredParentAccountId();
    if (state.profile?.role !== "parent" || !parentAccountId || !state.selectedChild?.id) {
        if (!silent) {
            showToast("请先选择一个孩子");
        }
        return false;
    }

    state.parentAccountId = parentAccountId;
    state.syncRefreshLoading = true;
    render();

    try {
        const parentToken = window.localStorage.getItem("parentToken");
        if (!parentToken) {
            throw new Error("missing parent token");
        }

        // The child may have been active in another tab after the parent report
        // loaded, so refresh the in-memory session store before searching.
        sessionStore = loadSessionStore();
        const localChildSession = findLinkedChildSession(parentAccountId, state.selectedChild);
        let uploadedLocalChildSession = false;
        const shouldUploadLocalChildSession = localChildSession && shouldUploadChildSession(localChildSession, state.selectedChild);
        if (shouldUploadLocalChildSession) {
            uploadedLocalChildSession = await syncStoredChildSession(localChildSession, {
                force: true,
                silent: true,
                tokenOverride: parentToken,
                childIdOverride: state.selectedChild.id,
                accountIdOverride: parentAccountId,
                linkedChildProfileOverride: state.selectedChild
            });
        }

        const payload = await BlueAnimal.api.getChildProfile(parentAccountId, state.selectedChild.id, parentToken);
        const child = payload.child || {};
        const refreshedAt = new Date().toISOString();

        state.selectedChild = child;
        state.progress = extractChildProgressSnapshot(child);
        state.creations = makeSyncedCreationPlaceholders(getChildSyncedCreationsCount(child));
        state.lastSyncedAt = child.last_synced_at || state.lastSyncedAt || null;
        state.lastSyncRefreshAt = refreshedAt;
        state.lastSyncRefreshChildId = child.id || state.selectedChild?.id || "";
        state.syncRefreshLoading = false;
        saveState();
        render();

        if (!silent) {
            showToast("刷新完成");
        }
        return true;
    } catch (error) {
        console.error("刷新同步数据失败:", error);
        state.syncRefreshLoading = false;
        render();
        if (!silent) {
            showToast(error?.message || "刷新失败，请稍后重试");
        }
        return false;
    }
}

let sessionSyncInitialized = false;
let parentInitialRefreshStarted = false;

function refreshParentReportOnLoad() {
    if (parentInitialRefreshStarted) return;
    if (state.profile?.role !== "parent" || !state.selectedChild?.id) return;
    if (!window.localStorage.getItem("parentToken")) return;

    parentInitialRefreshStarted = true;
    window.setTimeout(() => {
        refreshSelectedChildSyncData({ silent: true });
    }, 0);
}

function initializeSessionSync() {
    if (!sessionSyncInitialized) {
        window.addEventListener("focus", () => {
            validateChildSession({ silent: true });
            if (childSyncEligible(state) && Date.now() - getLastSyncedTimestamp(state) >= getChildSyncIntervalMs()) {
                syncChildProgress({ silent: true });
            }
        });

        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) validateChildSession({ silent: true });
            if (!document.hidden && childSyncEligible(state) && Date.now() - getLastSyncedTimestamp(state) >= getChildSyncIntervalMs()) {
                syncChildProgress({ silent: true });
            }
        });

        window.addEventListener("storage", (event) => {
            if (event.key === CHILD_SYNC_INTERVAL_STORAGE_KEY) {
                scheduleChildAutoSync();
            }
        });

        sessionSyncInitialized = true;
    }

    scheduleChildAutoSync();
    validateChildSession({ silent: true });
    refreshParentReportOnLoad();
}

function saveState() {
    if (!state.sessionId) return;

    try {
        const persisted = clone(state);
        delete persisted.settingsOpen;
        sessionStore.sessions[state.sessionId] = mergeState(clone(defaultState), persisted);
        sessionStore.order = [state.sessionId, ...sessionStore.order.filter((id) => id !== state.sessionId)];

        // 检查localStorage容量（5MB限制）
        const sizeInBytes = BlueAnimal.storage.sizeOf(sessionStore);
        const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

        // 如果超过4MB，自动清理旧数据
        if (sizeInBytes > 4 * 1024 * 1024) {
            console.warn(`localStorage使用量: ${sizeInMB}MB，接近5MB限制，开始清理...`);

            // 按最后更新时间排序会话，保留最新的
            const sortedSessions = sessionStore.order
                .map(id => ({
                    id,
                    lastUpdate: sessionStore.sessions[id]?.progress?.activities?.[0]?.time || 0
                }))
                .sort((a, b) => b.lastUpdate - a.lastUpdate);

            // 删除最旧的30%会话（至少保留3个）
            const keepCount = Math.max(3, Math.ceil(sortedSessions.length * 0.7));
            const toDelete = sortedSessions.slice(keepCount);

            toDelete.forEach(s => delete sessionStore.sessions[s.id]);
            sessionStore.order = sortedSessions.slice(0, keepCount).map(s => s.id);

            showToast(`已清理${toDelete.length}个旧会话以释放空间`);
        }

        BlueAnimal.storage.persistent.write(STORE_KEY, sessionStore);
        BlueAnimal.storage.session.write(ACTIVE_SESSION_KEY, state.sessionId);
        scheduleChildAutoSync();
    } catch (error) {
        console.error("保存状态失败:", error);

        // 如果是容量超限错误
        if (error.name === 'QuotaExceededError') {
            // 尝试清理旧会话
            if (sessionStore.order.length > 1) {
                const oldestSession = sessionStore.order[sessionStore.order.length - 1];
                delete sessionStore.sessions[oldestSession];
                sessionStore.order = sessionStore.order.slice(0, -1);

                // 再次尝试保存
                try {
                    BlueAnimal.storage.persistent.write(STORE_KEY, sessionStore);
                    showToast("已清理旧数据并保存");
                } catch (retryError) {
                    showToast("存储空间不足，请清空记录后继续使用");
                }
            } else {
                showToast("存储空间不足，请清空部分记录");
            }
        } else {
            showToast("保存失败，请重试");
        }
    }
}

function makeSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createSession(profile) {
    const id = makeSessionId();
    state = mergeState(clone(defaultState), {
        sessionId: id,
        profile,
        route: profile.role === "parent" ? "report-overview" : "map"
    });
    addActivity("登录", `${roleLabel(profile.role)} ${profile.name}`);
    saveState();
    scheduleChildAutoSync();
}

function switchSession(id) {
    if (!sessionStore.sessions[id]) return;
    BlueAnimal.storage.session.write(ACTIVE_SESSION_KEY, id);
    state = loadState();
    // 验证当前路由是否对该角色可用
    validateAndFixRoute();
    scheduleChildAutoSync();
    validateChildSession({ silent: true });
    render();
}

function validateAndFixRoute() {
    if (!state.profile) return;
    const availableRoutes = getAvailableRoutes();
    const currentRouteValid = availableRoutes.find(r => r.id === state.route);
    if (!currentRouteValid) {
        // 如果当前路由不可用，跳转到该角色的默认路由
        state.route = state.profile.role === "parent" ? "report-overview" : "map";
        saveState();
    }
}

function logoutCurrentSession() {
    BlueAnimal.storage.session.remove(ACTIVE_SESSION_KEY);
    clearChildAutoSyncTimer();
    clearChildSessionCheckTimer();
    state = clone(defaultState);
    render();
}

function savedSessions() {
    return sessionStore.order
        .map((id) => sessionStore.sessions[id])
        .filter((item) => item && item.profile);
}

window.addEventListener("load", initializeSessionSync);
