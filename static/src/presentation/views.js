const routeScrollPositions = new Map();

function getMainRouteKey(main = document.querySelector(".main")) {
    const routeClass = Array.from(main?.classList || []).find((name) => name.startsWith("route-"));
    return routeClass ? routeClass.slice("route-".length) : state.route;
}

function captureMainScrollPosition() {
    const main = document.querySelector(".main");
    if (!main) return null;
    const key = getMainRouteKey(main);
    const position = {
        mainTop: main.scrollTop,
        windowTop: window.pageYOffset || document.documentElement.scrollTop || 0
    };
    routeScrollPositions.set(key, position);
    return { key, position };
}

function restoreMainScrollPosition(previous) {
    const key = state.route;
    const saved = routeScrollPositions.get(key) || (previous?.key === key ? previous.position : null);
    if (!saved) return;

    const restore = () => {
        const main = document.querySelector(".main");
        if (main) main.scrollTop = saved.mainTop;
        window.scrollTo({ top: saved.windowTop, behavior: "auto" });
    };

    restore();
    window.requestAnimationFrame(() => {
        restore();
        window.requestAnimationFrame(restore);
    });
}

function render() {
    const scrollPosition = captureMainScrollPosition();
    // 如果没有 profile，尝试从 index-login.html 创建的会话加载
    if (!state.profile) {
        // 重新加载状态，以防会话刚刚创建
        const activeId = BlueAnimal.storage.session.read(ACTIVE_SESSION_KEY);
        if (activeId && sessionStore.sessions[activeId]) {
            state = mergeState(clone(defaultState), sessionStore.sessions[activeId]);
        } else {
            // 没有会话，跳转到登录页
            window.location.href = '/static/index-login.html';
            return;
        }
    }
    validateAndFixRoute();
    renderShell();
    restoreMainScrollPosition(scrollPosition);
}

function renderImagineWithoutJump() {
    const currentMain = document.querySelector(".main.route-imagine");
    const mainScrollTop = currentMain?.scrollTop || 0;
    const windowScrollTop = window.scrollY;
    const assetListPositions = {};
    document.querySelectorAll("[data-asset-list]").forEach((list) => {
        assetListPositions[list.dataset.assetList] = list.scrollTop;
    });
    render();
    const restorePosition = () => {
        const nextMain = document.querySelector(".main.route-imagine");
        if (nextMain) nextMain.scrollTop = mainScrollTop;
        Object.entries(assetListPositions).forEach(([name, scrollTop]) => {
            const list = document.querySelector(`[data-asset-list="${name}"]`);
            if (list) list.scrollTop = scrollTop;
        });
        window.scrollTo({ top: windowScrollTop, behavior: "auto" });
    };
    restorePosition();
    window.requestAnimationFrame(() => {
        restorePosition();
        window.requestAnimationFrame(restorePosition);
    });
}

function renderShell() {
    if (state.route === "doctor") state.route = "qa";
    const route = getRoute();
    const availableRoutes = getAvailableRoutes();
    app.innerHTML = `
        <div class="shell">
            <aside class="sidebar">
                <div class="mini-brand">
                    <div class="brand-mark">🍎</div>
                    <div>
                        <strong>苹果布丁动物乐园</strong>
                        <span>当前：${escapeHtml(getAnimalDisplayName(state.selectedAnimalId))}</span>
                    </div>
                </div>
                <nav class="nav-list" aria-label="主导航">
                    ${availableRoutes.map((item) => `
                        <button class="nav-item ${state.route === item.id ? "active" : ""}" data-route="${item.id}" type="button">
                            <span class="nav-icon">${item.icon}</span>
                            <span>${item.label}</span>
                        </button>
                    `).join("")}
                </nav>
                <div class="profile-box">
                    <div class="profile-name">${escapeHtml(state.profile.name)}</div>
                    <div class="profile-meta">${roleLabel(state.profile.role)}｜${state.profile.age || ''}${state.profile.age ? ' 岁' : ''}<br>${state.profile.role === 'parent' ? (state.selectedChild ? `查看：${state.selectedChild.name}` : '家长模式') : `已探索 ${Object.keys(state.progress.visits).length} 种动物`}</div>
                    ${state.profile.role === 'parent' ? `
                        <button class="secondary-button" type="button" onclick="backToParentPortal()" style="width: 100%; margin-top: 12px; padding: 8px; font-size: 13px;">
                            ← 返回家长门户
                        </button>
                    ` : ''}
                </div>
            </aside>
            <main class="main route-${state.route}">
                <div class="topbar">
                    <div class="page-title">
                        <h2>${route.title}</h2>
                        <p>${route.subtitle}</p>
                    </div>
                    <div class="action-row no-print">
                        <button class="settings-button" type="button" data-action="toggle-settings" aria-label="设置" title="设置">⚙️</button>
                    </div>
                    ${state.settingsOpen ? settingsMenu() : ""}
                </div>
                ${renderRoute()}
            </main>
        </div>
        <div id="toast" class="toast hide"></div>
    `;
}

function settingsMenu() {
    return `
        <div class="settings-menu">
            <div class="settings-menu-header">
                <h3>账户信息</h3>
            </div>
            <div class="settings-menu-body">
                <div class="user-info">
                    <div class="user-name">${escapeHtml(state.profile.name)}</div>
                    <div class="user-meta">${roleLabel(state.profile.role)} · ${state.profile.age} 岁</div>
                </div>
            </div>
            <div class="settings-menu-footer">
                <button class="logout-button" type="button" data-action="logout">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    <span>退出登录</span>
                </button>
            </div>
        </div>
    `;
}

function roleLabel(role) {
    return { child: "小探险家", parent: "家长" }[role] || "小探险家";
}

function renderRoute() {
    if (state.route === "qa") return qaView();
    if (state.route === "doctor") return qaView();
    if (state.route === "imagine") return imagineView();
    if (state.route === "story") return storyView();
    if (state.route === "report-overview") return reportOverviewView();
    if (state.route === "report-analysis") return reportAnalysisView();
    if (state.route === "report-activity") return reportActivityView();
    if (state.route === "report-settings") return reportSettingsView();
    return mapView();
}

function mapView() {
    const animal = getAnimal();
    return `
        <section class="view">
            <div class="grid-2 map-layout">
                <div class="panel map-panel">
                    <div class="panel-title">
                        <h3>🌿 栖息地大冒险</h3>
                        <span>${animals.length} 位动物朋友</span>
                    </div>
                    ${mapCanvas(true)}
                </div>
                <div class="panel animal-summary">
                    <div class="animal-hero">
                        <div class="animal-avatar" style="background: ${animal.color}33;">${animal.icon}</div>
                        <div>
                            <h3>${getAnimalDisplayName(animal.id)}</h3>
                            <p>${animal.habitat}｜${animal.biome}</p>
                        </div>
                    </div>
                    <div class="detail-list">
                        <p><strong>有趣发现：</strong>${animal.fact}</p>
                        <p><strong>食物：</strong>${animal.diet}</p>
                        <p><strong>照护提示：</strong>${animal.care}</p>
                    </div>
                    <div class="action-row">
                        <button class="primary-button" type="button" data-route="qa">动物学堂</button>
                        <button class="secondary-button" type="button" data-route="story">写故事</button>
                    </div>
                </div>
            </div>
        </section>
    `;
}

