const DAILY_QUIZ_COUNT = 4;
const CARE_EVENT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CARE_EVENT_JITTER_MS = 90 * 60 * 1000;
const HUNGRY_EVENT_SICK_AFTER_MS = 2 * 60 * 60 * 1000;
const CARE_EVENT_NOW_PARAM = "careEventNow";
const hungryCareTimers = new Map();
const CARE_ILLNESS_TYPES = [
    { id: "wrong-food", title: "肚子不舒服", cause: "可能刚才吃了不适合的东西。", action: "观察精神和排便，多喝水，先不要乱喂食。" },
    { id: "sports-injury", title: "运动小擦伤", cause: "玩耍时可能不小心扭到或擦到了。", action: "先安静休息，看看走路和精神有没有异常。" },
    { id: "tired", title: "有点没精神", cause: "可能活动太久，需要休息。", action: "让它待在安静舒适的地方，观察一会儿。" },
    { id: "cold", title: "有点着凉", cause: "环境温度可能不太舒服。", action: "保持环境稳定，不要忽冷忽热。" }
];

function shuffleList(list) {
    return [...list].sort(() => Math.random() - 0.5);
}

function consumeCareEventNowRequest(animalId) {
    if (!window.location.search.includes(CARE_EVENT_NOW_PARAM)) return false;

    const params = new URLSearchParams(window.location.search);
    if (!params.has(CARE_EVENT_NOW_PARAM)) return false;

    const requestId = params.get(CARE_EVENT_NOW_PARAM) || "1";
    const storageKey = `applePuddingCareEventNow:${animalId}:${requestId}`;
    if (window.sessionStorage.getItem(storageKey)) return false;

    window.sessionStorage.setItem(storageKey, "1");
    params.delete(CARE_EVENT_NOW_PARAM);
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
    return true;
}

function getFoodInventory(animalId) {
    if (!state.foodInventory) state.foodInventory = {};
    if (!state.foodInventory[animalId]) state.foodInventory[animalId] = {};
    return state.foodInventory[animalId];
}

function getFoodCount(animalId, food) {
    return Number(getFoodInventory(animalId)[food] || 0);
}

function addFoodToInventory(animalId, food, count = 1) {
    const inventory = getFoodInventory(animalId);
    inventory[food] = Number(inventory[food] || 0) + count;
}

function consumeFoodFromInventory(animalId, food) {
    const inventory = getFoodInventory(animalId);
    if (Number(inventory[food] || 0) <= 0) return false;
    inventory[food] -= 1;
    if (inventory[food] <= 0) delete inventory[food];
    return true;
}

function getAnimalIntimacy(animalId) {
    if (!state.animalIntimacy) state.animalIntimacy = {};
    return Number(state.animalIntimacy[animalId] || 0);
}

function increaseAnimalIntimacy(animalId, amount = 1) {
    if (!state.animalIntimacy) state.animalIntimacy = {};
    state.animalIntimacy[animalId] = getAnimalIntimacy(animalId) + amount;
    return state.animalIntimacy[animalId];
}

function getCareRisk(animalId) {
    if (!state.careEventRisk) state.careEventRisk = {};
    return Number(state.careEventRisk[animalId] || 0);
}

function changeCareRisk(animalId, amount) {
    if (!state.careEventRisk) state.careEventRisk = {};
    state.careEventRisk[animalId] = Math.max(0, Math.min(5, getCareRisk(animalId) + amount));
}

function getStaticQuizCandidates(animal) {
    return [animal.quiz, ...(animalQuizBank[animal.id] || [])].filter(Boolean);
}

function normalizeDailyQuizCandidate(candidate, animal) {
    const question = String(candidate?.question || "").trim();
    const options = Array.isArray(candidate?.options)
        ? candidate.options.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
        : [];
    let answer = Number(candidate?.answer);

    if (!Number.isInteger(answer)) {
        answer = options.findIndex((option) => option === String(candidate?.answer || "").trim());
    }
    if (answer > 2 && answer <= 3) {
        answer -= 1;
    }

    if (!question || options.length !== 3 || answer < 0 || answer > 2) {
        return null;
    }

    return {
        question: question.length > 34 ? `${question.slice(0, 33)}…` : question,
        options,
        answer
    };
}

function buildDailyQuizPrompt(animal) {
    return `你是儿童动物科普老师。请为${animal.name}生成今天的4道选择题，给5-8岁孩子使用。

动物信息：
- 栖息地：${animal.habitat}
- 食物：${animal.diet}
- 特点：${animal.fact}
- 照护：${animal.care}

要求：
1. 题型要多一些，分别覆盖食物、栖息地、身体本领、照护/保护。
2. 每题3个选项，只有1个正确答案。
3. 不要重复同一种问法。
4. 只输出JSON数组，不要解释。
5. answer用0、1、2表示正确选项下标。

格式：
[{"question":"${animal.name}最常吃什么？","options":["正确项","干扰项","干扰项"],"answer":0}]`;
}

