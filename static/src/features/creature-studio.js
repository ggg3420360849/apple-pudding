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
    if (type === "head") {
        state.draftCreature.head = normalizeCreatureHead(id);
    }
    if (type === "body") {
        state.draftCreature.body = normalizeCreatureBody(id);
    }
    if (type === "hand") {
        state.draftCreature.hand = normalizeCreatureHand(id) || creatureHands[0].id;
        if (!parts.includes("hand")) parts.push("hand");
    }
    if (type === "foot") {
        state.draftCreature.foot = normalizeCreatureFoot(id) || creatureFeet[0].id;
        if (!parts.includes("foot")) parts.push("foot");
    }
    if (type === "wing") {
        state.draftCreature.wing = normalizeCreatureWing(id) || creatureWings[0].id;
        if (!parts.includes("wing")) parts.push("wing");
    }
    if (type === "tail") {
        state.draftCreature.tail = normalizeCreatureTail(id) || creatureTails[0].id;
        if (!parts.includes("tail")) parts.push("tail");
    }
    if (type === "decoration") {
        state.draftCreature.decoration = normalizeCreatureDecoration(id) || creatureDecorations[0]?.id || "";
        if (!parts.includes("decoration")) parts.push("decoration");
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
    element.style.setProperty("--part-rotation", `${transform.rotation}deg`);
    element.style.setProperty("--part-x", `${transform.x}px`);
    element.style.setProperty("--part-y", `${transform.y}px`);
}

function resetCreaturePartTransform() {
    const part = activeCreaturePart();
    state.draftCreature.transforms[part] = defaultCreatureTransform(part);
    saveState();
    render();
    showToast(`已恢复${{ head: "头", body: "身体", hand: "手", foot: "脚", wing: "翅膀", tail: "尾巴", decoration: "装饰" }[part]}默认位置`);
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
    transform.rotation = Math.max(-180, Math.min(180, Math.round(
        creatureGesture.rotation + creaturePointerAngle(pair) - creatureGesture.angle
    )));
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
    state.draftCreature.hand = "";
    state.draftCreature.foot = "";
    state.draftCreature.wing = "";
    state.draftCreature.tail = "";
    state.draftCreature.decoration = "";
    state.draftCreature.parts = [];
    state.draftCreature.selectedPart = "body";
    state.draftCreature.transforms = clone(defaultState.draftCreature.transforms);
    saveState();
    render();
    showToast("已清除配件");
}

function creaturePartLabelsFromDraft(draft = state.draftCreature) {
    const parts = Array.isArray(draft.parts) ? draft.parts : [];
    const handMap = Object.fromEntries(creatureHands.map((item) => [item.id, item.label]));
    const footMap = Object.fromEntries(creatureFeet.map((item) => [item.id, item.label]));
    const wingMap = Object.fromEntries(creatureWings.map((item) => [item.id, item.label]));
    const tailMap = Object.fromEntries(creatureTails.map((item) => [item.id, item.label]));
    const decorationMap = Object.fromEntries(creatureDecorations.map((item) => [item.id, item.label]));
    return [
        "头",
        "身体",
        parts.includes("hand") && draft.hand ? handMap[normalizeCreatureHand(draft.hand)] : null,
        parts.includes("foot") && draft.foot ? footMap[normalizeCreatureFoot(draft.foot)] : null,
        parts.includes("wing") && draft.wing ? wingMap[normalizeCreatureWing(draft.wing)] : null,
        parts.includes("tail") && draft.tail ? tailMap[normalizeCreatureTail(draft.tail)] : null,
        parts.includes("decoration") && draft.decoration ? decorationMap[normalizeCreatureDecoration(draft.decoration)] : null
    ].filter(Boolean);
}

function creatureAbilityLine(draft = state.draftCreature) {
    const parts = Array.isArray(draft.parts) ? draft.parts : [];
    const rawParts = new Set(parts);
    const partText = parts.join("、");
    const abilities = [];
    if (rawParts.has("hand") || /手/.test(partText)) abilities.push("用小手轻轻抱住喜欢的东西");
    if (rawParts.has("foot") || /脚/.test(partText)) abilities.push("用小脚稳稳走过新的地方");
    if (rawParts.has("wing") || /翼|翅/.test(partText)) abilities.push("轻轻一跳就能把风叫来");
    if (rawParts.has("tail") || /尾/.test(partText)) abilities.push("用尾巴给朋友指路");
    if (rawParts.has("decoration") || /装饰|竹/.test(partText)) abilities.push("带着特别装饰收集一路上的新发现");
    if (!abilities.length) abilities.push("安安静静观察世界里的小秘密");
    return abilities.join("，");
}