function mapCanvas(clickable) {
    const lockPositions = {
        penguin: { x: 78, y: 6, width: 108 },
        panda: { x: 43, y: 25, width: 108 },
        tiger: { x: 80, y: 33, width: 82 },
        frog: { x: 21, y: 61, width: 108 },
        dolphin: { x: 79, y: 66, width: 108 },
        camel: { x: 45, y: 84, width: 108 }
    };
    const grasslandUnlocked = isAnimalUnlocked("rabbit") && isAnimalUnlocked("elephant");
    const grasslandAnimal = animals.find((animal) => animal.id === "rabbit");
    const grasslandProgress = grasslandUnlocked ? null : calculateUnlockProgress(grasslandAnimal);

    return `
        <div class="map-viewport" aria-label="动物栖息地地图">
        <div class="map-canvas">
            <div class="biome forest"></div>
            <div class="biome mountain"></div>
            <div class="biome grassland"></div>
            <div class="biome ocean"></div>
            <div class="biome wetland"></div>
            <div class="biome polar"></div>
            <div class="biome desert"></div>
            <svg class="map-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path class="trail-shadow" d="M72 10 C62 17 53 23 46 29 S61 31 78 35 C67 40 52 43 43 47 S51 50 62 52 C48 57 34 61 25 65 C47 67 68 68 83 70 C69 77 54 82 45 88" />
                <path class="trail" d="M72 10 C62 17 53 23 46 29 S61 31 78 35 C67 40 52 43 43 47 S51 50 62 52 C48 57 34 61 25 65 C47 67 68 68 83 70 C69 77 54 82 45 88" />
                <circle class="route-dot" cx="58" cy="24" r="1" />
                <circle class="route-dot" cx="52" cy="44" r="1" />
                <circle class="route-dot" cx="48" cy="67" r="1" />
            </svg>
            <div class="map-label" style="right: 5%; top: 4%; --tilt: -2deg;">❄️ 冰雪海岸</div>
            <div class="map-label" style="left: 25%; top: 23%; --tilt: -3deg;">🎋 竹林山地</div>
            <div class="map-label" style="right: 7%; top: 31%; --tilt: 2deg;">🌲 森林</div>
            <div class="map-label" style="left: 32%; top: 43%; --tilt: -2deg;">🌼 阳光草原</div>
            <div class="map-label" style="left: 5%; top: 59%; --tilt: 2deg;">🪷 池塘湿地</div>
            <div class="map-label" style="right: 3%; top: 64%; --tilt: 2deg;">🌊 珊瑚海湾</div>
            <div class="map-label" style="left: 28%; top: 82%; --tilt: -2deg;">🏜️ 沙漠绿洲</div>
            ${!grasslandUnlocked ? `
                <button class="marker locked ${grasslandProgress?.percentage >= 80 ? 'almost-unlocked' : ''}"
                        type="button"
                        style="left:52%; top:44%; --lock-width:116px;"
                        data-locked-animal="grassland"
                        aria-label="查看兔子和大象的共同解锁方法">
                    <span class="unlock-bubble">
                        <strong>🔒 发现草原上的新朋友</strong>
                        ${escapeHtml(getUnlockInstruction(grasslandAnimal))}
                        <span class="unlock-meter"><i style="width:${grasslandProgress?.percentage || 0}%"></i></span>
                        当前解锁进度：${grasslandProgress?.percentage || 0}%
                    </span>
                </button>
            ` : ''}
            ${animals.map((animal) => {
                const unlocked = isAnimalUnlocked(animal.id);
                if (["rabbit", "elephant"].includes(animal.id) && !grasslandUnlocked) return "";
                const progress = unlocked ? null : calculateUnlockProgress(animal);
                const isAlmostUnlocked = progress && progress.percentage >= 80;
                const lockedClass = unlocked ? '' : 'locked';
                const almostClass = isAlmostUnlocked ? 'almost-unlocked' : '';
                const animalName = unlocked ? getAnimalDisplayName(animal.id) : '???';
                const markerPosition = unlocked
                    ? { x: animal.x, y: animal.y, width: 52 }
                    : (lockPositions[animal.id] || { x: animal.x, y: animal.y, width: 102 });

                return `
                <button class="marker ${animal.id === state.selectedAnimalId ? "active" : ""} ${lockedClass} ${almostClass}"
                        type="button"
                        style="left:${markerPosition.x}%; top:${markerPosition.y}%; --lock-width:${markerPosition.width}px;"
                        ${clickable && unlocked ? `data-animal="${animal.id}"` : ''}
                        ${clickable && !unlocked ? `data-locked-animal="${animal.id}" aria-label="查看${animal.name}解锁方法"` : ''}
                        ${!clickable ? 'tabindex="-1"' : ''}>
                    <span class="animal-face">${animal.icon}</span>
                    <span class="animal-name">${animalName}</span>
                    ${!unlocked ? `
                        <span class="unlock-bubble ${animal.x > 68 ? 'bubble-left' : animal.x < 32 ? 'bubble-right' : ''} ${animal.y < 18 ? 'bubble-bottom' : ''}">
                            <strong>🔒 发现一位神秘新朋友</strong>
                            ${escapeHtml(getUnlockInstruction(animal))}
                            <span class="unlock-meter"><i style="width:${progress?.percentage || 0}%"></i></span>
                            当前解锁进度：${progress?.percentage || 0}%
                        </span>
                    ` : ''}
                </button>
            `}).join("")}
        </div>
        </div>
        <p class="map-scroll-hint">✨ 点击玻璃锁，看看怎样邀请新朋友出现</p>
    `;
}

function animalChips() {
    return `
        <div class="chip-row">
            ${animals.map((animal) => {
                const unlocked = isAnimalUnlocked(animal.id);
                const animalName = unlocked ? getAnimalDisplayName(animal.id) : '???';
                const isActive = animal.id === state.selectedAnimalId;

                return `
                <button class="animal-chip ${isActive ? "active" : ""} ${unlocked ? '' : 'locked'}"
                        type="button"
                        ${unlocked ? `data-animal="${animal.id}"` : 'disabled'}>
                    <span style="${unlocked ? '' : 'filter: grayscale(100%); opacity: 0.4;'}">${animal.icon}</span>
                    <span>${animalName}</span>
                    ${!unlocked ? '<span style="font-size: 14px;">🔒</span>' : ''}
                </button>
            `}).join("")}
        </div>
    `;
}

function modelSelect(id) {
    return `
        <select class="select-input" id="${id}">
            ${models.map((model) => `<option value="${model}" ${state.model === model ? "selected" : ""}>${model}</option>`).join("")}
        </select>
    `;
}

function quizChoiceButton(quiz, option, index, currentQuiz) {
    let className = "choice-button";
    if (currentQuiz) {
        if (index === quiz.answer) className += " correct";
        if (index === currentQuiz.choice && !currentQuiz.correct) className += " wrong";
    }
    return `<button class="${className}" type="button" data-quiz-choice="${index}" ${currentQuiz ? "disabled" : ""}>${escapeHtml(option)}</button>`;
}

function quizResultText(animal, currentQuiz, quiz) {
    if (!currentQuiz) return "";
    if (currentQuiz.correct) return `答对了，已经给${getAnimalDisplayName(animal.id)}喂养：${currentQuiz.food}`;
    return `答错了，正确答案是：${quiz.options[quiz.answer]}。可以请AI医生帮小动物治疗和复习。`;
}

