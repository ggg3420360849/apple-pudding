let sessionStore = loadSessionStore();
let state = loadState();
const app = document.getElementById("app");
let draggedCreaturePart = null;
const creaturePointers = new Map();
let creatureGesture = null;

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
    merged.progress = { ...base.progress, ...(saved.progress || {}) };
    merged.draftCreature = { ...base.draftCreature, ...(saved.draftCreature || {}) };
    merged.draftCreature.transforms = {
        ...base.draftCreature.transforms,
        ...((saved.draftCreature || {}).transforms || {})
    };
    merged.animalUnlocks = { ...base.animalUnlocks, ...(saved.animalUnlocks || {}) };
    return merged;
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
                    showToast("存储空间不足，请导出数据后清空记录");
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
}

function switchSession(id) {
    if (!sessionStore.sessions[id]) return;
    BlueAnimal.storage.session.write(ACTIVE_SESSION_KEY, id);
    state = loadState();
    // 验证当前路由是否对该角色可用
    validateAndFixRoute();
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
    state = clone(defaultState);
    render();
}

function savedSessions() {
    return sessionStore.order
        .map((id) => sessionStore.sessions[id])
        .filter((item) => item && item.profile);
}
