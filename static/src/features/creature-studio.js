function updateCreatureDraft() {
    const name = document.getElementById("creatureName");
    const habitat = document.getElementById("creatureHabitat");
    const mood = document.getElementById("creatureMood");
    if (name) state.draftCreature.name = name.value.trim() || "无名小动物";
    if (habitat) state.draftCreature.habitat = habitat.value.trim() || "秘密花园";
    if (mood) state.draftCreature.mood = mood.value;
}

function ensureCreatureParts() {
    if (!Array.isArray(state.draftCreature.parts)) state.draftCreature.parts = [];
    return state.draftCreature.parts;
}

function applyCreaturePart(type, id) {
    const parts = ensureCreatureParts();
    state.draftCreature.selectedPart = type;
    creatureTransform(type);
    if (type === "body") {
        state.draftCreature.body = normalizeCreatureBody(id);
    }
    if (type === "wing") {
        state.draftCreature.wing = normalizeCreatureWing(id) || "angel";
        if (!parts.includes("wing")) parts.push("wing");
    }
    if (type === "tail") {
        state.draftCreature.tail = normalizeCreatureTail(id) || "fox";
        if (!parts.includes("tail")) parts.push("tail");
    }
    if (type === "horn" && !parts.includes("horn")) {
        parts.push("horn");
    }
    saveState();
    renderImagineWithoutJump();
}

function applyCreatureTransformToStage(part) {
    const element = document.querySelector(`[data-edit-part="${part}"]`)
        || (part === "body" ? document.querySelector(".asset-body") : null);
    if (!element) return;
    const transform = creatureTransform(part);
    element.style.setProperty("--part-scale", transform.scale / 100);
    if (part !== "body") {
        element.style.setProperty("--part-rotation", `${transform.rotation}deg`);
        element.style.setProperty("--part-x", `${transform.x}px`);
        element.style.setProperty("--part-y", `${transform.y}px`);
    }
}

function resetCreaturePartTransform() {
    const part = activeCreaturePart();
    state.draftCreature.transforms[part] = defaultCreatureTransform(part);
    saveState();
    render();
    showToast(`已恢复${{ body: "身体", wing: "翅膀", tail: "尾巴", horn: "星角" }[part]}默认位置`);
}

function creaturePointerPair() {
    return [...creaturePointers.values()].slice(0, 2);
}

function creaturePointerDistance(pair) {
    return Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y);
}

function creaturePointerAngle(pair) {
    return Math.atan2(pair[1].y - pair[0].y, pair[1].x - pair[0].x) * 180 / Math.PI;
}

function beginCreatureGesture(part) {
    const pair = creaturePointerPair();
    if (pair.length < 2) return;
    const transform = creatureTransform(part);
    creatureGesture = {
        part,
        distance: Math.max(1, creaturePointerDistance(pair)),
        angle: creaturePointerAngle(pair),
        scale: transform.scale,
        rotation: transform.rotation
    };
}

function updateCreatureGesture() {
    const pair = creaturePointerPair();
    if (!creatureGesture || pair.length < 2) return;
    const transform = creatureTransform(creatureGesture.part);
    transform.scale = Math.max(40, Math.min(180, Math.round(
        creatureGesture.scale * creaturePointerDistance(pair) / creatureGesture.distance
    )));
    if (creatureGesture.part !== "body") {
        transform.rotation = Math.max(-180, Math.min(180, Math.round(
            creatureGesture.rotation + creaturePointerAngle(pair) - creatureGesture.angle
        )));
    }
    applyCreatureTransformToStage(creatureGesture.part);
}

function finishCreaturePartDrag(event) {
    if (!creaturePointers.has(event.pointerId)) return;
    creaturePointers.delete(event.pointerId);
    if (draggedCreaturePart?.pointerId === event.pointerId) draggedCreaturePart = null;
    if (creaturePointers.size < 2) creatureGesture = null;
    saveState();
}

function clearCreatureParts() {
    updateCreatureDraft();
    state.draftCreature.wing = "";
    state.draftCreature.tail = "";
    state.draftCreature.parts = [];
    state.draftCreature.selectedPart = "body";
    state.draftCreature.transforms = clone(defaultState.draftCreature.transforms);
    saveState();
    render();
    showToast("已清除配件");
}

function saveCreature() {
    updateCreatureDraft();
    const currentParts = Array.isArray(state.draftCreature.parts) ? state.draftCreature.parts : [];
    const partsMap = { wing: "会飞翔", tail: "会平衡", horn: "会发光" };
    const wingMap = Object.fromEntries(creatureWings.map((item) => [item.id, item.label]));
    const tailMap = Object.fromEntries(creatureTails.map((item) => [item.id, item.label]));
    const item = {
        ...clone(state.draftCreature),
        parts: [
            state.draftCreature.wing ? wingMap[normalizeCreatureWing(state.draftCreature.wing)] : null,
            state.draftCreature.tail ? tailMap[normalizeCreatureTail(state.draftCreature.tail)] : null,
            ...currentParts.filter((part) => !["wing", "tail"].includes(part)).map((part) => partsMap[part] || part)
        ].filter(Boolean),
        time: Date.now()
    };
    state.creations.unshift(item);
    state.creations = state.creations.slice(0, 12);
    state.progress.creations += 1;
    addActivity("创作", item.name);
    saveState();
    render();
    showToast("已收藏想象动物");
}

function randomCreature() {
    const names = ["云朵熊鸟", "星星贝贝兽", "蒲公英飞飞兽", "果冻潜水兽", "月亮慢慢兽"];
    const habitats = ["云朵森林", "贝壳海湾", "薄荷草原", "月光山谷", "水晶湿地"];
    const moods = ["好奇", "勇敢", "温柔", "爱唱歌", "慢悠悠"];
    const bodies = creatureBodies.map((item) => item.id);
    const wings = creatureWings.map((item) => item.id);
    const tails = creatureTails.map((item) => item.id);
    const partSets = [["wing"], ["tail"], ["horn"], ["wing", "tail"], ["wing", "horn"], ["tail", "horn"]];
    state.draftCreature = {
        name: pick(names),
        habitat: pick(habitats),
        mood: pick(moods),
        color: "#8fc6f5",
        body: pick(bodies),
        wing: pick(wings),
        tail: pick(tails),
        parts: pick(partSets),
        selectedPart: "body",
        transforms: {
            body: { scale: 80 + Math.floor(Math.random() * 61) },
            wing: { scale: 70 + Math.floor(Math.random() * 81), rotation: -25 + Math.floor(Math.random() * 51), x: -25 + Math.floor(Math.random() * 51), y: -18 + Math.floor(Math.random() * 37) },
            tail: { scale: 70 + Math.floor(Math.random() * 81), rotation: -35 + Math.floor(Math.random() * 71), x: -25 + Math.floor(Math.random() * 51), y: -18 + Math.floor(Math.random() * 37) },
            horn: { scale: 70 + Math.floor(Math.random() * 71), rotation: -20 + Math.floor(Math.random() * 41), x: -18 + Math.floor(Math.random() * 37), y: -12 + Math.floor(Math.random() * 25) }
        }
    };
    saveState();
    render();
}