function qaView() {
    const animal = getAnimal();

    // Check if we're in demonstration stage (showing correct answer animation)
    if (state.qaStage === 'demonstration') {
        return renderDemonstration(animal);
    }

    // Check if we're in doctor consultation mode
    if (state.qaStage === 'doctor') {
        return renderDoctorConsultation(animal);
    }

    // Check if we're in animal selection mode (no animal selected yet, or explicitly requested)
    if (!state.selectedAnimal || state.qaStage === 'selection') {
        return renderAnimalSelection();
    }

    // Check if we're in loading animation stage
    if (state.qaStage === 'loading') {
        return renderAnimalLoading(animal);
    }

    // Otherwise show the main care interface
    return renderAnimalCare(animal);
}

function renderAnimalSelection() {
    const unlockedAnimals = getUnlockedAnimals();
    const lockedAnimals = getLockedAnimals();

    return `
        <section class="view animal-selection-view">
            <div class="selection-container">
                <h2 class="selection-title">选择照顾对象</h2>
                <p style="text-align: center; color: var(--muted); margin-bottom: 16px;">
                    已解锁 ${unlockedAnimals.length}/${animals.length} 个动物
                </p>
                <div class="animal-selection-list">
                    ${unlockedAnimals.map((animal) => `
                        <button class="animal-selection-item" type="button" data-action="select-animal" data-animal-id="${animal.id}">
                            <span class="selection-icon">${animal.icon}</span>
                            <span class="selection-name">${animal.name}</span>
                        </button>
                    `).join('')}
                    ${lockedAnimals.map((animal) => {
                        const progress = calculateUnlockProgress(animal);
                        return `
                        <div class="animal-selection-item locked" style="position: relative; cursor: not-allowed; opacity: 0.5;">
                            <span class="selection-icon" style="filter: grayscale(100%); opacity: 0.4;">${animal.icon}</span>
                            <span class="selection-name" style="color: #888;">???</span>
                            <div style="position: absolute; top: 8px; right: 8px; font-size: 16px;">🔒</div>
                            ${progress ? `
                                <div style="position: absolute; bottom: 4px; left: 8px; right: 8px;">
                                    <div style="height: 4px; background: rgba(200,200,200,0.3); border-radius: 2px; overflow: hidden;">
                                        <div style="height: 100%; background: var(--green); width: ${progress.percentage}%;"></div>
                                    </div>
                                    <div style="font-size: 11px; color: #666; margin-top: 2px; text-align: center;">${progress.percentage}%</div>
                                </div>
                            ` : ''}
                        </div>
                    `}).join('')}
                </div>
            </div>
        </section>
    `;
}

function renderAnimalLoading(animal) {
    const animations = {
        panda: { action: '吃竹子', emoji: '🎋' },
        dolphin: { action: '吐泡泡', emoji: '💧' },
        elephant: { action: '打盹', emoji: '💤' },
        penguin: { action: '蹒跚', emoji: '👣' },
        tiger: { action: '奔跑', emoji: '💨' },
        rabbit: { action: '吃萝卜', emoji: '🥕' },
        camel: { action: '沙漠散步', emoji: '🏜️' },
        frog: { action: '荷叶上休息', emoji: '🍃' }
    };

    const anim = animations[animal.id] || { action: '活动中', emoji: '✨' };

    return `
        <section class="view animal-loading-view">
            <div class="loading-container">
                <div class="loading-animal ${animal.id}-animation">
                    <div class="animal-large-icon">${animal.icon}</div>
                    <div class="animal-action-indicator">${anim.emoji}</div>
                </div>
                <p class="loading-text">${getAnimalDisplayName(animal.id)}正在${anim.action}...</p>
            </div>
        </section>
    `;
}

function renderDemonstration(animal) {
    // Map each animal to its correct answer demonstration
    const demonstrations = {
        panda: { action: '吃竹子', emoji: '🎋', description: '正确答案：大熊猫最爱吃竹子' },
        dolphin: { action: '使用回声定位', emoji: '🔊', description: '正确答案：海豚用回声寻找东西' },
        elephant: { action: '用鼻子喝水', emoji: '💧', description: '正确答案：大象用鼻子拿食物和喝水' },
        penguin: { action: '游泳', emoji: '🏊', description: '正确答案：企鹅最擅长游泳' },
        tiger: { action: '在草丛中隐藏', emoji: '🌿', description: '正确答案：条纹帮助老虎隐藏' },
        rabbit: { action: '竖起耳朵听声音', emoji: '👂', description: '正确答案：长耳朵帮助听声音和散热' },
        camel: { action: '在沙漠行走', emoji: '🏜️', description: '正确答案：驼峰储存脂肪' },
        frog: { action: '从蝌蚪变成青蛙', emoji: '🐸', description: '正确答案：青蛙小时候叫蝌蚪' }
    };

    const demo = demonstrations[animal.id] || { action: '展示中', emoji: '✨', description: '正确答案演示' };

    return `
        <section class="view animal-loading-view">
            <div class="loading-container">
                <div class="loading-animal ${animal.id}-demonstration">
                    <div class="animal-large-icon">${animal.icon}</div>
                    <div class="animal-action-indicator">${demo.emoji}</div>
                </div>
                <p class="loading-text">${demo.description}</p>
                <p class="loading-subtext">${getAnimalDisplayName(animal.id)}正在${demo.action}...</p>
            </div>
        </section>
    `;
}

