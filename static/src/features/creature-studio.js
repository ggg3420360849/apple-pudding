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
    state.draftCreature.snapshot = "";
    state.draftCreature.selectedPart = type;
    creatureTransform(type);
    if (type === "head") {
        state.draftCreature.head = normalizeCreatureHead(id);
        if (!parts.includes("head")) parts.push("head");
    }
    if (type === "body") {
        state.draftCreature.body = normalizeCreatureBody(id);
        if (!parts.includes("body")) parts.push("body");
    }
    if (type === "leftHand" || type === "rightHand") {
        state.draftCreature[type] = normalizeCreatureHand(id) || creatureHands[0].id;
        if (!parts.includes(type)) parts.push(type);
    }
    if (type === "leftFoot" || type === "rightFoot") {
        state.draftCreature[type] = normalizeCreatureFoot(id) || creatureFeet[0].id;
        if (!parts.includes(type)) parts.push(type);
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
    state.draftCreature.snapshot = "";
    const transform = creatureTransform(part);
    const elements = document.querySelectorAll(
        `.imagine-stage [data-composition-part="${part}"]`
    );
    elements.forEach((element) => {
        element.style.setProperty("--part-scale", transform.scale / 100);
        element.style.setProperty("--part-rotation", `${transform.rotation}deg`);
        element.style.setProperty("--part-x", `${transform.x}px`);
        element.style.setProperty("--part-y", `${transform.y}px`);
    });
}

function resetCreaturePartTransform() {
    const part = activeCreaturePart();
    state.draftCreature.transforms[part] = defaultCreatureTransform(part);
    saveState();
    render();
    showToast(`已恢复${{ head: "头", body: "身体", leftHand: "左手", rightHand: "右手", leftFoot: "左脚", rightFoot: "右脚", wing: "翅膀", tail: "尾巴", decoration: "装饰" }[part]}默认位置`);
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
    state.draftCreature.head = "";
    state.draftCreature.body = "";
    state.draftCreature.leftHand = "";
    state.draftCreature.rightHand = "";
    state.draftCreature.leftFoot = "";
    state.draftCreature.rightFoot = "";
    state.draftCreature.hand = "";
    state.draftCreature.foot = "";
    state.draftCreature.wing = "";
    state.draftCreature.tail = "";
    state.draftCreature.decoration = "";
    state.draftCreature.snapshot = "";
    state.draftCreature.parts = [];
    state.draftCreature.selectedPart = "";
    state.draftCreature.transforms = clone(defaultState.draftCreature.transforms);
    saveState();
    render();
    showToast("画布已清空");
}

function creaturePartLabelsFromDraft(draft = state.draftCreature) {
    const parts = Array.isArray(draft.parts) ? draft.parts : [];
    const handMap = Object.fromEntries(creatureHands.map((item) => [item.id, item.label]));
    const footMap = Object.fromEntries(creatureFeet.map((item) => [item.id, item.label]));
    const wingMap = Object.fromEntries(creatureWings.map((item) => [item.id, item.label]));
    const tailMap = Object.fromEntries(creatureTails.map((item) => [item.id, item.label]));
    const decorationMap = Object.fromEntries(creatureDecorations.map((item) => [item.id, item.label]));
    return [
        parts.includes("head") && draft.head ? "头" : null,
        parts.includes("body") && draft.body ? "身体" : null,
        parts.includes("leftHand") && draft.leftHand ? `左手：${handMap[normalizeCreatureHand(draft.leftHand)]}` : null,
        parts.includes("rightHand") && draft.rightHand ? `右手：${handMap[normalizeCreatureHand(draft.rightHand)]}` : null,
        parts.includes("leftFoot") && draft.leftFoot ? `左脚：${footMap[normalizeCreatureFoot(draft.leftFoot)]}` : null,
        parts.includes("rightFoot") && draft.rightFoot ? `右脚：${footMap[normalizeCreatureFoot(draft.rightFoot)]}` : null,
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
    if (rawParts.has("leftHand") || rawParts.has("rightHand") || /手/.test(partText)) abilities.push("用小手轻轻抱住喜欢的东西");
    if (rawParts.has("leftFoot") || rawParts.has("rightFoot") || /脚/.test(partText)) abilities.push("用小脚稳稳走过新的地方");
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

function creatureCssMatrix(transform) {
    if (!transform || transform === "none") return [1, 0, 0, 1, 0, 0];
    const match = transform.match(/^matrix\(([^)]+)\)$/);
    if (!match) return [1, 0, 0, 1, 0, 0];
    const values = match[1].split(",").map(Number);
    return values.length === 6 && values.every(Number.isFinite) ? values : [1, 0, 0, 1, 0, 0];
}

function creatureElementOffset(element, ancestor) {
    let x = 0;
    let y = 0;
    let current = element;
    while (current && current !== ancestor) {
        x += current.offsetLeft || 0;
        y += current.offsetTop || 0;
        current = current.offsetParent;
    }
    return { x, y };
}

function waitForCreatureImage(image) {
    if (image.complete && image.naturalWidth) return Promise.resolve();
    return new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", reject, { once: true });
    });
}