function creatureStoryLine(draft = state.draftCreature) {
    const name = draft.name || "新朋友";
    const habitat = draft.habitat || "秘密花园";
    const mood = draft.mood || "好奇";
    return `${name}住在${habitat}，性格${mood}，${creatureAbilityLine(draft)}。`;
}

function showCreatureCelebration(item) {
    const app = document.getElementById("app");
    if (!app) return;
    const card = document.createElement("div");
    card.className = "creature-save-celebration";
    card.innerHTML = `
        <span class="celebration-kicker">收进动物册</span>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${escapeHtml(item.story || creatureStoryLine(item))}</small>
    `;
    app.appendChild(card);
    window.setTimeout(() => card.remove(), 2200);
}

function saveCreature() {
    updateCreatureDraft();
    const item = {
        ...clone(state.draftCreature),
        parts: creaturePartLabelsFromDraft(state.draftCreature),
        ability: creatureAbilityLine(state.draftCreature),
        story: creatureStoryLine(state.draftCreature),
        time: Date.now()
    };
    state.creations.unshift(item);
    state.creations = state.creations.slice(0, 12);
    state.progress.creations += 1;
    addActivity("创作", item.name);
    saveState();
    render();
    showCreatureCelebration(item);
    showToast("已收藏想象动物");
}

function randomCreature() {
    const names = ["云朵熊鸟", "星星贝贝兽", "蒲公英飞飞兽", "果冻潜水兽", "月亮慢慢兽", "糖霜跳跳兽", "星河小灯兽"];
    const habitats = ["云朵森林", "贝壳海湾", "薄荷草原", "月光山谷", "水晶湿地", "糖果山洞", "风车花园"];
    const moods = ["好奇", "勇敢", "温柔", "爱唱歌", "慢悠悠"];
    const bodies = creatureBodies.map((item) => item.id);
    const heads = creatureHeads.map((item) => item.id);
    const hands = creatureHands.map((item) => item.id);
    const feet = creatureFeet.map((item) => item.id);
    const wings = creatureWings.map((item) => item.id);
    const tails = creatureTails.map((item) => item.id);
    const decorations = creatureDecorations.map((item) => item.id);
    const availableParts = [
        hands.length && "hand",
        feet.length && "foot",
        wings.length && "wing",
        tails.length && "tail",
        decorations.length && "decoration"
    ].filter(Boolean);
    state.draftCreature = {
        name: pick(names),
        habitat: pick(habitats),
        mood: pick(moods),
        color: "#8fc6f5",
        head: heads.length ? pick(heads) : "panda",
        body: pick(bodies),
        hand: hands.length ? pick(hands) : "",
        foot: feet.length ? pick(feet) : "",
        wing: wings.length ? pick(wings) : "",
        tail: tails.length ? pick(tails) : "",
        decoration: decorations.length ? pick(decorations) : "",
        parts: availableParts,
        selectedPart: "body",
        transforms: {
            head: { scale: 80 + Math.floor(Math.random() * 51), rotation: -12 + Math.floor(Math.random() * 25), x: -12 + Math.floor(Math.random() * 25), y: -10 + Math.floor(Math.random() * 21) },
            body: { scale: 80 + Math.floor(Math.random() * 61), rotation: -8 + Math.floor(Math.random() * 17), x: -10 + Math.floor(Math.random() * 21), y: -10 + Math.floor(Math.random() * 21) },
            hand: { scale: 70 + Math.floor(Math.random() * 81), rotation: -18 + Math.floor(Math.random() * 37), x: -20 + Math.floor(Math.random() * 41), y: -18 + Math.floor(Math.random() * 37) },
            foot: { scale: 70 + Math.floor(Math.random() * 81), rotation: -12 + Math.floor(Math.random() * 25), x: -18 + Math.floor(Math.random() * 37), y: -16 + Math.floor(Math.random() * 33) },
            wing: { scale: 70 + Math.floor(Math.random() * 81), rotation: -25 + Math.floor(Math.random() * 51), x: -25 + Math.floor(Math.random() * 51), y: -18 + Math.floor(Math.random() * 37) },
            tail: { scale: 70 + Math.floor(Math.random() * 81), rotation: -35 + Math.floor(Math.random() * 71), x: -25 + Math.floor(Math.random() * 51), y: -18 + Math.floor(Math.random() * 37) },
            decoration: { scale: 70 + Math.floor(Math.random() * 71), rotation: -20 + Math.floor(Math.random() * 41), x: -18 + Math.floor(Math.random() * 37), y: -12 + Math.floor(Math.random() * 25) }
        }
    };
    saveState();
    render();
    showToast(`灵感来了：${state.draftCreature.name}`);
}