function parseDailyQuizCandidates(rawReply, animal) {
    const text = String(rawReply || "").trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    try {
        const parsed = JSON.parse(match[0]);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((item) => normalizeDailyQuizCandidate(item, animal)).filter(Boolean);
    } catch (error) {
        console.warn("解析每日题单失败:", error);
        return [];
    }
}

function buildFallbackDailyQuizzes(animal) {
    const profile = getAnimalCareProfile(animal);
    const fallback = [
        ...getStaticQuizCandidates(animal),
        {
            question: `${animal.name}喜欢吃哪种食物？`,
            options: [profile.favoriteFood, "巧克力", "玩具车"],
            answer: 0
        },
        {
            question: `照顾${animal.name}要注意什么？`,
            options: ["了解它的习性", "随便乱喂", "一直吓它"],
            answer: 0
        }
    ];

    const unique = [];
    const seen = new Set();
    fallback.forEach((quiz) => {
        const normalized = normalizeDailyQuizCandidate(quiz, animal);
        if (!normalized || seen.has(normalized.question)) return;
        seen.add(normalized.question);
        unique.push(normalized);
    });

    return unique.slice(0, DAILY_QUIZ_COUNT);
}

async function ensureDailyQuizSet(animal, force = false) {
    if (!state.dailyQuizSets) state.dailyQuizSets = {};
    if (!state.dailyQuizGeneration) state.dailyQuizGeneration = {};

    const existing = getDailyQuizSet(animal);
    if (existing && !force) return existing;
    if (state.dailyQuizGeneration[animal.id]) return null;

    state.dailyQuizGeneration[animal.id] = true;
    saveState();
    render();

    let questions = [];
    let source = "本地题库";

    try {
        const data = await BlueAnimal.chat.ask({
            mode: "qa",
            message: buildDailyQuizPrompt(animal),
            animal: animal.name,
            model: state.model
        });
        questions = parseDailyQuizCandidates(data.reply, animal);
        source = data.model ? `模型：${data.model}` : "模型生成";
    } catch (error) {
        console.error("每日题单生成失败，使用本地题库:", error);
    }

    const fallback = buildFallbackDailyQuizzes(animal);
    const seen = new Set();
    questions = [...questions, ...fallback].filter((quiz) => {
        if (!quiz || seen.has(quiz.question)) return false;
        seen.add(quiz.question);
        return true;
    }).slice(0, DAILY_QUIZ_COUNT);

    state.dailyQuizSets[animal.id] = {
        date: getDateKey(),
        questions,
        answers: {},
        generatedAt: Date.now(),
        source
    };
    if (!state.quizCursor) state.quizCursor = {};
    state.quizCursor[animal.id] = 0;
    state.lastQuiz = null;
    delete state.dailyQuizGeneration[animal.id];
    saveState();
    render();

    return state.dailyQuizSets[animal.id];
}

function scheduleDailyQuizGeneration(animal) {
    if (getDailyQuizSet(animal) || state.dailyQuizGeneration?.[animal.id]) return;
    window.setTimeout(() => ensureDailyQuizSet(animal), 0);
}

function getDailyQuizProgress(animal) {
    const dailySet = getDailyQuizSet(animal);
    const answers = dailySet?.answers || {};
    const answered = Object.keys(answers).length;
    const correct = Object.values(answers).filter((item) => item?.correct).length;
    return {
        date: dailySet?.date || getDateKey(),
        answered,
        correct,
        total: DAILY_QUIZ_COUNT,
        source: dailySet?.source || "准备中",
        isGenerating: Boolean(state.dailyQuizGeneration?.[animal.id])
    };
}

function scheduleNextCareEvent(animalId, fromTime = Date.now()) {
    if (!state.careEvents) state.careEvents = {};
    const jitter = Math.floor((Math.random() * 2 - 1) * CARE_EVENT_JITTER_MS);
    state.careEvents[animalId] = {
        status: "scheduled",
        nextAt: fromTime + CARE_EVENT_INTERVAL_MS + jitter
    };
}

function buildHungerOptions(animal) {
    const profile = getAnimalCareProfile(animal);
    const safeFoods = shuffleList(Array.from(new Set([profile.favoriteFood, ...profile.edibleFoods])));
    const unsafeFoods = shuffleList(profile.unsafeFoods);
    const safeCount = Math.random() < 0.25 ? 3 : (Math.random() < 0.55 ? 2 : 1);
    const selected = [
        ...safeFoods.slice(0, safeCount).map((food) => ({ food, edible: true })),
        ...unsafeFoods.slice(0, 3 - safeCount).map((food) => ({ food, edible: false }))
    ];

    return shuffleList(selected).slice(0, 3);
}

