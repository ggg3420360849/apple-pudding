function getAnimal(id = state.selectedAnimal || state.selectedAnimalId) {
    return animals.find((animal) => animal.id === id) || animals[0];
}

function getAnimalDisplayName(id) {
    const animal = getAnimal(id);
    return state.animalNicknames[id] || animal.name;
}

// 获取当前时间段
function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) return 'night'; // 22:00-6:00 夜晚
    if (hour >= 6 && hour < 8) return 'morning'; // 6:00-8:00 早晨
    if (hour >= 8 && hour < 12) return 'forenoon'; // 8:00-12:00 上午
    if (hour >= 12 && hour < 14) return 'noon'; // 12:00-14:00 中午
    if (hour >= 14 && hour < 18) return 'afternoon'; // 14:00-18:00 下午
    if (hour >= 18 && hour < 22) return 'evening'; // 18:00-22:00 傍晚
    return 'day';
}

// 获取随机动物状态
function getRandomAnimalState(animalId) {
    const timeOfDay = getTimeOfDay();

    // 所有动物的通用状态库
    const commonStates = [
        { className: 'state-playing', hint: '在开心地玩耍~', description: '玩得好开心', emojis: ['✨', '💫', '⭐'] },
        { className: 'state-curious', hint: '好奇地看着你', description: '在好奇地观察', emojis: ['👀', '❓', '💭'] },
        { className: 'state-relaxing', hint: '悠闲地放松中...', description: '放松休息中', emojis: ['💤', '☁️', '🌸'] },
        { className: 'state-dancing', hint: '跳起了小舞蹈！', description: '跳舞啦', emojis: ['🎵', '🎶', '💃'] }
    ];

    // 时间相关状态
    const timeStates = {
        night: [
            { className: 'state-sleeping', hint: '💤 该睡觉啦，晚安~', description: '困困的...想睡觉', emojis: ['💤', '🌙', '⭐'] },
            { className: 'state-reading', hint: '📖 睡前故事时间到了！', description: '看睡前故事', emojis: ['📖', '📚', '✨'] },
            { className: 'state-sleeping', hint: '😴 好困呀，要早点休息哦~', description: '打哈欠～', emojis: ['😴', '💤', '🌙'] }
        ],
        morning: [
            { className: 'state-exercising', hint: '🌅 早起做运动，身体棒棒！', description: '晨练中', emojis: ['💪', '🌅', '☀️'] },
            { className: 'state-hungry', hint: '☀️ 早餐时间到啦~', description: '准备吃早餐', emojis: ['🍳', '🥐', '☀️'] },
            { className: 'state-curious', hint: '🌤️ 早上好！新的一天开始了', description: '早安～', emojis: ['🌤️', '🌈', '✨'] }
        ],
        noon: [
            { className: 'state-hungry', hint: '🍽️ 肚子咕咕叫，想吃午饭了', description: '好饿呀', emojis: ['🍽️', '🍚', '😋'] },
            { className: 'state-snacking', hint: '😋 午餐真美味！', description: '吃午饭', emojis: ['😋', '🍱', '❤️'] },
            { className: 'state-relaxing', hint: '午休一会儿吧~', description: '午休时间', emojis: ['💤', '☁️', '🌸'] }
        ],
        evening: [
            { className: 'state-reading', hint: '📚 晚上看会儿书吧', description: '阅读时光', emojis: ['📚', '💡', '🌆'] },
            { className: 'state-snacking', hint: '🍎 晚餐时间到！', description: '享用晚餐', emojis: ['🍎', '🍽️', '🌙'] },
            { className: 'state-relaxing', hint: '🌆 今天过得真开心', description: '放松休息', emojis: ['🌆', '⭐', '😌'] }
        ]
    };

    // 动物特定状态
    const animalSpecificStates = {
        panda: [
            { className: 'state-climbing', hint: '🎋 在爬竹子找嫩叶', description: '爬竹子中', emojis: ['🎋', '🌿', '💪'] },
            { className: 'state-snacking', hint: '🎋 嚼竹子嘎嘣脆！', description: '嘎嘣嘎嘣~', emojis: ['🎋', '😋', '✨'] },
            { className: 'state-rolling', hint: '在地上滚来滚去~', description: '滚滚滚～', emojis: ['💫', '⭐', '✨'] },
            { className: 'state-sleeping', hint: '💤 吃饱了想睡觉', description: '呼呼大睡', emojis: ['💤', '😴', '☁️'] },
            { className: 'state-curious', hint: '🐼 眨巴眨巴大眼睛', description: '好奇宝宝', emojis: ['👀', '✨', '💭'] }
        ],
        rabbit: [
            { className: 'state-curious', hint: '🥕 竖起耳朵在听声音', description: '竖起小耳朵', emojis: ['👂', '🎵', '✨'] },
            { className: 'state-snacking', hint: '🥕 啃胡萝卜好开心', description: '嘎嘣嘎嘣', emojis: ['🥕', '😋', '❤️'] },
            { className: 'state-exercising', hint: '蹦蹦跳跳做运动', description: '蹦蹦跳跳', emojis: ['💨', '⭐', '💪'] },
            { className: 'state-playing', hint: '蹦跶蹦跶真快乐~', description: '开心玩耍', emojis: ['✨', '💫', '🌸'] },
            { className: 'state-curious', hint: '👂 耳朵动动听八方', description: '在听什么呢', emojis: ['👂', '🎵', '❓'] }
        ],
        dolphin: [
            { className: 'state-playing', hint: '🌊 在水里玩球球', description: '玩球球', emojis: ['🌊', '⚽', '💙'] },
            { className: 'state-dancing', hint: '跳出水面转圈圈！', description: '跳跃旋转', emojis: ['🌊', '💫', '✨'] },
            { className: 'state-curious', hint: '好奇地探索海洋', description: '探索中', emojis: ['🌊', '🔍', '💭'] },
            { className: 'state-exercising', hint: '🏊 游泳健身中~', description: '游泳游泳', emojis: ['🏊', '💪', '🌊'] },
            { className: 'state-playing', hint: '🐬 吐泡泡玩耍', description: '吐泡泡', emojis: ['💧', '✨', '💙'] }
        ],
        elephant: [
            { className: 'state-snacking', hint: '🍃 用鼻子卷着吃树叶', description: '卷树叶吃', emojis: ['🍃', '🐘', '😋'] },
            { className: 'state-playing', hint: '🚿 用鼻子喷水玩', description: '喷水玩', emojis: ['💦', '🚿', '✨'] },
            { className: 'state-relaxing', hint: '在泥浆里泡澡~', description: '泥浆浴', emojis: ['💆', '🌸', '❤️'] },
            { className: 'state-curious', hint: '🐘 用鼻子闻闻看', description: '闻闻看', emojis: ['👃', '🌸', '💭'] },
            { className: 'state-exercising', hint: '甩鼻子做运动', description: '甩鼻子', emojis: ['🐘', '💪', '✨'] }
        ],
        penguin: [
            { className: 'state-dancing', hint: '🐧 摇摇晃晃走路', description: '摇摆走路', emojis: ['🐧', '❄️', '💫'] },
            { className: 'state-playing', hint: '❄️ 在雪地里滑行', description: '滑冰啦', emojis: ['❄️', '⛸️', '✨'] },
            { className: 'state-curious', hint: '歪头看着你', description: '歪头杀', emojis: ['❓', '👀', '💭'] },
            { className: 'state-exercising', hint: '🏊 练习游泳技能', description: '游泳训练', emojis: ['🏊', '💪', '🌊'] },
            { className: 'state-snacking', hint: '🐟 抓到小鱼啦', description: '吃小鱼', emojis: ['🐟', '😋', '❤️'] }
        ],
        frog: [
            { className: 'state-relaxing', hint: '🍃 在荷叶上晒太阳', description: '晒太阳', emojis: ['🍃', '☀️', '😌'] },
            { className: 'state-curious', hint: '呱呱~ 唱首歌吧', description: '呱呱呱', emojis: ['🎵', '🎶', '💚'] },
            { className: 'state-exercising', hint: '练习跳高技能', description: '跳高训练', emojis: ['💪', '⭐', '🐸'] },
            { className: 'state-playing', hint: '🐸 在池塘里游泳', description: '游泳玩水', emojis: ['💦', '🌊', '💚'] },
            { className: 'state-snacking', hint: '👅 吃虫虫好美味', description: '吃虫虫', emojis: ['🐛', '😋', '✨'] }
        ],
        tiger: [
            { className: 'state-exercising', hint: '🐅 奔跑练习中', description: '奔跑训练', emojis: ['💨', '🐅', '💪'] },
            { className: 'state-sleeping', hint: '💤 大猫也要打盹', description: '打盹中', emojis: ['💤', '😴', '🌸'] },
            { className: 'state-curious', hint: '竖起耳朵听动静', description: '警觉中', emojis: ['👂', '👀', '⚡'] },
            { className: 'state-playing', hint: '在草地上打滚', description: '打滚玩', emojis: ['🌿', '✨', '💫'] },
            { className: 'state-snacking', hint: '🍖 享用美味大餐', description: '吃大餐', emojis: ['🍖', '😋', '❤️'] }
        ],
        camel: [
            { className: 'state-relaxing', hint: '🏜️ 在沙漠里休息', description: '沙漠休憩', emojis: ['🏜️', '☀️', '😌'] },
            { className: 'state-exercising', hint: '练习长途行走', description: '行走训练', emojis: ['🐫', '💪', '✨'] },
            { className: 'state-snacking', hint: '🌵 吃点仙人掌', description: '吃仙人掌', emojis: ['🌵', '😋', '💚'] },
            { className: 'state-curious', hint: '🐫 抬头看远方', description: '眺望远方', emojis: ['👀', '🏜️', '💭'] },
            { className: 'state-playing', hint: '沙浴时间到~', description: '沙浴SPA', emojis: ['✨', '🏜️', '💆'] }
        ]
    };

    // 合并状态：时间状态 + 动物特定状态 + 通用状态
    let availableStates = [...commonStates];

    // 添加时间相关状态
    if (timeStates[timeOfDay]) {
        availableStates = [...availableStates, ...timeStates[timeOfDay]];
    }

    // 添加动物特定状态
    if (animalSpecificStates[animalId]) {
        availableStates = [...availableStates, ...animalSpecificStates[animalId]];
    }

    // 随机选择一个状态
    return availableStates[Math.floor(Math.random() * availableStates.length)];
}