function renderAnimalCare(animal) {
    const lastAnswer = state.answers[0];
    const lastDoctorLog = state.doctorLogs.find((item) => item.animalId === animal.id);
    const lastFeeding = state.feedingLogs.find((item) => item.animalId === animal.id);
    const activeQuiz = getActiveAnimalQuiz(animal);
    const quizList = getAnimalQuizList(animal);
    const quizCursor = getAnimalQuizCursor(animal);
    const currentQuiz = state.lastQuiz
        && state.lastQuiz.animalId === animal.id
        && state.lastQuiz.quizIndex === activeQuiz.index
        ? state.lastQuiz
        : null;
    const animalFeedings = state.feedingLogs.filter((item) => item.animalId === animal.id).length;
    const animalTreatments = state.doctorLogs.filter((item) => item.animalId === animal.id).length;
    const animalLevel = Math.floor(animalFeedings / 3) + 1; // Level up every 3 feedings

    // 获取当前动物状态
    const currentState = state.animalStates?.[animal.id] || getRandomAnimalState(animal.id);

    return `
        <section class="view animal-care-view">
            <div class="care-header">
                <div class="animal-display" style="position: relative;">
                    <div class="state-effects" id="stateEffects"></div>
                    <div class="animal-large ${animal.id}-state ${currentState.className}"
                         data-action="toggle-animal-state"
                         title="点击我看看会发生什么~">
                        ${animal.icon}
                    </div>
                    <div class="animal-state-description">${currentState.description || ''}</div>
                    <div class="animal-click-hint">👆 点击动物看看会怎样</div>
                    ${currentState.hint ? `<div class="animal-state-hint">${currentState.hint}</div>` : ''}
                </div>
                <div class="animal-info-card">
                    <div class="info-card-header">
                        <div class="animal-name-edit">
                            <input
                                type="text"
                                class="animal-name-input"
                                id="animalNickname"
                                value="${getAnimalDisplayName(animal.id)}"
                                maxlength="10"
                                placeholder="${animal.name}"
                            />
                            <button class="save-nickname-btn" type="button" data-action="save-nickname" title="保存名字">
                                ✓
                            </button>
                        </div>
                        <button class="change-animal-btn" type="button" data-action="change-animal">更换</button>
                    </div>
                    <div class="animal-level">
                        <span class="level-badge">Lv.${animalLevel}</span>
                        <div class="level-progress">
                            <div class="level-progress-fill" style="width: ${(animalFeedings % 3) * 33.33}%;"></div>
                        </div>
                    </div>
                    <div class="care-stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">喂养</span>
                            <span class="stat-value">${animalFeedings}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">治疗</span>
                            <span class="stat-value">${animalTreatments}</span>
                        </div>
                    </div>
                    <div class="animal-status-text">
                        ${lastFeeding && lastFeeding.animalId === animal.id ?
                            `最近喂食：${escapeHtml(lastFeeding.food)}` :
                            `喜欢吃：${animal.diet}`}
                    </div>
                </div>
            </div>

            <div class="knowledge-qa-section">
                <div class="panel">
                    <div class="panel-title">
                        <h3>知识提问</h3>
                    </div>
                    <div class="field">
                        <div style="position: relative;">
                            <textarea class="textarea-input" id="qaQuestion" placeholder="想问什么问题呢？试试点击话筒说出来..."></textarea>
                            <button class="voice-input-btn" type="button" data-action="toggle-voice-input-qa" id="voiceInputBtnQa" title="语音输入（建议使用 Chrome 浏览器）">
                                <span id="voiceIconQa">🎤</span>
                            </button>
                        </div>
                        <div id="voiceStatusQa" class="voice-status" style="display: none;">
                            <div class="voice-wave">
                                <span class="wave-bar"></span>
                                <span class="wave-bar"></span>
                                <span class="wave-bar"></span>
                                <span class="wave-bar"></span>
                                <span class="wave-bar"></span>
                            </div>
                            <p id="voiceStatusTextQa">正在聆听...</p>
                        </div>
                    </div>
                    <div class="quick-question-row">
                        <button
                            class="quick-question-text ${state.currentQuickQuestion.isGenerating ? 'generating' : ''}"
                            type="button"
                            data-action="fill-quick-question"
                            ${state.currentQuickQuestion.isGenerating ? 'disabled' : ''}>
                            ${escapeHtml(state.currentQuickQuestion.question)}
                        </button>
                        <button
                            class="refresh-question-btn ${state.currentQuickQuestion.isGenerating ? 'loading' : ''}"
                            type="button"
                            data-action="refresh-quick-question"
                            ${state.currentQuickQuestion.isGenerating ? 'disabled' : ''}
                            title="换一个问题"
                            aria-label="换一个问题">
                            ${state.currentQuickQuestion.isGenerating ? '⏳' : '🔄'}
                        </button>
                    </div>
                    <div class="action-row" style="margin-top: 14px;">
                        <button class="primary-button" type="button" data-action="ask-qa">问问AI</button>
                    </div>
                    ${lastAnswer ? `
                        <div class="qa-answer-box" style="margin-top: 20px;">
                            <div class="answer-label">回答
                                <button
                                    class="read-answer-icon"
                                    type="button"
                                    data-action="read-qa-answer"
                                    id="readQaBtn"
                                    title="朗读回答"
                                    style="display: inline-block; background: none; border: none; cursor: pointer; font-size: 18px; padding: 0; margin-left: 6px; line-height: 1; opacity: 0.6; transition: opacity 0.2s, transform 0.2s; vertical-align: middle; width: 18px; height: 18px;"
                                    onmouseover="this.style.opacity='1'; this.style.transform='scale(1.15)'"
                                    onmouseout="this.style.opacity='0.6'; this.style.transform='scale(1)'">
                                    <span id="readQaIcon" style="display: inline-block; width: 18px; height: 18px; line-height: 18px; text-align: center;">🔊</span>
                                </button>
                            </div>
                            <div id="qaAnswer" class="answer-panel">${escapeHtml(lastAnswer.reply)}</div>
                            <div id="qaMeta" class="meta-line">${formatTime(lastAnswer.time)} | ${escapeHtml(getAnimalDisplayName(lastAnswer.animalId))}</div>
                        </div>
                    ` : ''}
                </div>

                <div class="panel">
                    <div class="panel-title" style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="font-size: 24px; margin: 0;">答题喂养</h3>
                        <span>第 ${quizCursor + 1}/${quizList.length} 题 · 正确 ${state.progress.quizCorrect}/${state.progress.quizTotal}</span>
                    </div>
                    <div class="quiz-box">
                        <p class="quiz-question">${activeQuiz.question}</p>
                        <div class="choice-list">
                            ${activeQuiz.options.map((option, index) => quizChoiceButton(activeQuiz, option, index, currentQuiz)).join("")}
                        </div>
                        <div id="quizResult" class="meta-line">${escapeHtml(quizResultText(animal, currentQuiz, activeQuiz))}</div>
                        ${currentQuiz ? `
                            <div class="quiz-followup-actions">
                                ${!currentQuiz.correct ? `<button class="primary-button quiz-doctor-button" type="button" data-action="open-doctor">医生治疗</button>` : ""}
                                <button class="secondary-button" type="button" data-action="reset-quiz">下一题</button>
                            </div>
                        ` : ""}
                    </div>
                </div>
            </div>
        </section>
    `;
}