function createHungryTimeoutSickEvent(animal, hungryEvent) {
    return {
        status: "active",
        type: "sick",
        illnessId: "missed-feeding",
        title: "饿太久不舒服",
        cause: `${getAnimalDisplayName(animal.id)}饿了很久，还没有吃到合适的食物。`,
        action: "先让它安静休息，提供少量适合的食物和水，观察精神状态。",
        createdAt: Date.now(),
        missedHungryCreatedAt: hungryEvent?.createdAt || null
    };
}

function clearHungryTimeoutCheck(animalId) {
    const timer = hungryCareTimers.get(animalId);
    if (timer) {
        window.clearTimeout(timer.timerId);
        hungryCareTimers.delete(animalId);
    }
}

function scheduleHungryTimeoutCheck(animalId, createdAt) {
    const key = `${animalId}:${createdAt || 0}`;
    const existing = hungryCareTimers.get(animalId);
    if (existing?.key === key) return;
    if (existing) window.clearTimeout(existing.timerId);

    const dueAt = Number(createdAt || Date.now()) + HUNGRY_EVENT_SICK_AFTER_MS;
    const delay = Math.max(0, dueAt - Date.now() + 100);
    const timerId = window.setTimeout(() => {
        const event = state.careEvents?.[animalId];
        if (!event || event.status !== "active" || event.type !== "hungry" || event.createdAt !== createdAt) return;

        const animal = animals.find((item) => item.id === animalId);
        if (!animal) return;

        changeCareRisk(animal.id, 1);
        state.careEvents[animal.id] = createHungryTimeoutSickEvent(animal, event);
        if (state.careFeedConfirm?.animalId === animal.id) state.careFeedConfirm = null;
        hungryCareTimers.delete(animalId);
        saveState();
        render();
    }, delay);

    hungryCareTimers.set(animalId, { key, timerId });
}

function createCareEvent(animal) {
    const risk = getCareRisk(animal.id);
    const sickChance = Math.min(0.75, 0.32 + risk * 0.12);
    const isSick = Math.random() < sickChance;

    if (isSick) {
        const illness = CARE_ILLNESS_TYPES[Math.floor(Math.random() * CARE_ILLNESS_TYPES.length)];
        return {
            status: "active",
            type: "sick",
            illnessId: illness.id,
            title: illness.title,
            cause: illness.cause,
            action: illness.action,
            createdAt: Date.now()
        };
    }

    return {
        status: "active",
        type: "hungry",
        title: "有点饿了",
        options: buildHungerOptions(animal),
        selectedOptionIndexes: [],
        createdAt: Date.now()
    };
}

function splitDoctorCareReply(reply, fallbackWhy, fallbackTreatment) {
    const text = String(reply || "").trim();
    if (!text) {
        return { why: fallbackWhy, treatment: fallbackTreatment };
    }

    const whyMatch = text.match(/(?:为什么不舒服|可能原因)[:：]?\s*([\s\S]*?)(?=\n\s*(?:\d+[.、]\s*)?(?:怎么照护|怎么治疗|照护方法|治疗建议)[:：]?|$)/);
    const treatmentMatch = text.match(/(?:怎么照护|怎么治疗|照护方法|治疗建议)[:：]?\s*([\s\S]*)/);

    return {
        why: (whyMatch?.[1] || "").trim() || fallbackWhy,
        treatment: (treatmentMatch?.[1] || "").trim() || text || fallbackTreatment
    };
}

function getActiveCareEvent(animalId) {
    const event = state.careEvents?.[animalId];
    return event?.status === "active" ? event : null;
}

function ensureCareEvent(animal) {
    if (!state.careEvents) state.careEvents = {};
    const event = state.careEvents[animal.id];
    const now = Date.now();
    const forceNow = consumeCareEventNowRequest(animal.id);

    if (!event) {
        if (forceNow) {
            state.careEvents[animal.id] = createCareEvent(animal);
            if (state.careEvents[animal.id].type === "hungry") {
                scheduleHungryTimeoutCheck(animal.id, state.careEvents[animal.id].createdAt);
            }
        } else {
            scheduleNextCareEvent(animal.id, now);
        }
        saveState();
        return state.careEvents[animal.id];
    }

    if (event.status === "scheduled" && (forceNow || now >= Number(event.nextAt || 0))) {
        state.careEvents[animal.id] = createCareEvent(animal);
        if (state.careEvents[animal.id].type === "hungry") {
            scheduleHungryTimeoutCheck(animal.id, state.careEvents[animal.id].createdAt);
        }
        saveState();
        return state.careEvents[animal.id];
    }

    if (event.status === "active"
        && event.type === "hungry"
        && now - Number(event.createdAt || now) >= HUNGRY_EVENT_SICK_AFTER_MS) {
        changeCareRisk(animal.id, 1);
        state.careEvents[animal.id] = createHungryTimeoutSickEvent(animal, event);
        clearHungryTimeoutCheck(animal.id);
        if (state.careFeedConfirm?.animalId === animal.id) state.careFeedConfirm = null;
        saveState();
        return state.careEvents[animal.id];
    }

    if (event.status === "active" && event.type === "hungry") {
        scheduleHungryTimeoutCheck(animal.id, event.createdAt);
    }

    return event;
}