// 切换动物状态
function toggleAnimalState(animalId) {
    if (!state.animalStates) {
        state.animalStates = {};
    }

    // 获取新的随机状态
    const newState = getRandomAnimalState(animalId);
    state.animalStates[animalId] = newState;

    saveState();
    render();

    // 渲染完成后添加飘浮emoji特效
    setTimeout(() => {
        createFloatingEmojis(newState.emojis || ['✨', '💫', '⭐']);
    }, 50);
}

// 创建飘浮emoji特效
function createFloatingEmojis(emojis) {
    const container = document.getElementById('stateEffects');
    if (!container) return;

    // 清除旧的特效
    container.innerHTML = '';

    // 创建多个飘浮emoji
    const emojiCount = 5 + Math.floor(Math.random() * 3); // 5-7个emoji
    for (let i = 0; i < emojiCount; i++) {
        setTimeout(() => {
            const emoji = document.createElement('div');
            emoji.className = 'floating-emoji';
            emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];

            // 随机位置
            const randomX = 20 + Math.random() * 60; // 20%-80%的位置
            const randomDelay = Math.random() * 0.5; // 0-0.5s延迟

            emoji.style.left = `${randomX}%`;
            emoji.style.bottom = '30%';
            emoji.style.animationDelay = `${randomDelay}s`;

            container.appendChild(emoji);

            // 3秒后移除
            setTimeout(() => {
                if (emoji.parentNode) {
                    emoji.parentNode.removeChild(emoji);
                }
            }, 3000);
        }, i * 200); // 每个emoji间隔200ms出现
    }
}