function renderDoctorConsultation(animal) {
    const lastDoctorLog = state.doctorLogs.find((item) => item.animalId === animal.id);

    return `
        <section class="view doctor-consultation-view">
            <div class="doctor-header">
                <button class="back-button" type="button" data-action="close-doctor">
                    <span>← 返回</span>
                </button>
                <h2>AI医生问诊</h2>
            </div>

            <div class="panel doctor-note">AI动物医生只适合做儿童科普和初步照护学习。真实宠物出现呼吸困难、流血、抽搐、持续呕吐等情况，请马上联系兽医。</div>

            <div class="grid-2">
                <div class="panel">
                    <div class="panel-title" style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="font-size: 24px; margin: 0;">问诊</h3>
                        <span>${animal.icon} ${getAnimalDisplayName(animal.id)}</span>
                    </div>
                    <div class="field">
                        <div style="position: relative;">
                            <textarea class="textarea-input" id="doctorQuestion" placeholder="想问医生什么呢？试试点击话筒说出来...">${getAnimalDisplayName(animal.id)}怎么了？为什么不开心？</textarea>
                            <button class="voice-input-btn" type="button" data-action="toggle-voice-input-doctor" id="voiceInputBtnDoctor" title="语音输入（建议使用 Chrome 浏览器）">
                                <span id="voiceIconDoctor">🎤</span>
                            </button>
                        </div>
                        <div id="voiceStatusDoctor" class="voice-status" style="display: none;">
                            <div class="voice-wave">
                                <span class="wave-bar"></span>
                                <span class="wave-bar"></span>
                                <span class="wave-bar"></span>
                                <span class="wave-bar"></span>
                                <span class="wave-bar"></span>
                            </div>
                            <p id="voiceStatusTextDoctor">正在聆听...</p>
                        </div>
                    </div>
                    <div class="action-row" style="margin-top: 14px;">
                        <button class="primary-button" type="button" data-action="ask-doctor-consultation">咨询医生</button>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-title" style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="font-size: 24px; margin: 0;">医生建议</h3>
                        <span>${lastDoctorLog ? formatTime(lastDoctorLog.time) : ""}</span>
                    </div>
                    <div id="doctorAnswer" class="answer-panel care-answer">${lastDoctorLog ? escapeHtml(lastDoctorLog.reply) : "医生的诊断建议会显示在这里。"}</div>
                    ${lastDoctorLog ? `
                        <div class="action-row" style="margin-top: 10px;">
                            <button class="secondary-button" type="button" data-action="read-doctor-answer" id="readDoctorBtn">
                                <span style="margin-right: 4px;">🔊</span>朗读
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        </section>
    `;
}

function doctorView() {
    const animal = getAnimal();
    const lastLog = state.doctorLogs[0];
    return `
        <section class="view">
            <div class="panel doctor-note">AI动物医生只适合做儿童科普和初步照护学习。真实宠物出现呼吸困难、流血、抽搐、持续呕吐等情况，请马上联系兽医。</div>
            <div class="grid-2">
                <div class="panel">
                    <div class="panel-title" style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="font-size: 24px; margin: 0;">问诊记录</h3>
                        <span>${animal.icon} ${getAnimalDisplayName(animal.id)}</span>
                    </div>
                    ${animalChips()}
                    <div class="field" style="margin-top: 16px;">
                        <label for="symptomType">情况</label>
                        <select class="select-input" id="symptomType">
                            <option>不爱吃东西</option>
                            <option>一直挠痒</option>
                            <option>走路没精神</option>
                            <option>喝水变多</option>
                            <option>看起来紧张</option>
                        </select>
                    </div>
                    <div class="field">
                        <label for="symptomDetail">补充</label>
                        <textarea class="textarea-input" id="symptomDetail">${getAnimalDisplayName(animal.id)}今天有点没精神，想知道可能需要观察什么。</textarea>
                    </div>
                    <button class="primary-button" type="button" data-action="ask-doctor">生成照护建议</button>
                </div>
                <div class="panel">
                    <div class="panel-title" style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="font-size: 24px; margin: 0;">建议</h3>
                        <span>${lastLog ? formatTime(lastLog.time) : ""}</span>
                    </div>
                    <div id="doctorAnswer" class="answer-panel">${lastLog ? escapeHtml(lastLog.reply) : "照护建议会显示在这里。"}</div>
                    <div id="doctorMeta" class="meta-line">${lastLog ? `动物：${escapeHtml(getAnimalDisplayName(lastLog.animalId))}｜${escapeHtml(lastLog.source)}` : ""}</div>
                </div>
            </div>
        </section>
    `;
}

function imagineView() {
    const draft = state.draftCreature;
    const parts = Array.isArray(draft.parts) ? draft.parts : [];
    const body = normalizeCreatureBody(draft.body || "panda");
    const wing = parts.includes("wing") ? normalizeCreatureWing(draft.wing || "angel") : "";
    const tail = parts.includes("tail") ? normalizeCreatureTail(draft.tail || "fox") : "";
    const hasHorn = parts.includes("horn");
    const selectedPart = activeCreaturePart(draft);
    return `
        <section class="imagine-screen">
            <header class="imagine-intro">
                <span class="imagine-kicker">✦ 森林手作屋 ✦</span>
                <h3>今天要创造谁？</h3>
                <p>挑一挑、拼一拼，让奇妙的新朋友从画纸里醒来！</p>
            </header>
            <div class="creator-board">
                <div class="material-rail">
                    <div class="material-group">
                        <p class="material-title"><span>①</span> 身体</p>
                        <div class="material-list asset-list" data-asset-list="body">
                            ${creatureBodies.map((item) => creatureMaterialButton("body", item, body === item.id)).join("")}
                        </div>
                    </div>
                    <div class="material-group">
                        <p class="material-title"><span>②</span> 尾巴</p>
                        <div class="material-list asset-list" data-asset-list="tail">
                            ${creatureTails.map((item) => creatureMaterialButton("tail", item, tail === item.id)).join("")}
                        </div>
                    </div>
                </div>
                <div class="stage-card">
                    <span class="imagine-sticker sticker-star" aria-hidden="true"></span>
                    <span class="imagine-sticker sticker-leaf" aria-hidden="true"></span>
                    <span class="imagine-sticker sticker-pencil" aria-hidden="true"></span>
                    ${creaturePreview(draft)}
                </div>
                <div class="material-rail">
                    <div class="material-group">
                        <p class="material-title"><span>③</span> 翅膀</p>
                        <div class="material-list asset-list" data-asset-list="wing">
                            ${creatureWings.map((item) => creatureMaterialButton("wing", item, wing === item.id)).join("")}
                        </div>
                    </div>
                    <div class="material-group">
                        <p class="material-title"><span>④</span> 星角</p>
                        <div class="material-list">
                            ${creatureSpecials.map((item) => creatureMaterialButton("horn", item, hasHorn)).join("")}
                        </div>
                    </div>
                </div>
            </div>
            <div class="compose-hint">
                <span class="hint-icon">✎</span>
                <strong>${selectedPart === "body"
                    ? "选中身体后，用滚轮或双指调整大小"
                    : "拖一拖换位置，双指可以缩放和旋转"}</strong>
            </div>
            <div class="creature-card">
                <div class="creature-thumb" style="background: linear-gradient(180deg, ${draft.color || "#8fc6f5"}55, #d6edb9);"><img src="${creatureAssetUrl("body", body)}" alt=""></div>
                <div class="creature-notes">
                    <div class="note-row">
                        <label class="note-label" for="creatureName">我的新朋友叫</label>
                        <input class="text-input" id="creatureName" maxlength="16" value="${escapeHtml(draft.name)}" placeholder="给它取个名字" aria-label="动物名字">
                    </div>
                    <div class="note-row">
                        <label class="note-label" for="creatureHabitat">它住在</label>
                        <input class="text-input" id="creatureHabitat" maxlength="18" value="${escapeHtml(draft.habitat)}" aria-label="栖息地">
                    </div>
                    <div class="note-row">
                        <label class="note-label" for="creatureMood">它的性格</label>
                        <select class="select-input" id="creatureMood" aria-label="性格">
                            ${["好奇", "勇敢", "温柔", "爱唱歌", "慢悠悠"].map((mood) => `<option ${draft.mood === mood ? "selected" : ""}>${mood}</option>`).join("")}
                        </select>
                    </div>
                    <p class="creature-summary">${escapeHtml(draft.mood)}，住在${escapeHtml(draft.habitat)}。已经选择 ${[wing && "翅膀", tail && "尾巴", hasHorn && "星角"].filter(Boolean).join("、") || "身体"}。</p>
                </div>
            </div>
            <div class="imagine-actions">
                <button class="save-creature-button" type="button" data-action="save-creature">放进动物册 ✦</button>
                <button class="random-creature-button" type="button" data-action="random-creature" aria-label="随机组合" title="随机组合">🎲</button>
                <button class="remove-creature-button" type="button" data-action="clear-creature-parts" aria-label="清除配件" title="清除配件">↺</button>
            </div>
            ${state.creations.length ? `
                <div class="collection-grid">
                    <h3 class="scrapbook-title">我的奇妙动物册</h3>
                    ${state.creations.slice(0, 3).map((item) => `
                        <article class="collection-item">
                            <h4>${escapeHtml(item.name)}</h4>
                            <p>${escapeHtml(item.mood)}，住在${escapeHtml(item.habitat)}。能力：${escapeHtml(item.parts.join("、") || "慢慢观察")}</p>
                        </article>
                    `).join("")}
                </div>
            ` : ""}
        </section>
    `;
}

function creatureAssetUrl(type, id) {
    const list = type === "body" ? creatureBodies : type === "wing" ? creatureWings : type === "horn" ? creatureSpecials : creatureTails;
    const fallback = list[0];
    const item = list.find((asset) => asset.id === id) || fallback;
    return `${imagineAssetBase}${item.file}`;
}

function normalizeCreatureBody(id) {
    return { puppy: "dog", bunny: "rabbit" }[id] || (creatureBodies.some((item) => item.id === id) ? id : "panda");
}

function normalizeCreatureWing(id) {
    if (!id) return "";
    return { butterfly: "fairy" }[id] || (creatureWings.some((item) => item.id === id) ? id : "angel");
}

function normalizeCreatureTail(id) {
    if (!id) return "";
    return { leaf: "dino" }[id] || (creatureTails.some((item) => item.id === id) ? id : "fox");
}

function creatureMaterialButton(type, item, active) {
    const partToggle = type === "horn" ? ` data-creature-part="${item.id}"` : "";
    return `<button class="material-button ${active ? "active" : ""}" type="button" draggable="true" data-creature-part-type="${type}" data-creature-part-id="${item.id}" data-creature-${type}="${item.id}"${partToggle} aria-label="${item.label}" title="${item.label}"><img class="material-img" src="${imagineAssetBase}${item.file}" alt=""></button>`;
}

function creatureThumbEmoji(body) {
    return { panda: "🐼", puppy: "🐶", bunny: "🐰" }[body] || "🐼";
}

function creaturePartButton(part, label) {
    const parts = Array.isArray(state.draftCreature.parts) ? state.draftCreature.parts : [];
    const active = parts.includes(part);
    return `<button class="chip ${active ? "active" : ""}" type="button" data-creature-part="${part}">${label}</button>`;
}

function defaultCreatureTransform(part) {
    return part === "body"
        ? { scale: 100 }
        : { scale: 100, rotation: 0, x: 0, y: 0 };
}

function creatureTransform(part) {
    if (!state.draftCreature.transforms) state.draftCreature.transforms = {};
    state.draftCreature.transforms[part] = {
        ...defaultCreatureTransform(part),
        ...(state.draftCreature.transforms[part] || {})
    };
    return state.draftCreature.transforms[part];
}

function activeCreaturePart(draft = state.draftCreature) {
    const parts = new Set(Array.isArray(draft.parts) ? draft.parts : []);
    const selected = draft.selectedPart || "body";
    return selected === "body" || parts.has(selected) ? selected : "body";
}

function creatureTransformStyle(part) {
    const transform = creatureTransform(part);
    const values = [`--part-scale:${transform.scale / 100}`];
    if (part !== "body") {
        values.push(`--part-rotation:${transform.rotation}deg`);
        values.push(`--part-x:${transform.x}px`);
        values.push(`--part-y:${transform.y}px`);
    }
    return values.join(";");
}

function creaturePreview(draft) {
    const parts = new Set(Array.isArray(draft.parts) ? draft.parts : []);
    const body = normalizeCreatureBody(draft.body || "panda");
    const wing = parts.has("wing") ? normalizeCreatureWing(draft.wing || "angel") : "";
    const tail = parts.has("tail") ? normalizeCreatureTail(draft.tail || "fox") : "";
    const hasHorn = parts.has("horn");
    return `
        <div class="imagine-stage" data-creature-drop-zone="true">
            <div class="creature-preview raster-creature" style="--creature-color: ${draft.color || "#8fc6f5"};">
                <span class="creature-color-glow" aria-hidden="true"></span>
                ${tail ? `<img class="creature-asset asset-tail ${activeCreaturePart(draft) === "tail" ? "selected-part" : ""}" data-edit-part="tail" data-tail="${tail}" style="${creatureTransformStyle("tail")}" src="${creatureAssetUrl("tail", tail)}" alt="">` : ""}
                ${wing ? `<img class="creature-asset asset-wing ${activeCreaturePart(draft) === "wing" ? "selected-part" : ""}" data-edit-part="wing" data-wing="${wing}" style="${creatureTransformStyle("wing")}" src="${creatureAssetUrl("wing", wing)}" alt="">` : ""}
                <img class="creature-asset asset-body ${activeCreaturePart(draft) === "body" ? "selected-part" : ""}" data-edit-part="body" data-body="${body}" style="${creatureTransformStyle("body")}" src="${creatureAssetUrl("body", body)}" alt="">
                ${hasHorn ? `<img class="creature-asset asset-horn ${activeCreaturePart(draft) === "horn" ? "selected-part" : ""}" data-edit-part="horn" data-horn="horn" style="${creatureTransformStyle("horn")}" src="${creatureAssetUrl("horn", "horn")}" alt="">` : ""}
            </div>
        </div>
    `;
}

function storyView() {
    const animal = getAnimal();
    const lastStory = state.stories[0];
    const filteredStories = getFilteredStories();
    return `
        <section class="view">
            <div class="grid-2">
                <div class="panel">
                    <div class="panel-title">
                        <h3>故事设置</h3>
                        <span>${animal.icon} ${getAnimalDisplayName(animal.id)}</span>
                    </div>
                    ${animalChips()}
                    <div class="field" style="margin-top: 16px;">
                        <label for="storyTheme">主题</label>
                        <select class="select-input" id="storyTheme">
                            <option>🌙 睡前故事</option>
                            <option>🔍 探险故事</option>
                            <option>🎓 科普故事</option>
                            <option>🏆 成长故事</option>
                        </select>
                    </div>
                    <div class="field">
                        <label for="storyLength">故事长度</label>
                        <select class="select-input" id="storyLength">
                            <option value="short" ${state.storyLength === "short" ? "selected" : ""}>短故事（150-200字，2分钟）</option>
                            <option value="medium" ${state.storyLength === "medium" ? "selected" : ""}>中等故事（300-400字，5分钟）</option>
                            <option value="long" ${state.storyLength === "long" ? "selected" : ""}>长故事（500-700字，10分钟）</option>
                        </select>
                    </div>
                    <div class="field">
                        <label for="storyPrompt">故事愿望</label>
                        <div style="position: relative;">
                            <textarea class="textarea-input" id="storyPrompt" placeholder="今天想知道什么故事呀？试试点击话筒说出来..."></textarea>
                            <button class="voice-input-btn" type="button" data-action="toggle-voice-input" id="voiceInputBtn" title="语音输入（建议使用 Chrome 浏览器）">
                                <span id="voiceIcon">🎤</span>
                            </button>
                        </div>
                        <div id="voiceStatus" class="voice-status" style="display: none;">
                            <div class="voice-wave">
                                <span class="wave-bar"></span>
                                <span class="wave-bar"></span>
                                <span class="wave-bar"></span>
                                <span class="wave-bar"></span>
                                <span class="wave-bar"></span>
                            </div>
                            <p id="voiceStatusText">正在聆听...</p>
                        </div>
                    </div>
                    <div class="action-row">
                        <button class="primary-button" type="button" data-action="make-story">生成故事</button>
                        <button class="secondary-button" type="button" data-action="continue-story">续写</button>
                    </div>
                </div>
                <div class="panel">
                    <div class="panel-title">
                        <h3>最新故事</h3>
                        <span>${lastStory ? formatTime(lastStory.time) : ""}</span>
                    </div>
                    <div id="storyAnswer" class="answer-panel">
                        ${lastStory ? `<div class="story-title">${escapeHtml(lastStory.title)}</div>${escapeHtml(formatStoryText(lastStory.text))}` : "故事会显示在这里。"}
                    </div>
                    <div id="storyMeta" style="display: none;"></div>
                    <div class="action-row" style="margin-top: 10px;">
                        <button class="secondary-button" type="button" data-action="read-story" id="readStoryBtn">
                            <span style="margin-right: 4px;">🔊</span>朗读
                        </button>
                        ${lastStory ? `<button class="secondary-button" type="button" data-action="toggle-favorite">
                            <span style="margin-right: 4px;">${lastStory.isFavorite ? "⭐" : "☆"}</span>${lastStory.isFavorite ? "已收藏" : "收藏"}
                        </button>` : ""}
                    </div>
                </div>
            </div>
            <div class="panel">
                <div class="panel-title">
                    <h3>故事书架</h3>
                    <span>${state.stories.length} 篇</span>
                </div>
                <div class="field">
                    <input class="text-input" id="storySearch" placeholder="搜索故事标题或内容..." value="${escapeHtml(state.storyFilter.search || "")}">
                </div>
                <div class="action-row" style="margin-bottom: 12px;">
                    <select class="select-input" id="storyFilterAnimal">
                        <option value="">全部动物</option>
                        ${animals.map((a) => `<option value="${a.id}" ${state.storyFilter.animal === a.id ? "selected" : ""}>${a.icon} ${getAnimalDisplayName(a.id)}</option>`).join("")}
                    </select>
                    <select class="select-input" id="storySort">
                        <option value="time" ${state.storyFilter.sort === "time" ? "selected" : ""}>最新优先</option>
                        <option value="reads" ${state.storyFilter.sort === "reads" ? "selected" : ""}>阅读量优先</option>
                        <option value="favorite" ${state.storyFilter.sort === "favorite" ? "selected" : ""}>收藏优先</option>
                    </select>
                </div>
                <div class="story-list">
                    ${filteredStories.length ? filteredStories.slice(0, 6).map((story) => renderStoryCard(story)).join("") : `<div class="empty-state">没有找到匹配的故事</div>`}
                </div>
            </div>
        </section>
    `;
}

function renderStoryCard(story) {
    const animal = getAnimal(story.animalId);
    const tags = story.tags || [];
    return `
        <article class="story-item ${story.isFavorite ? "favorite" : ""}" data-story-id="${story.time}">
            <h4>${escapeHtml(story.title)}</h4>
            <p>${escapeHtml(story.text.slice(0, 120))}${story.text.length > 120 ? "..." : ""}</p>
            <div class="story-meta">
                <span class="story-tag">${animal.icon} ${getAnimalDisplayName(story.animalId)}</span>
                ${story.length ? `<span class="story-tag">${story.length === "short" ? "短篇" : story.length === "medium" ? "中篇" : "长篇"}</span>` : ""}
                ${story.readCount ? `<span class="story-tag">阅读 ${story.readCount}次</span>` : ""}
                ${story.isFavorite ? '<span style="font-size: 16px;">⭐</span>' : ""}
            </div>
        </article>
    `;
}

function getFilteredStories() {
    let filtered = [...state.stories];

    // 按动物筛选
    if (state.storyFilter.animal) {
        filtered = filtered.filter(s => s.animalId === state.storyFilter.animal);
    }

    // 按关键词搜索
    if (state.storyFilter.search) {
        const search = state.storyFilter.search.toLowerCase();
        filtered = filtered.filter(s =>
            (s.title && s.title.toLowerCase().includes(search)) ||
            (s.text && s.text.toLowerCase().includes(search))
        );
    }

    // 排序
    if (state.storyFilter.sort === "reads") {
        filtered.sort((a, b) => (b.readCount || 0) - (a.readCount || 0));
    } else if (state.storyFilter.sort === "favorite") {
        filtered.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
    } else {
        filtered.sort((a, b) => b.time - a.time);
    }

    return filtered;
}

function reportOverviewView() {
    return `<section class="view">${reportOverviewTab()}</section>`;
}

function reportAnalysisView() {
    return `<section class="view">${reportAnalysisTab()}</section>`;
}

function reportActivityView() {
    return `<section class="view">${reportActivityTab()}</section>`;
}

function reportSettingsView() {
    return `<section class="view">${reportSettingsTab()}</section>`;
}

function reportOverviewTab() {
    const totals = reportTotals();
    const favoriteAnimals = animals
        .map((animal) => ({ ...animal, count: state.progress.visits[animal.id] || 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    const maxCount = Math.max(1, ...favoriteAnimals.map((item) => item.count));

    const trendData = window.ParentReportEnhanced?.getLast7DaysActivity(state.progress.activities) || [];
    const maxTrendCount = Math.max(1, ...trendData.map(d => d.count));

    return `
        <div class="grid-3">
            <div class="metric"><strong>${totals.explored}</strong><span>已探索动物</span></div>
            <div class="metric"><strong>${state.progress.questions}</strong><span>AI知识提问</span></div>
            <div class="metric"><strong>${state.progress.feedings || 0}</strong><span>答对喂养</span></div>
            <div class="metric"><strong>${state.progress.treatments || 0}</strong><span>AI医生治疗</span></div>
            <div class="metric"><strong>${Math.round(totals.quizRate)}%</strong><span>小测验正确率</span></div>
            <div class="metric"><strong>${state.progress.activities.length}</strong><span>总活动数</span></div>
        </div>

        <div class="panel">
            <div class="panel-title">
                <h3>近7天学习趋势</h3>
                <span>活动数量</span>
            </div>
            <div class="trend-chart">
                ${trendData.map(day => `
                    <div class="trend-bar">
                        <div class="bar" style="height: ${(day.count / maxTrendCount) * 100}%;">
                            <span class="bar-value">${day.count}</span>
                        </div>
                        <span class="bar-label">${day.date}</span>
                    </div>
                `).join("")}
            </div>
        </div>

        <div class="grid-2">
            <div class="panel">
                <div class="panel-title">
                    <h3>兴趣动物</h3>
                    <span>按探索次数</span>
                </div>
                ${favoriteAnimals.map((item) => `
                    <div class="bar-row">
                        <span>${item.icon} ${item.name}</span>
                        <span class="bar-track"><span class="bar-fill" style="width: ${(item.count / maxCount) * 100}%;"></span></span>
                        <span>${item.count}</span>
                    </div>
                `).join("")}
            </div>
            <div class="panel">
                <div class="panel-title">
                    <h3>学习建议</h3>
                    <span>${roleLabel(state.profile.role)}</span>
                </div>
                <div class="detail-list">
                    <p><strong>优势：</strong>${reportStrength(totals)}</p>
                    <p><strong>下一步：</strong>${reportSuggestion(totals)}</p>
                    <p><strong>亲子话题：</strong>让孩子选一个最喜欢的动物，说出它的家、食物和一个保护方法。</p>
                </div>
            </div>
        </div>
    `;
}

function reportAnalysisTab() {
    const totals = reportTotals();
    const insights = window.ParentReportEnhanced?.getPersonalizedInsights(
        state.progress,
        state.progress.visits,
        state.progress.stories,
        state.creations.length
    ) || {};

    const timeDistribution = window.ParentReportEnhanced?.getTimeDistribution(state.progress.activities) || [];
    const achievements = window.ParentReportEnhanced?.getAchievements(
        state.progress,
        state.progress.visits,
        state.progress.stories,
        state.creations.length
    ) || [];

    const unlockedCount = achievements.filter(a => a.unlocked).length;

    return `
        ${insights.explorationType ? `
        <div class="panel">
            <div class="panel-title">
                <h3>学习画像</h3>
                <span>个性化分析</span>
            </div>
            <div class="learning-profile">
                <div class="profile-item">
                    <span class="profile-icon">${insights.explorationType.icon}</span>
                    <div>
                        <strong>探索类型：${insights.explorationType.type}</strong>
                        <p>${insights.explorationType.desc}</p>
                    </div>
                </div>
                ${insights.learningStyle ? `
                <div class="profile-item">
                    <span class="profile-icon">${insights.learningStyle.icon}</span>
                    <div>
                        <strong>学习风格：${insights.learningStyle.style}</strong>
                        <p>${insights.learningStyle.desc}</p>
                    </div>
                </div>
                ` : ""}
                ${insights.preferredTime ? `
                <div class="profile-item">
                    <span class="profile-icon">${insights.preferredTime.icon}</span>
                    <div>
                        <strong>活跃时段：${insights.preferredTime.label}</strong>
                        <p>建议安排在此时段进行深度学习</p>
                    </div>
                </div>
                ` : ""}
            </div>
        </div>
        ` : ""}

        ${timeDistribution.length > 0 ? `
        <div class="panel">
            <div class="panel-title">
                <h3>活跃时段分析</h3>
                <span>学习偏好</span>
            </div>
            <div class="time-distribution">
                ${timeDistribution.map(period => `
                    <div class="time-period-card">
                        <span class="period-icon">${period.icon}</span>
                        <div>
                            <div class="period-label">${period.label}</div>
                            <div class="period-count">${period.count} 次</div>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>
        ` : ""}

        <div class="panel">
            <div class="panel-title">
                <h3>成就徽章</h3>
                <span>${unlockedCount}/${achievements.length}</span>
            </div>
            <div class="achievement-grid">
                ${achievements.map(ach => `
                    <div class="achievement-badge ${ach.unlocked ? 'unlocked' : 'locked'}">
                        <span class="badge-icon">${ach.icon}</span>
                        <div class="badge-info">
                            <strong>${ach.name}</strong>
                            <span>${ach.desc}</span>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

function reportActivityTab() {
    return `
        <div class="panel">
            <div class="panel-title">
                <h3>活动记录</h3>
                <span>${state.progress.activities.length} 条</span>
            </div>
            <div class="activity-list">
                ${state.progress.activities.length ? state.progress.activities.slice(0, 20).map((item) => `
                    <article class="activity-item">
                        <p><strong>${escapeHtml(item.type)}</strong> ${escapeHtml(item.label)}</p>
                        <p>${formatTime(item.time)}</p>
                    </article>
                `).join("") : `<div class="empty-state">还没有学习记录。</div>`}
            </div>
        </div>
        <div class="action-row no-print">
            <button class="secondary-button" type="button" data-action="export-data">导出数据</button>
            <button class="secondary-button" type="button" data-action="print-report">打印报告</button>
            <button class="danger-button" type="button" data-action="reset-progress">清空记录</button>
        </div>
    `;
}

function reportSettingsTab() {
    return `
        <div class="panel">
            <div class="panel-title">
                <h3>⚙️ 系统设置</h3>
            </div>
            <div class="grid-2">
                <div class="field">
                    <label for="parentModelSelect">AI模型选择</label>
                    ${modelSelect("parentModelSelect")}
                </div>
                <div class="field">
                    <label for="contentFilter">内容过滤级别</label>
                    <select class="select-input" id="contentFilter">
                        <option value="strict" ${(state.contentFilter || "moderate") === "strict" ? "selected" : ""}>严格（推荐3-6岁）</option>
                        <option value="moderate" ${(state.contentFilter || "moderate") === "moderate" ? "selected" : ""}>适中（推荐7-10岁）</option>
                        <option value="relaxed" ${(state.contentFilter || "moderate") === "relaxed" ? "selected" : ""}>宽松（10岁以上）</option>
                    </select>
                </div>
            </div>
            <div class="grid-2">
                <div class="field">
                    <label for="dailyLimit">每日使用时长限制</label>
                    <select class="select-input" id="dailyLimit">
                        <option value="0" ${(state.dailyLimit || 0) == 0 ? "selected" : ""}>不限制</option>
                        <option value="30" ${(state.dailyLimit || 0) == 30 ? "selected" : ""}>30分钟</option>
                        <option value="60" ${(state.dailyLimit || 0) == 60 ? "selected" : ""}>1小时</option>
                        <option value="90" ${(state.dailyLimit || 0) == 90 ? "selected" : ""}>1.5小时</option>
                        <option value="120" ${(state.dailyLimit || 0) == 120 ? "selected" : ""}>2小时</option>
                    </select>
                </div>
                <div class="field">
                    <label for="autoSave">自动保存进度</label>
                    <select class="select-input" id="autoSave">
                        <option value="true" ${(state.autoSave !== false) ? "selected" : ""}>开启</option>
                        <option value="false" ${(state.autoSave === false) ? "selected" : ""}>关闭</option>
                    </select>
                </div>
            </div>
        </div>
    `;
}

function reportTotals() {
    const explored = Object.values(state.progress.visits).filter((count) => count > 0).length;
    const quizRate = state.progress.quizTotal ? (state.progress.quizCorrect / state.progress.quizTotal) * 100 : 0;
    return { explored, quizRate };
}

function reportStrength(totals) {
    if (state.progress.stories >= 2) return "能把知识点放进故事里，说明理解和表达都有进步。";
    if (state.progress.questions >= 3) return "会主动提问，适合继续做比较和观察。";
    if (totals.explored >= 4) return "愿意探索不同栖息地，已经开始建立动物分类意识。";
    return "已经开始认识动物和栖息地，可以从最喜欢的动物继续深入。";
}

function reportSuggestion(totals) {
    if (totals.explored < 4) return "先在地图上探索 4 种动物，再进行问答和故事。";
    if (state.progress.quizTotal < 3) return "每天完成 1 道小测验，巩固食物、栖息地和身体特征。";
    if (state.creations.length < 1) return "进入想象动物区，把真实动物特征组合成原创动物。";
    return "尝试让孩子用自己的话讲一篇动物保护故事。";
}