function careEventToAnimalState(event) {
    if (!event || event.status !== "active") return null;
    if (event.type === "hungry") {
        return { className: "state-hungry", hint: "肚子咕咕叫，想吃点合适的食物", description: "饿了", emojis: ["🍽️", "🌿", "💛"] };
    }
    return { className: "state-tired", hint: "身体有点不舒服，需要照护", description: "不舒服", emojis: ["💧", "🩹", "💛"] };
}

function resolveCareEvent(animalId) {
    clearHungryTimeoutCheck(animalId);
    scheduleNextCareEvent(animalId);
}

function getSelectedCareFeedIndexes(event) {
    return Array.isArray(event?.selectedOptionIndexes)
        ? event.selectedOptionIndexes.filter((index) => Number.isInteger(index))
        : [];
}

function feedAnimal(animal, food, reason = "投喂") {
    state.progress.feedings = (state.progress.feedings || 0) + 1;
    increaseAnimalIntimacy(animal.id, 1);
    state.feedingLogs.unshift({
        animalId: animal.id,
        food,
        reason,
        time: Date.now()
    });
    state.feedingLogs = state.feedingLogs.slice(0, 24);
}

function toggleCareFeedOption(optionIndex) {
    const animal = getAnimal();
    const event = getActiveCareEvent(animal.id);
    if (!event || event.type !== "hungry") return;

    if (!event.options?.[optionIndex]) return;

    const selected = new Set(getSelectedCareFeedIndexes(event));
    if (selected.has(optionIndex)) {
        selected.delete(optionIndex);
    } else {
        selected.add(optionIndex);
    }

    event.selectedOptionIndexes = Array.from(selected).sort((a, b) => a - b);
    state.careFeedConfirm = null;
    saveState();
    render();
}

function clearCareFeedSelection() {
    const animal = getAnimal();
    const event = getActiveCareEvent(animal.id);
    if (!event || event.type !== "hungry") return;

    event.selectedOptionIndexes = [];
    state.careFeedConfirm = null;
    saveState();
    render();
}

function submitCareFeedSelection() {
    const animal = getAnimal();
    const event = getActiveCareEvent(animal.id);
    if (!event || event.type !== "hungry") return;

    const selectedIndexes = getSelectedCareFeedIndexes(event);
    if (!selectedIndexes.length) {
        state.careFeedConfirm = {
            animalId: animal.id,
            animalName: getAnimalDisplayName(animal.id),
            createdAt: Date.now()
        };
        render();
        return;
    }

    const selectedOptions = selectedIndexes
        .map((index) => event.options?.[index])
        .filter(Boolean);
    if (!selectedOptions.length) return;

    const wrongFoods = selectedOptions.filter((option) => !option.edible);
    const edibleFoods = selectedOptions.filter((option) => option.edible);
    const profile = getAnimalCareProfile(animal);

    if (wrongFoods.length) {
        changeCareRisk(animal.id, 1);
    }

    if (edibleFoods.length) {
        const ownedFavorite = edibleFoods.find((option) => option.food === profile.favoriteFood && getFoodCount(animal.id, profile.favoriteFood) > 0);
        const nonFavoriteFood = edibleFoods.find((option) => option.food !== profile.favoriteFood);
        const selectedFood = ownedFavorite || nonFavoriteFood || edibleFoods[0];

        if (selectedFood.food === profile.favoriteFood) {
            if (!consumeFoodFromInventory(animal.id, profile.favoriteFood)) {
                if (wrongFoods.length) saveState();
                showToast(`先答题获得${profile.favoriteFood}，再来投喂`);
                return;
            }
        }
        feedAnimal(animal, selectedFood.food, "随机事件投喂");
        addActivity("喂养", `${getAnimalDisplayName(animal.id)}：投喂 ${selectedFood.food}`, animal.id);
        showToast(wrongFoods.length ? "吃到了合适的食物，但下次要避开不能吃的东西" : `亲密度提升：${selectedFood.food}`);
    } else {
        addActivity("喂养", `${getAnimalDisplayName(animal.id)}：误选 ${wrongFoods.map((item) => item.food).join("、")}`, animal.id);
        showToast("这不是它适合吃的，下次生病概率会提高");
    }

    resolveCareEvent(animal.id);
    state.careFeedConfirm = null;
    saveState();
    render();
}

function confirmSkipCareFeed() {
    const animal = getAnimal();
    const event = getActiveCareEvent(animal.id);
    if (!event || event.type !== "hungry") {
        state.careFeedConfirm = null;
        render();
        return;
    }

    changeCareRisk(animal.id, 1);
    addActivity("喂养", `${getAnimalDisplayName(animal.id)}：本次没有投喂`, animal.id);
    resolveCareEvent(animal.id);
    state.careFeedConfirm = null;
    saveState();
    render();
    showToast("这次没有投喂，下次要多留意它的状态");
}