async function captureCreatureSnapshot() {
    const stage = document.querySelector(".imagine-stage");
    if (!stage) return "";
    const elements = [...stage.querySelectorAll("[data-composition-part]")].sort((left, right) => {
        const leftLayer = Number.parseInt(window.getComputedStyle(left).zIndex, 10) || 0;
        const rightLayer = Number.parseInt(window.getComputedStyle(right).zIndex, 10) || 0;
        return leftLayer - rightLayer;
    });
    if (!elements.length) return "";

    const images = elements.map((element) => element.tagName === "IMG" ? element : element.querySelector("img")).filter(Boolean);
    await Promise.all(images.map(waitForCreatureImage));

    const source = document.createElement("canvas");
    source.width = Math.max(1, stage.clientWidth);
    source.height = Math.max(1, stage.clientHeight);
    const context = source.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    elements.forEach((element) => {
        const image = element.tagName === "IMG" ? element : element.querySelector("img");
        if (!image?.naturalWidth || !element.offsetWidth || !element.offsetHeight) return;
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return;
        const [a, b, c, d, e, f] = creatureCssMatrix(style.transform);
        const originValues = style.transformOrigin.split(" ").map(parseFloat);
        const originX = Number.isFinite(originValues[0]) ? originValues[0] : element.offsetWidth / 2;
        const originY = Number.isFinite(originValues[1]) ? originValues[1] : element.offsetHeight / 2;
        const offset = creatureElementOffset(element, stage);

        context.save();
        context.translate(offset.x + originX, offset.y + originY);
        context.transform(a, b, c, d, e, f);
        context.translate(-originX, -originY);

        const part = element.dataset.compositionPart || "";
        if (["leftHand", "rightHand", "leftFoot", "rightFoot"].includes(part)) {
            const isLeft = part.startsWith("left");
            const sourceWidth = image.naturalWidth / 2;
            context.drawImage(
                image,
                isLeft ? 0 : sourceWidth,
                0,
                sourceWidth,
                image.naturalHeight,
                0,
                0,
                element.offsetWidth,
                element.offsetHeight
            );
        } else {
            context.drawImage(image, 0, 0, element.offsetWidth, element.offsetHeight);
        }
        context.restore();
    });

    const pixels = context.getImageData(0, 0, source.width, source.height).data;
    let minX = source.width;
    let minY = source.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < source.height; y += 1) {
        for (let x = 0; x < source.width; x += 1) {
            if (pixels[(y * source.width + x) * 4 + 3] < 8) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }
    if (maxX < minX || maxY < minY) return "";

    const output = document.createElement("canvas");
    output.width = 256;
    output.height = 256;
    const outputContext = output.getContext("2d");
    outputContext.imageSmoothingEnabled = true;
    outputContext.imageSmoothingQuality = "high";
    const padding = 12;
    const contentWidth = maxX - minX + 1;
    const contentHeight = maxY - minY + 1;
    const scale = Math.min((output.width - padding * 2) / contentWidth, (output.height - padding * 2) / contentHeight);
    const drawWidth = contentWidth * scale;
    const drawHeight = contentHeight * scale;
    outputContext.drawImage(
        source,
        minX,
        minY,
        contentWidth,
        contentHeight,
        (output.width - drawWidth) / 2,
        (output.height - drawHeight) / 2,
        drawWidth,
        drawHeight
    );
    const webp = output.toDataURL("image/webp", 0.9);
    return webp.startsWith("data:image/webp") ? webp : output.toDataURL("image/png");
}