function getAvailableRoutes() {
    if (!state.profile) return routes;
    const userRole = state.profile.role || "child";
    return routes.filter(route => route.roles.includes(userRole));
}

function getRoute(id = state.route) {
    if (id === "doctor") id = "qa";
    const availableRoutes = getAvailableRoutes();
    return availableRoutes.find((route) => route.id === id) || availableRoutes[0];
}

function setRoute(route) {
    if (route === "doctor") route = "qa";
    // 检查当前角色是否有权限访问此路由
    const availableRoutes = getAvailableRoutes();
    if (!availableRoutes.find(r => r.id === route)) {
        // 如果没有权限，跳转到该角色的第一个可用路由
        route = availableRoutes[0].id;
    }
    state.route = route;
    saveState();
    render();
}

function selectAnimal(id, source = "地图探索") {
    const animal = animals.find(a => a.id === id);
    const childName = state.profile?.name ? `${state.profile.name}，` : "";
    state.selectedAnimalId = id;
    state.selectedAnimal = id; // Also set for new QA view
    state.lastQuiz = null;
    state.progress.visits[id] = (state.progress.visits[id] || 0) + 1;
    // 更新当前备用问题
    state.currentQuickQuestion = {
        animalId: id,
        question: animal.quick?.[0] || `${animal.name}有什么特别的地方？`,
        isGenerating: false
    };
    addActivity("探索", `${getAnimalDisplayName(id)}：${source}`, id);
    saveState();
    render();
    window.setTimeout(() => showAnimalGreeting(animal, childName), 40);
}

function showAnimalGreeting(animal, childName = "") {
    document.querySelector(".animal-greeting")?.remove();
    window.clearTimeout(showAnimalGreeting.timer);

    const greeting = document.createElement("div");
    greeting.className = "animal-greeting";
    greeting.setAttribute("role", "status");
    greeting.innerHTML = `
        <span class="greeting-face">${animal.icon}</span>
        <strong>${escapeHtml(childName)}你好呀！我是${escapeHtml(getAnimalDisplayName(animal.id))}！</strong>
        <p>${escapeHtml(animal.fact)}</p>
        <span class="greeting-home">🏡 我的家：${escapeHtml(animal.habitat)}</span>
    `;
    document.body.appendChild(greeting);
    requestAnimationFrame(() => greeting.classList.add("show"));

    showAnimalGreeting.timer = window.setTimeout(() => {
        greeting.classList.remove("show");
        window.setTimeout(() => greeting.remove(), 350);
    }, 3200);
}

function addActivity(type, label, animalId = state.selectedAnimalId) {
    state.progress.activities.unshift({
        type,
        label,
        animalId,
        time: Date.now()
    });
    // 限制活动记录数量，防止数据过大
    state.progress.activities = state.progress.activities.slice(0, 1000);
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatStoryText(text) {
    // 将故事文本按段落分隔，为每个段落添加缩进
    if (!text) return '';

    // 按换行符分割段落
    const paragraphs = text.split('\n').filter(p => p.trim());

    // 为每个段落添加两个全角空格的缩进
    return paragraphs.map(p => '　　' + p.trim()).join('\n\n');
}

function formatTime(time) {
    const date = new Date(time);
    return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