async function handleTreatCareEvent() {
    const animal = getAnimal();
    const event = getActiveCareEvent(animal.id);
    if (!event || event.type !== "sick") return;
    if (state.careDoctorModal?.status === "loading") return;

    const animalName = getAnimalDisplayName(animal.id);
    state.careDoctorModal = {
        status: "loading",
        animalId: animal.id,
        animalName,
        title: event.title,
        cause: event.cause,
        action: event.action,
        why: event.cause,
        treatment: event.action,
        reply: "",
        source: "AI医生",
        time: Date.now()
    };
    render();
    showToast("AI医生正在诊断...");

    const message = `你是儿童动物科普AI医生。${animal.name}现在的情况：${event.title}。原因线索：${event.cause}
请用5-8岁孩子能听懂的温和口吻回答，分成两段：
1. 为什么不舒服：说明可能原因。
2. 怎么照护：给出安全、简单、可执行的照护方法。
最后提醒：如果情况持续不好，要找真正的兽医。`;
    let reply = `为什么不舒服：${event.cause}

怎么照护：${event.action}如果精神持续不好，请联系专业兽医。`;
    let source = "本地照护建议";

    try {
        const data = await BlueAnimal.chat.ask({
            mode: "doctor",
            message,
            animal: animal.name,
            model: state.model
        });
        reply = data.reply || reply;
        source = data.model ? `模型：${data.model}` : "AI医生";
    } catch (error) {
        console.error("随机事件治疗失败，使用本地建议:", error);
    }

    state.progress.doctorChecks += 1;
    state.progress.treatments = (state.progress.treatments || 0) + 1;
    changeCareRisk(animal.id, -2);
    state.doctorLogs.unshift({
        animalId: animal.id,
        symptom: event.title,
        detail: message,
        reply,
        source,
        time: Date.now()
    });
    state.doctorLogs = state.doctorLogs.slice(0, 10);
    addActivity("治疗", `${getAnimalDisplayName(animal.id)}：${event.title}`, animal.id);
    resolveCareEvent(animal.id);
    const structuredReply = splitDoctorCareReply(reply, event.cause, event.action);
    state.careDoctorModal = {
        status: "done",
        animalId: animal.id,
        animalName,
        title: event.title,
        cause: event.cause,
        action: event.action,
        why: structuredReply.why,
        treatment: structuredReply.treatment,
        reply,
        source,
        time: Date.now()
    };
    saveState();
    render();
    showToast("AI医生回答好了");
}

async function handleQuiz(choice) {
    const animal = getAnimal();
    const quiz = getActiveAnimalQuiz(animal);
    if (!quiz) return;

    const correct = choice === quiz.answer;
    const rewardFood = getAnimalCareProfile(animal).favoriteFood;
    const dailySet = getDailyQuizSet(animal);

    if (dailySet?.answers?.[quiz.index]) return;

    state.progress.quizTotal += 1;
    state.lastQuiz = {
        animalId: animal.id,
        quizIndex: quiz.index,
        question: quiz.question,
        options: quiz.options,
        answer: quiz.answer,
        choice,
        correct,
        food: rewardFood,
        time: Date.now()
    };

    if (dailySet) {
        if (!dailySet.answers) dailySet.answers = {};
        dailySet.answers[quiz.index] = {
            choice,
            correct,
            time: Date.now()
        };
    }

    if (correct) {
        state.progress.quizCorrect += 1;
        addFoodToInventory(animal.id, rewardFood, 1);
        addActivity("测验", `${getAnimalDisplayName(animal.id)}：答对获得 ${rewardFood}`, animal.id);
        updateInteractionStats(animal.id, "quizPassed");
    } else {
        addActivity("测验", `${getAnimalDisplayName(animal.id)}：答错并学习正确答案`, animal.id);
    }

    document.querySelectorAll("[data-quiz-choice]").forEach((button) => {
        const index = Number(button.dataset.quizChoice);
        button.classList.toggle("correct", index === quiz.answer);
        button.classList.toggle("wrong", index === choice && !correct);
        button.disabled = true;
    });
    const result = document.getElementById("quizResult");
    result.textContent = correct
        ? `答对了，获得 1 份${rewardFood}。等${getAnimalDisplayName(animal.id)}饿了就可以投喂。`
        : `答错了，正确答案是：${quiz.options[quiz.answer]}。继续完成今天的题吧。`;

    saveState();
    syncChildProgress({ force: true, silent: true });
    showToast(correct ? `获得 1 份${rewardFood}` : "答错了，已经显示正确答案");
    render();
}