async function saveCreature() {
    updateCreatureDraft();
    const saveButton = document.querySelector('[data-action="save-creature"]');
    if (saveButton?.disabled) return;
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "正在收进动物册…";
    }
    let snapshot = "";
    try {
        snapshot = await captureCreatureSnapshot();
    } catch (error) {
        console.warn("生成动物截图失败", error);
    }
    if (!snapshot) {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "放进动物册 ✦";
        }
        showToast("请先在画布上放一些动物部件");
        return;
    }
    state.draftCreature.snapshot = snapshot;
    const item = {
        ...clone(state.draftCreature),
        snapshot,
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
        hands.length && "leftHand",
        hands.length && "rightHand",
        feet.length && "leftFoot",
        feet.length && "rightFoot",
        wings.length && "wing",
        tails.length && "tail",
        decorations.length && "decoration"
    ].filter(Boolean);
    state.draftCreature = {
        canvasVersion: defaultState.draftCreature.canvasVersion,
        name: pick(names),
        habitat: pick(habitats),
        mood: pick(moods),
        color: "#8fc6f5",
        head: heads.length ? pick(heads) : "panda",
        body: pick(bodies),
        leftHand: hands.length ? pick(hands) : "",
        rightHand: hands.length ? pick(hands) : "",
        leftFoot: feet.length ? pick(feet) : "",
        rightFoot: feet.length ? pick(feet) : "",
        wing: wings.length ? pick(wings) : "",
        tail: tails.length ? pick(tails) : "",
        decoration: decorations.length ? pick(decorations) : "",
        snapshot: "",
        parts: availableParts,
        selectedPart: "body",
        transforms: {
            head: { scale: 80 + Math.floor(Math.random() * 51), rotation: -12 + Math.floor(Math.random() * 25), x: -12 + Math.floor(Math.random() * 25), y: -10 + Math.floor(Math.random() * 21) },
            body: { scale: 80 + Math.floor(Math.random() * 61), rotation: -8 + Math.floor(Math.random() * 17), x: -10 + Math.floor(Math.random() * 21), y: -10 + Math.floor(Math.random() * 21) },
            leftHand: { scale: 70 + Math.floor(Math.random() * 81), rotation: -18 + Math.floor(Math.random() * 37), x: -20 + Math.floor(Math.random() * 41), y: -18 + Math.floor(Math.random() * 37) },
            rightHand: { scale: 70 + Math.floor(Math.random() * 81), rotation: -18 + Math.floor(Math.random() * 37), x: -20 + Math.floor(Math.random() * 41), y: -18 + Math.floor(Math.random() * 37) },
            leftFoot: { scale: 70 + Math.floor(Math.random() * 81), rotation: -12 + Math.floor(Math.random() * 25), x: -18 + Math.floor(Math.random() * 37), y: -16 + Math.floor(Math.random() * 33) },
            rightFoot: { scale: 70 + Math.floor(Math.random() * 81), rotation: -12 + Math.floor(Math.random() * 25), x: -18 + Math.floor(Math.random() * 37), y: -16 + Math.floor(Math.random() * 33) },
            wing: { scale: 70 + Math.floor(Math.random() * 81), rotation: -25 + Math.floor(Math.random() * 51), x: -25 + Math.floor(Math.random() * 51), y: -18 + Math.floor(Math.random() * 37) },
            tail: { scale: 70 + Math.floor(Math.random() * 81), rotation: -35 + Math.floor(Math.random() * 71), x: -25 + Math.floor(Math.random() * 51), y: -18 + Math.floor(Math.random() * 37) },
            decoration: { scale: 70 + Math.floor(Math.random() * 71), rotation: -20 + Math.floor(Math.random() * 41), x: -18 + Math.floor(Math.random() * 37), y: -12 + Math.floor(Math.random() * 25) }
        }
    };
    saveState();
    render();
    showToast(`灵感来了：${state.draftCreature.name}`);
}