function updateCareStats(animal) {
    // Update feeding count and level display without full re-render
    const animalFeedings = state.feedingLogs.filter((item) => item.animalId === animal.id).length;
    const intimacy = getAnimalIntimacy(animal.id);
    const animalLevel = Math.floor(intimacy / 3) + 1;
    const intimacyProgress = intimacy % 3;

    // Update level badge
    const levelBadge = document.querySelector('.level-badge');
    if (levelBadge) {
        levelBadge.textContent = `Lv.${animalLevel}`;
    }

    // Update progress bar
    const progressFill = document.querySelector('.level-progress-fill');
    if (progressFill) {
        progressFill.style.width = `${(intimacyProgress / 3) * 100}%`;
    }

    const progressText = document.querySelector('.level-progress-text');
    if (progressText) {
        progressText.textContent = `${intimacyProgress}/3`;
    }

    // Update feeding stat
    const feedingStat = document.querySelectorAll('.stat-item')[0]?.querySelector('.stat-value');
    if (feedingStat) {
        feedingStat.textContent = animalFeedings;
    }
}

async function handleAskQa() {
    if (state.qaRequest?.isLoading) {
        return;
    }

    const question = document.getElementById("qaQuestion").value.trim();
    const modelSelect = document.getElementById("qaModel");
    const model = modelSelect ? modelSelect.value : state.model;

    if (!question) {
        showToast("请先输入问题");
        return;
    }

    try {
        startQaRequest(question);
        state.model = model;
        const result = await askAI("qa", question, "qaAnswer", "qaMeta", { model });
        clearQaRequest();
        state.progress.questions += 1;
        state.answers.unshift({
            animalId: state.selectedAnimalId,
            question,
            reply: result.reply,
            source: result.source,
            time: Date.now()
        });
        state.answers = state.answers.slice(0, 12);
        addActivity("问答", `${getAnimal().name}：${question}`, state.selectedAnimalId);

        // 更新解锁统计
        updateInteractionStats(state.selectedAnimalId, "chat");
        updateInteractionStats(state.selectedAnimalId, "question");

        saveState();
        render();

        // 平滑滚动到回答区域
        setTimeout(() => {
            const answerBox = document.querySelector('.qa-answer-box');
            if (answerBox) {
                answerBox.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }, 100);
    } catch (error) {
        clearQaRequest();
        console.error("AI问答失败:", error);
        showToast("问答失败，请重试");
        render();
    }
}

let qaRequestTimer = null;

function startQaRequest(question) {
    stopQaRequestTimer();
    state.qaRequest = {
        isLoading: true,
        question,
        startedAt: Date.now(),
        elapsedSeconds: 0
    };
    render();

    qaRequestTimer = window.setInterval(() => {
        if (!state.qaRequest?.isLoading) {
            stopQaRequestTimer();
            return;
        }

        state.qaRequest.elapsedSeconds = Math.floor((Date.now() - state.qaRequest.startedAt) / 1000);
        render();
    }, 1000);
}

function clearQaRequest() {
    stopQaRequestTimer();
    delete state.qaRequest;
}

function stopQaRequestTimer() {
    if (!qaRequestTimer) return;
    window.clearInterval(qaRequestTimer);
    qaRequestTimer = null;
}

async function handleAskDoctor() {
    const symptom = document.getElementById("symptomType").value;
    const detail = document.getElementById("symptomDetail").value.trim();
    const model = document.getElementById("doctorModel")?.value || document.getElementById("qaModel")?.value || state.model;

    try {
        state.model = model;
        const message = `${symptom}。${detail}`;
        const result = await askAI("doctor", message, "doctorAnswer", "doctorMeta", { model });
        state.progress.doctorChecks += 1;
        state.progress.treatments = (state.progress.treatments || 0) + 1;
        state.doctorLogs.unshift({
            animalId: state.selectedAnimalId,
            symptom,
            detail,
            reply: result.reply,
            source: result.source,
            time: Date.now()
        });
        state.doctorLogs = state.doctorLogs.slice(0, 10);
        addActivity("治疗", `${getAnimal().name}：${symptom}`, state.selectedAnimalId);
        saveState();
        render();
    } catch (error) {
        console.error("AI医生问诊失败:", error);
        showToast("问诊失败，请重试");
    }
}

const QUICK_QUESTION_HISTORY_LIMIT = 8;
const QUICK_QUESTION_CANDIDATE_COUNT = 4;
const QUICK_QUESTION_TOPICS = [
    { name: "食物", instruction: "优先从食物、吃饭习惯或找食物方式切入" },
    { name: "本领", instruction: "优先从身体本领、保护自己或适应环境切入" },
    { name: "家园", instruction: "优先从住在哪里、怎么休息或环境特点切入" },
    { name: "成长", instruction: "优先从小时候、长大变化或日常习性切入" }
];

function normalizeQuickQuestion(question = "") {
    return String(question)
        .trim()
        .replace(/^问题[:：]\s*/, "")
        .replace(/^[0-9一二三四五六七八九十]+[.、:：)\]]\s*/, "")
        .replace(/^[-*]\s*/, "")
        .replace(/^[""'`「『（(]+/, "")
        .replace(/[""'`」』）)]+$/, "")
        .split(/\r?\n/)[0]
        .trim();
}

function canonicalizeQuickQuestion(question = "") {
    return normalizeQuickQuestion(question)
        .replace(/[？?！!，,。、“”"'`‘’《》〈〉（）()\[\]\s]/g, "");
}

function finalizeQuickQuestion(question, animal) {
    let cleaned = normalizeQuickQuestion(question);
    if (!cleaned) return "";

    cleaned = cleaned.replace(/^(请直接输出|输出|答案|示例)[:：]\s*/, "");
    cleaned = cleaned.replace(/[?？!！。]+$/g, "");

    if (!cleaned.includes(animal.name) && cleaned.length < 6) {
        cleaned = `${animal.name}${cleaned}`;
    }

    if (cleaned.length > 18) {
        cleaned = `${cleaned.slice(0, 17)}…`;
    }

    return `${cleaned}？`;
}

function getQuickQuestionHistory(animalId) {
    const history = state.quickQuestionHistory?.[animalId];
    return Array.isArray(history) ? history : [];
}

function rememberQuickQuestion(animalId, question) {
    if (!animalId || !question) return;

    if (!state.quickQuestionHistory) {
        state.quickQuestionHistory = {};
    }

    const canonical = canonicalizeQuickQuestion(question);
    const nextHistory = [
        question,
        ...getQuickQuestionHistory(animalId).filter((item) => canonicalizeQuickQuestion(item) !== canonical)
    ].slice(0, QUICK_QUESTION_HISTORY_LIMIT);

    state.quickQuestionHistory[animalId] = nextHistory;
}

function getCurrentQuickQuestionForAnimal(animal) {
    return getQuickQuestionHistory(animal.id)[0]
        || animal.quick?.[0]
        || `${animal.name}有什么特别的地方？`;
}

function getNextQuickQuestionTopic(animalId) {
    if (!state.quickQuestionTopicCursor) {
        state.quickQuestionTopicCursor = {};
    }

    const cursor = Number(state.quickQuestionTopicCursor[animalId] || 0) % QUICK_QUESTION_TOPICS.length;
    state.quickQuestionTopicCursor[animalId] = (cursor + 1) % QUICK_QUESTION_TOPICS.length;
    return QUICK_QUESTION_TOPICS[cursor];
}

function getQuickQuestionAvoidList(animal) {
    const currentQuestion = state.currentQuickQuestion?.animalId === animal.id && !state.currentQuickQuestion?.isGenerating
        ? state.currentQuickQuestion.question
        : "";

    const allQuestions = [
        currentQuestion,
        ...getQuickQuestionHistory(animal.id),
        ...(animal.quick || [])
    ];

    const uniqueQuestions = [];
    const seen = new Set();

    allQuestions.forEach((question) => {
        const normalized = normalizeQuickQuestion(question);
        const canonical = canonicalizeQuickQuestion(normalized);
        if (!normalized || !canonical || seen.has(canonical)) {
            return;
        }
        seen.add(canonical);
        uniqueQuestions.push(normalized);
    });

    return uniqueQuestions.slice(0, QUICK_QUESTION_HISTORY_LIMIT);
}

function buildQuickQuestionPrompt(animal, avoidQuestions, topic) {
    const avoidText = avoidQuestions.length
        ? avoidQuestions.map((item) => `- ${item}`).join("\n")
        : "无";

    return `你是儿童动物科普老师。请围绕${animal.name}一次生成${QUICK_QUESTION_CANDIDATE_COUNT}个不同的候选问题，给5-8岁孩子使用。

动物信息：
- 栖息地：${animal.habitat}
- 食物：${animal.diet}
- 特点：${animal.fact}
- 照护知识：${animal.care}

本轮优先角度：
${topic.instruction}

要求：
1. 每题控制在8到18个字之间，必须是问句，并以中文问号结尾。
2. 语气要自然、有童趣，像孩子会主动问的问题。
3. 4个问题尽量从不同角度切入，不要只是改几个字。
4. 不要重复这些已经出现过的问题：
${avoidText}
5. 不要输出答案、解释、标题或额外说明。
6. 只输出 JSON 数组，例如：["大熊猫怎么找竹子？","大熊猫为什么力气大？"]`;
}

function parseQuickQuestionCandidates(rawReply, animal) {
    const text = String(rawReply || "").trim();
    const candidates = [];

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
                candidates.push(...parsed);
            }
        } catch (error) {
            console.warn("解析快速问题 JSON 失败:", error);
        }
    }

    if (!candidates.length) {
        const lines = text
            .split(/\r?\n/)
            .map((line) => normalizeQuickQuestion(line))
            .filter(Boolean);
        candidates.push(...lines);
    }

    if (!candidates.length && text) {
        candidates.push(text);
    }

    const uniqueCandidates = [];
    const seen = new Set();

    candidates.forEach((candidate) => {
        const finalQuestion = finalizeQuickQuestion(candidate, animal);
        const canonical = canonicalizeQuickQuestion(finalQuestion);
        if (!finalQuestion || !canonical || seen.has(canonical)) {
            return;
        }
        seen.add(canonical);
        uniqueCandidates.push(finalQuestion);
    });

    return uniqueCandidates;
}

function buildFallbackQuickQuestionPool(animal) {
    const primaryDiet = animal.diet.split(/[，、。；]/).find(Boolean)?.trim() || "食物";
    const primaryHabitat = animal.habitat.split(/[，、。；]/).find(Boolean)?.trim() || "家里";
    const factSnippet = animal.fact.split(/[。！；]/).find(Boolean)?.trim() || animal.fact;
    const factKeyword = factSnippet
        .replace(`${animal.name}`, "")
        .replace(/能帮助它|可以帮助它|会帮助它|因为|所以/g, "")
        .trim();

    return [
        `${animal.name}为什么爱吃${primaryDiet}`,
        `${animal.name}在${primaryHabitat}怎么找吃的`,
        `${animal.name}为什么住在${primaryHabitat}`,
        `${animal.name}怎么保护自己`,
        `${animal.name}的身体有什么妙用`,
        `${animal.name}小时候是什么样`,
        `${animal.name}白天都在做什么`,
        `${animal.name}怎么和同伴交流`,
        `${animal.name}为什么需要${primaryHabitat}`,
        factKeyword ? `${animal.name}${factKeyword}吗` : ""
    ]
        .map((item) => finalizeQuickQuestion(item, animal))
        .filter(Boolean);
}

function pickFallbackQuickQuestion(animal, avoidQuestions) {
    const blocked = new Set(avoidQuestions.map((item) => canonicalizeQuickQuestion(item)));
    const candidates = [
        ...buildFallbackQuickQuestionPool(animal),
        ...(animal.quick || []).map((item) => finalizeQuickQuestion(item, animal))
    ];

    return candidates.find((item) => !blocked.has(canonicalizeQuickQuestion(item)))
        || finalizeQuickQuestion(`${animal.name}有什么新发现`, animal);
}

// 生成新的快速问题
async function generateQuickQuestion(animal) {
    const avoidQuestions = getQuickQuestionAvoidList(animal);
    const blocked = new Set(avoidQuestions.map((item) => canonicalizeQuickQuestion(item)));
    const attemptAvoidQuestions = [...avoidQuestions];
    let lastError = null;

    for (let attempt = 0; attempt < 3; attempt++) {
        const topic = getNextQuickQuestionTopic(animal.id);
        const prompt = buildQuickQuestionPrompt(animal, attemptAvoidQuestions, topic);

        try {
            const data = await BlueAnimal.chat.ask({
                mode: "qa",
                message: prompt,
                animal: animal.name,
                model: state.model
            });

            const candidates = parseQuickQuestionCandidates(data.reply, animal);
            const freshQuestion = candidates.find((item) => !blocked.has(canonicalizeQuickQuestion(item)));

            if (freshQuestion) {
                return freshQuestion;
            }

            candidates.forEach((item) => {
                const canonical = canonicalizeQuickQuestion(item);
                if (!blocked.has(canonical)) {
                    attemptAvoidQuestions.push(item);
                }
                blocked.add(canonical);
            });
        } catch (error) {
            lastError = error;
            console.error("生成问题失败:", error);
        }
    }

    if (lastError) {
        console.warn("快速问题已切换到本地兜底生成。");
    }

    return pickFallbackQuickQuestion(animal, attemptAvoidQuestions);
}

// 更换问题按钮点击
async function handleRefreshQuickQuestion() {
    const animal = getAnimal();

    // 设置加载状态
    state.currentQuickQuestion = {
        animalId: animal.id,
        question: '正在生成新问题...',
        isGenerating: true
    };
    saveState();
    render();

    try {
        // 生成新问题
        const newQuestion = await generateQuickQuestion(animal);
        rememberQuickQuestion(animal.id, newQuestion);

        // 更新状态
        state.currentQuickQuestion = {
            animalId: animal.id,
            question: newQuestion,
            isGenerating: false
        };
        saveState();
        render();
    } catch (error) {
        console.error('生成问题失败:', error);
        // 恢复为默认问题
        state.currentQuickQuestion = {
            animalId: animal.id,
            question: getCurrentQuickQuestionForAnimal(animal),
            isGenerating: false
        };
        saveState();
        render();
        showToast('生成问题失败，已恢复默认问题');
    }
}

// 填充问题到输入框
function handleFillQuickQuestion() {
    const questionInput = document.getElementById('qaQuestion');
    if (questionInput) {
        questionInput.value = state.currentQuickQuestion.question;
        questionInput.focus();
        // 添加一个小动画效果
        questionInput.classList.add('filled');
        setTimeout(() => questionInput.classList.remove('filled'), 300);

        // 更新快速问答统计
        const animalId = state.currentQuickQuestion.animalId || state.selectedAnimalId;
        if (animalId) {
            updateInteractionStats(animalId, "quickQA");
        }
    }
}
