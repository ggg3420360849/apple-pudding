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
    // Saved/synced progress can already satisfy a requirement before this page
    // loads. Reconcile silently so returning from parent mode does not replay
    // an old unlock animation every time.
    checkAndUnlockAnimals({ silent: true });
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
    const parentChildReportView = state.profile.role === "parent" && state.selectedChild;
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
                    ${parentChildReportView ? `
                        <div class="action-row parent-return-row no-print">
                            <button class="secondary-button" type="button" onclick="backToParentPortal()" title="返回选择孩子页面">返回选孩子</button>
                        </div>
                    ` : state.profile.role === "parent" ? `
                        <div class="action-row no-print">
                            <button class="settings-button" type="button" data-action="toggle-settings" aria-label="设置" title="设置">⚙️</button>
                        </div>
                        ${state.settingsOpen ? settingsMenu() : ""}
                    ` : ""}
                </div>
                ${renderRoute()}
            </main>
        </div>
        ${renderCareDoctorModal()}
        ${renderCareFeedConfirmModal()}
        <div id="toast" class="toast hide"></div>
    `;
}

function renderCareDoctorModal() {
    const modal = state.careDoctorModal;
    if (!modal) return "";

    const isLoading = modal.status === "loading";
    const animal = animals.find((item) => item.id === modal.animalId);
    const icon = animal?.icon || "🩺";

    return `
        <div class="care-doctor-overlay">
            <div class="care-doctor-modal" role="dialog" aria-modal="true" aria-label="AI医生照护建议">
                <div class="care-doctor-header">
                    <div class="care-doctor-icon">${icon}</div>
                    <div>
                        <span class="care-doctor-kicker">AI动物医生</span>
                        <h3>${isLoading ? "正在诊断..." : `${escapeHtml(modal.animalName || "小动物")}的照护建议`}</h3>
                    </div>
                </div>
                <div class="care-doctor-body">
                    <div class="care-doctor-section">
                        <strong>为什么不舒服</strong>
                        <p>${escapeHtml(modal.why || modal.cause || modal.title || "需要再观察一下状态。")}</p>
                    </div>
                    <div class="care-doctor-section">
                        <strong>怎么照护</strong>
                        <div class="care-doctor-answer ${isLoading ? "loading" : ""}">
                            ${isLoading ? "AI医生正在看症状，马上告诉你原因和照护方法..." : escapeHtml(modal.treatment || modal.reply || modal.action || "先安静休息，继续观察。")}
                        </div>
                    </div>
                    ${isLoading ? "" : `<div class="meta-line">AI医生回复不一定准确｜这只是儿童科普建议，严重情况要联系真正的兽医。</div>`}
                </div>
                <div class="care-doctor-actions">
                    <button class="secondary-button" type="button" data-action="close-care-doctor-modal" ${isLoading ? "disabled" : ""}>
                        ${isLoading ? "诊断中..." : "知道了"}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderCareFeedConfirmModal() {
    const confirm = state.careFeedConfirm;
    if (!confirm) return "";

    return `
        <div class="care-doctor-overlay">
            <div class="care-feed-confirm-modal" role="dialog" aria-modal="true" aria-label="确认不投喂">
                <div class="care-feed-confirm-icon">🍽️</div>
                <h3>确定不投喂吗？</h3>
                <p>${escapeHtml(confirm.animalName || "小动物")}现在还饿着。如果一直不处理，它可能会因为饿太久变得不舒服。</p>
                <div class="care-feed-confirm-actions">
                    <button class="secondary-button" type="button" data-action="close-care-feed-confirm">继续选食物</button>
                    <button class="primary-button" type="button" data-action="confirm-skip-care-feed">确定不投喂</button>
                </div>
            </div>
        </div>
    `;
}

function settingsMenu() {
    if (state.profile?.role !== "parent") return "";
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
    const lockLabels = {
        penguin: "❄️ 冰雪海岸",
        tiger: "🌲 森林",
        frog: "🪷 池塘湿地",
        dolphin: "🌊 珊瑚海湾",
        camel: "🏜️ 沙漠绿洲"
    };
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
            <div class="map-label ${!isAnimalUnlocked("penguin") ? "map-label-covered" : ""}" style="right: 5%; top: 4%; --tilt: -2deg;">❄️ 冰雪海岸</div>
            <div class="map-label" style="left: 25%; top: 23%; --tilt: -3deg;">🎋 竹林山地</div>
            <div class="map-label ${!isAnimalUnlocked("tiger") ? "map-label-covered" : ""}" style="right: 7%; top: 31%; --tilt: 2deg;">🌲 森林</div>
            <div class="map-label ${!grasslandUnlocked ? "map-label-covered" : ""}" style="left: 32%; top: 43%; --tilt: -2deg;">🌼 阳光草原</div>
            <div class="map-label ${!isAnimalUnlocked("frog") ? "map-label-covered" : ""}" style="left: 5%; top: 59%; --tilt: 2deg;">🪷 池塘湿地</div>
            <div class="map-label ${!isAnimalUnlocked("dolphin") ? "map-label-covered" : ""}" style="right: 3%; top: 64%; --tilt: 2deg;">🌊 珊瑚海湾</div>
            <div class="map-label ${!isAnimalUnlocked("camel") ? "map-label-covered" : ""}" style="left: 28%; top: 82%; --tilt: -2deg;">🏜️ 沙漠绿洲</div>
            ${!grasslandUnlocked ? `
                <button class="marker locked ${grasslandProgress?.percentage >= 80 ? 'almost-unlocked' : ''}"
                        type="button"
                        style="left:52%; top:44%; --lock-width:116px;"
                        data-locked-animal="grassland"
                        aria-label="查看兔子和大象的共同解锁方法">
                    <span class="map-lock-text">🌼 阳光草原</span>
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
                        <span class="map-lock-text">${escapeHtml(lockLabels[animal.id] || animal.habitat)}</span>
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
    if (currentQuiz.correct) return `答对了，获得 1 份${currentQuiz.food}。等${getAnimalDisplayName(animal.id)}饿了就能投喂。`;
    return `答错了，正确答案是：${quiz.options[quiz.answer]}。继续完成今天的题吧。`;
}

function renderFoodInventory(animal) {
    const profile = getAnimalCareProfile(animal);
    const count = getFoodCount(animal.id, profile.favoriteFood);

    return `
        <div class="food-inventory">
            <span class="food-inventory-label">食物背包</span>
            <span class="food-pill">${escapeHtml(profile.favoriteFood)} × ${count}</span>
        </div>
    `;
}

function renderCareEventPanel(animal, event) {
    if (!event || event.status === "scheduled") {
        return "";
    }

    const doctorLoading = state.careDoctorModal?.animalId === animal.id && state.careDoctorModal?.status === "loading";

    if (event.type === "hungry") {
        const selectedIndexes = new Set(getSelectedCareFeedIndexes(event));
        const selectedCount = selectedIndexes.size;

        return `
            <div class="care-event-card hungry">
                <div class="care-event-header">
                    <div>
                        <strong>${escapeHtml(getAnimalDisplayName(animal.id))}饿了</strong>
                        <p>可以多选食物，选好后再点击投喂。如果一直不喂，它可能会生病。</p>
                    </div>
                </div>
                <div class="feeding-options">
                    ${event.options.map((option, index) => {
                        const selected = selectedIndexes.has(index);
                        return `
                        <button class="food-choice-button ${selected ? "selected" : ""}" type="button" data-feed-option="${index}" aria-pressed="${selected}">
                            ${selected ? "✓ " : ""}${escapeHtml(option.food)}
                        </button>
                    `}).join("")}
                </div>
                <div class="feeding-action-row">
                    <button class="secondary-button" type="button" data-action="clear-care-feed-selection" ${selectedCount ? "" : "disabled"}>清空选择</button>
                    <button class="primary-button feed-submit-button" type="button" data-action="submit-care-feed">
                        投喂${selectedCount ? `（${selectedCount}个）` : ""}
                    </button>
                </div>
            </div>
        `;
    }

    return `
        <div class="care-event-card sick">
            <div>
                <strong>${escapeHtml(event.title || "有点不舒服")}</strong>
                <p>${escapeHtml(event.cause || "需要温和照护。")}</p>
                <p>${escapeHtml(event.action || "先观察状态，保持安静。")}</p>
            </div>
            <button class="primary-button" type="button" data-action="treat-care-event" ${doctorLoading ? "disabled" : ""}>
                ${doctorLoading ? "AI医生正在诊断..." : "请AI医生照护"}
            </button>
        </div>
    `;
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
                        <div class="animal-selection-item locked">
                            <span class="selection-icon" style="filter: grayscale(100%); opacity: 0.4;">${animal.icon}</span>
                            <span class="selection-name" style="color: #888;">???</span>
                            <div class="selection-lock">🔒</div>
                            ${progress ? `
                                <div class="selection-progress">
                                    <div class="selection-progress-track">
                                        <div class="selection-progress-fill" style="width: ${progress.percentage}%;"></div>
                                    </div>
                                    <div class="selection-progress-text">${progress.percentage}%</div>
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
    scheduleDailyQuizGeneration(animal);
    const careEvent = ensureCareEvent(animal);
    const lastAnswer = state.answers[0];
    const qaRequest = state.qaRequest;
    const isQaLoading = Boolean(qaRequest?.isLoading);
    const lastDoctorLog = state.doctorLogs.find((item) => item.animalId === animal.id);
    const lastFeeding = state.feedingLogs.find((item) => item.animalId === animal.id);
    const activeQuiz = getActiveAnimalQuiz(animal);
    const quizList = getAnimalQuizList(animal);
    const quizCursor = getAnimalQuizCursor(animal);
    const dailySet = getDailyQuizSet(animal);
    const savedQuizAnswer = activeQuiz && dailySet?.answers?.[activeQuiz.index]
        ? dailySet.answers[activeQuiz.index]
        : null;
    const currentQuiz = state.lastQuiz
        && state.lastQuiz.animalId === animal.id
        && activeQuiz
        && state.lastQuiz.quizIndex === activeQuiz.index
        ? state.lastQuiz
        : (savedQuizAnswer ? {
            animalId: animal.id,
            quizIndex: activeQuiz.index,
            question: activeQuiz.question,
            options: activeQuiz.options,
            answer: activeQuiz.answer,
            choice: savedQuizAnswer.choice,
            correct: savedQuizAnswer.correct,
            food: getAnimalCareProfile(animal).favoriteFood,
            time: savedQuizAnswer.time
        } : null);
    const animalFeedings = state.feedingLogs.filter((item) => item.animalId === animal.id).length;
    const animalTreatments = state.doctorLogs.filter((item) => item.animalId === animal.id).length;
    const animalIntimacy = getAnimalIntimacy(animal.id);
    const animalLevel = Math.floor(animalIntimacy / 3) + 1; // Level up every 3 intimacy points
    const intimacyProgress = animalIntimacy % 3;
    const intimacyPercent = (intimacyProgress / 3) * 100;
    const dailyProgress = getDailyQuizProgress(animal);

    // 获取当前动物状态
    const eventState = careEventToAnimalState(careEvent);
    const currentState = eventState || state.animalStates?.[animal.id] || getRandomAnimalState(animal.id);

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
                        <div class="level-info">
                            <div class="level-info-header">
                                <span class="level-label">亲密度</span>
                                <span class="level-progress-text">${intimacyProgress}/3</span>
                            </div>
                            <div class="level-progress">
                                <div class="level-progress-fill" style="width: ${intimacyPercent}%;"></div>
                            </div>
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
                    ${renderFoodInventory(animal)}
                </div>
            </div>

            <div class="knowledge-qa-section">
                ${renderCareEventPanel(animal, careEvent)}
                <div class="panel qa-panel">
                    <div class="panel-title">
                        <h3>知识提问</h3>
                    </div>
                    <div class="field">
                        <div style="position: relative;">
                            <textarea class="textarea-input" id="qaQuestion" placeholder="想问什么问题呢？试试点击话筒说出来..." ${isQaLoading ? 'disabled' : ''}>${isQaLoading ? escapeHtml(qaRequest.question) : ''}</textarea>
                            <button class="voice-input-btn" type="button" data-action="toggle-voice-input-qa" id="voiceInputBtnQa" title="语音输入（建议使用 Chrome 浏览器）" ${isQaLoading ? 'disabled' : ''}>
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
                            ${state.currentQuickQuestion.isGenerating || isQaLoading ? 'disabled' : ''}>
                            ${escapeHtml(state.currentQuickQuestion.question)}
                        </button>
                        <button
                            class="refresh-question-btn ${state.currentQuickQuestion.isGenerating ? 'loading' : ''}"
                            type="button"
                            data-action="refresh-quick-question"
                            ${state.currentQuickQuestion.isGenerating || isQaLoading ? 'disabled' : ''}
                            title="换一个问题"
                            aria-label="换一个问题">
                            ${state.currentQuickQuestion.isGenerating ? '⏳' : '🔄'}
                        </button>
                    </div>
                    <div class="action-row" style="margin-top: 14px;">
                        <button
                            class="primary-button"
                            type="button"
                            data-action="ask-qa"
                            ${isQaLoading ? 'disabled' : ''}>
                            ${isQaLoading ? `正在回答你的问题（${qaRequest.elapsedSeconds}秒）` : '问问动物大师'}
                        </button>
                    </div>
                    ${(isQaLoading || lastAnswer) ? `
                        <div class="qa-answer-box" style="margin-top: 20px;">
                            <div class="answer-label">回答${isQaLoading ? '' : `
                                <button
                                    class="read-answer-icon"
                                    type="button"
                                    data-action="read-qa-answer"
                                    id="readQaBtn"
                                    title="朗读回答">
                                    <span id="readQaIcon" class="read-answer-icon-symbol">🔊</span>
                                </button>
                            `}</div>
                            <div id="qaAnswer" class="answer-panel ${isQaLoading ? 'loading' : ''}">
                                ${isQaLoading ? '正在回答你的问题，请稍等...' : escapeHtml(lastAnswer.reply)}
                            </div>
                            <div id="qaMeta" class="meta-line">${isQaLoading ? `已等待 ${qaRequest.elapsedSeconds} 秒` : ''}</div>
                        </div>
                    ` : ''}
                </div>

                <div class="panel">
                    <div class="panel-title" style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="font-size: 24px; margin: 0;">每日答题</h3>
                        <span>今日 ${dailyProgress.answered}/${dailyProgress.total} 题 · 正确 ${dailyProgress.correct}</span>
                    </div>
                    <div class="quiz-box">
                        ${dailyProgress.isGenerating && !getDailyQuizSet(animal) ? `
                            <p class="quiz-question">正在生成今天的4道题...</p>
                            <div class="meta-line">模型会尽量生成不同题型，稍等一下。</div>
                        ` : activeQuiz ? `
                            <p class="quiz-question">${activeQuiz.question}</p>
                            <div class="choice-list">
                                ${activeQuiz.options.map((option, index) => quizChoiceButton(activeQuiz, option, index, currentQuiz)).join("")}
                            </div>
                            <div id="quizResult" class="meta-line">${escapeHtml(quizResultText(animal, currentQuiz, activeQuiz))}</div>
                            ${currentQuiz ? `
                                <div class="quiz-followup-actions">
                                    <button class="secondary-button" type="button" data-action="reset-quiz">${quizCursor + 1 >= quizList.length ? "完成今日题目" : "下一题"}</button>
                                </div>
                            ` : ""}
                        ` : `
                            <p class="quiz-question">今天的4道题已经完成啦。</p>
                            <div class="meta-line">答对获得的食物会留在背包里，等随机饥饿事件出现时投喂。</div>
                        `}
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
    const head = parts.includes("head") && draft.head ? normalizeCreatureHead(draft.head) : "";
    const body = parts.includes("body") && draft.body ? normalizeCreatureBody(draft.body) : "";
    const leftHand = parts.includes("leftHand") ? normalizeCreatureHand(draft.leftHand || creatureHands[0].id) : "";
    const rightHand = parts.includes("rightHand") ? normalizeCreatureHand(draft.rightHand || creatureHands[0].id) : "";
    const leftFoot = parts.includes("leftFoot") ? normalizeCreatureFoot(draft.leftFoot || creatureFeet[0].id) : "";
    const rightFoot = parts.includes("rightFoot") ? normalizeCreatureFoot(draft.rightFoot || creatureFeet[0].id) : "";
    const wing = parts.includes("wing") ? normalizeCreatureWing(draft.wing || creatureWings[0].id) : "";
    const tail = parts.includes("tail") && creatureTails.length ? normalizeCreatureTail(draft.tail || creatureTails[0].id) : "";
    const decoration = parts.includes("decoration") && creatureDecorations.length ? normalizeCreatureDecoration(draft.decoration || creatureDecorations[0].id) : "";
    const selectedPart = activeCreaturePart(draft);
    const draftStory = creatureStoryLine(draft);
    return `
        <section class="imagine-screen">
            <header class="imagine-intro">
                <span class="imagine-kicker">✦ 森林手作屋 ✦</span>
                <h3>今天要创造谁？</h3>
                <p>挑一挑、拼一拼，让奇妙的新朋友从画纸里醒来！</p>
            </header>
            <div class="creator-board unified-materials">
                <div class="material-rail">
                    <div class="material-group">
                        <p class="material-title"><span>①</span> 头</p>
                        <div class="material-list asset-list" data-asset-list="head">
                            ${creatureHeads.map((item) => creatureMaterialButton("head", item, head === item.id)).join("")}
                        </div>
                    </div>
                    <div class="material-group">
                        <p class="material-title"><span>②</span> 身体</p>
                        <div class="material-list asset-list" data-asset-list="body">
                            ${creatureBodies.map((item) => creatureMaterialButton("body", item, body === item.id)).join("")}
                        </div>
                    </div>
                    <div class="material-group">
                        <p class="material-title"><span>③</span> 左手</p>
                        <div class="material-list asset-list" data-asset-list="leftHand">
                            ${creatureHands.map((item) => creatureMaterialButton("leftHand", item, leftHand === item.id)).join("")}
                        </div>
                    </div>
                    <div class="material-group">
                        <p class="material-title"><span>④</span> 右手</p>
                        <div class="material-list asset-list" data-asset-list="rightHand">
                            ${creatureHands.map((item) => creatureMaterialButton("rightHand", item, rightHand === item.id)).join("")}
                        </div>
                    </div>
                    <div class="material-group">
                        <p class="material-title"><span>⑤</span> 左脚</p>
                        <div class="material-list asset-list" data-asset-list="leftFoot">
                            ${creatureFeet.map((item) => creatureMaterialButton("leftFoot", item, leftFoot === item.id)).join("")}
                        </div>
                    </div>
                    <div class="material-group">
                        <p class="material-title"><span>⑥</span> 右脚</p>
                        <div class="material-list asset-list" data-asset-list="rightFoot">
                            ${creatureFeet.map((item) => creatureMaterialButton("rightFoot", item, rightFoot === item.id)).join("")}
                        </div>
                    </div>
                    <div class="material-group">
                        <p class="material-title"><span>⑦</span> 尾巴</p>
                        <div class="material-list asset-list" data-asset-list="tail">
                            ${creatureMaterialList("tail", creatureTails, tail)}
                        </div>
                    </div>
                    <div class="material-group">
                        <p class="material-title"><span>⑧</span> 翅膀</p>
                        <div class="material-list asset-list" data-asset-list="wing">
                            ${creatureWings.map((item) => creatureMaterialButton("wing", item, wing === item.id)).join("")}
                        </div>
                    </div>
                    <div class="material-group">
                        <p class="material-title"><span>⑨</span> 装饰</p>
                        <div class="material-list asset-list" data-asset-list="decoration">
                            ${creatureMaterialList("decoration", creatureDecorations, decoration)}
                        </div>
                    </div>
                </div>
                <div class="stage-card">
                    <span class="imagine-sticker sticker-star" aria-hidden="true"></span>
                    <span class="imagine-sticker sticker-leaf" aria-hidden="true"></span>
                    <span class="imagine-sticker sticker-pencil" aria-hidden="true"></span>
                    ${creaturePreview(draft)}
                </div>
            </div>
            ${selectedPart ? creatureTransformControls(selectedPart) : ""}
            <div class="compose-hint">
                <span class="hint-icon">✎</span>
                <strong>点一下画布上的元素，再用下面按钮旋转、放大或缩小</strong>
            </div>
            <div class="creature-live-note">
                <span>它正在变成...</span>
                <strong>${escapeHtml(draft.name || "新朋友")}</strong>
                <p>${escapeHtml(draftStory)}</p>
            </div>
            <div class="creature-card">
                <div class="creature-thumb" style="background: linear-gradient(180deg, ${draft.color || "#8fc6f5"}55, #d6edb9);">${creatureSnapshotMarkup(draft, "thumb")}</div>
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
                <p class="creature-summary">${escapeHtml(draft.mood)}，住在${escapeHtml(draft.habitat)}。已经选择 ${[head && "头", body && "身体", leftHand && "左手", rightHand && "右手", leftFoot && "左脚", rightFoot && "右脚", wing && "翅膀", tail && "尾巴", decoration && "装饰"].filter(Boolean).join("、") || "还没有选择素材"}。</p>
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
                        <article class="collection-item creature-album-card">
                            <div class="album-thumb" style="background: linear-gradient(180deg, ${(item.color || "#8fc6f5")}55, #fff1b6);">
                                ${creatureSnapshotMarkup(item, "album")}
                            </div>
                            <div class="album-copy">
                                <span class="album-kicker">${escapeHtml(item.mood || "好奇")} · ${escapeHtml(item.habitat || "秘密花园")}</span>
                                <h4>${escapeHtml(item.name)}</h4>
                                <p>${escapeHtml(item.story || creatureStoryLine(item))}</p>
                                <small>${escapeHtml((item.parts || []).join("、") || item.ability || "慢慢观察")}</small>
                            </div>
                        </article>
                    `).join("")}
                </div>
            ` : ""}
        </section>
    `;
}

function creatureAssetUrl(type, id) {
    const lists = {
        head: creatureHeads,
        body: creatureBodies,
        hand: creatureHands,
        leftHand: creatureHands,
        rightHand: creatureHands,
        foot: creatureFeet,
        leftFoot: creatureFeet,
        rightFoot: creatureFeet,
        wing: creatureWings,
        tail: creatureTails,
        decoration: creatureDecorations
    };
    const list = lists[type] || creatureBodies;
    const fallback = list[0];
    if (!fallback) return "";
    const item = list.find((asset) => asset.id === id) || fallback;
    return `${imagineAssetBase}${item.file}`;
}

function normalizeCreatureHead(id) {
    return creatureHeads.some((item) => item.id === id) ? id : "panda";
}

function normalizeCreatureBody(id) {
    return { puppy: "dog", bunny: "rabbit" }[id] || (creatureBodies.some((item) => item.id === id) ? id : "panda");
}

function normalizeCreatureHand(id) {
    if (!id) return "";
    return creatureHands.some((item) => item.id === id) ? id : creatureHands[0].id;
}

function normalizeCreatureFoot(id) {
    if (!id) return "";
    return creatureFeet.some((item) => item.id === id) ? id : creatureFeet[0].id;
}

function normalizeCreatureWing(id) {
    if (!id) return "";
    return creatureWings.some((item) => item.id === id) ? id : creatureWings[0].id;
}

function normalizeCreatureTail(id) {
    if (!id) return "";
    return creatureTails.some((item) => item.id === id) ? id : creatureTails[0]?.id || "";
}

function normalizeCreatureDecoration(id) {
    if (!id) return "";
    return creatureDecorations.some((item) => item.id === id) ? id : creatureDecorations[0]?.id || "";
}

function creatureMaterialList(type, items, activeId) {
    if (!items.length) return `<span class="material-empty">素材待添加</span>`;
    return items.map((item) => creatureMaterialButton(type, item, activeId === item.id)).join("");
}

function creatureMaterialButton(type, item, active) {
    const splitSide = type.startsWith("left") ? "left" : (type.startsWith("right") ? "right" : "");
    const sideLabel = splitSide === "left" ? "左" : (splitSide === "right" ? "右" : "");
    const image = splitSide
        ? `<span class="material-part-crop split-${splitSide}"><img class="material-img" src="${imagineAssetBase}${item.file}" alt=""></span>`
        : `<img class="material-img" src="${imagineAssetBase}${item.file}" alt="">`;
    return `<button class="material-button ${active ? "active" : ""}" type="button" draggable="true" data-creature-part-type="${type}" data-creature-part-id="${item.id}" data-creature-${type}="${item.id}" aria-label="${sideLabel}${item.label}" title="${sideLabel}${item.label}">${image}</button>`;
}

function selectedCreaturePartLabel(part) {
    return {
        head: "头",
        body: "身体",
        leftHand: "左手",
        rightHand: "右手",
        leftFoot: "左脚",
        rightFoot: "右脚",
        tail: "尾巴",
        wing: "翅膀",
        decoration: "装饰"
    }[part] || "元素";
}

function creatureTransformControls(selectedPart) {
    return `
        <div class="transform-toolbar" aria-label="画布元素调整">
            <span class="transform-label">当前选中：${selectedCreaturePartLabel(selectedPart)}</span>
            <button class="transform-button" type="button" data-action="scale-part-down" aria-label="缩小" title="缩小">-</button>
            <button class="transform-button" type="button" data-action="scale-part-up" aria-label="放大" title="放大">+</button>
            <button class="transform-button" type="button" data-action="rotate-part-left" aria-label="左转" title="左转">⟲</button>
            <button class="transform-button" type="button" data-action="rotate-part-right" aria-label="右转" title="右转">⟳</button>
            <button class="transform-button transform-button-reset" type="button" data-action="reset-part-transform" aria-label="恢复默认" title="恢复默认">重置</button>
        </div>
    `;
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
    return { scale: 100, rotation: 0, x: 0, y: 0 };
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
    const selected = draft.selectedPart || "";
    const supported = new Set(["head", "body", "leftHand", "rightHand", "leftFoot", "rightFoot", "wing", "tail", "decoration"]);
    if (supported.has(selected) && parts.has(selected)) return selected;
    return ["body", "head", "leftHand", "rightHand", "leftFoot", "rightFoot", "wing", "tail", "decoration"].find((part) => parts.has(part)) || "";
}

function creatureTransformStyle(part, draft = state.draftCreature) {
    const transform = {
        ...defaultCreatureTransform(part),
        ...((draft.transforms || {})[part] || {})
    };
    const values = [
        `--part-scale:${transform.scale / 100}`,
        `--part-rotation:${transform.rotation}deg`,
        `--part-x:${transform.x}px`,
        `--part-y:${transform.y}px`
    ];
    return values.join(";");
}

function splitCreaturePartMarkup(part, id, variant, selected = false, draft = state.draftCreature) {
    if (!id) return "";
    const isHand = part === "leftHand" || part === "rightHand";
    const kind = isHand ? "hand" : "foot";
    const side = part.startsWith("left") ? "left" : "right";
    const kebabPart = `${side}-${kind}`;
    if (variant === "stage") {
        return `<span class="creature-asset split-creature-asset asset-${kebabPart} ${selected ? "selected-part" : ""}" data-composition-part="${part}" data-edit-part="${part}" data-${kebabPart}="${id}" style="${creatureTransformStyle(part, draft)}"><img src="${creatureAssetUrl(kind, id)}" alt=""></span>`;
    }
    return `<span class="creature-asset split-creature-asset asset-${kebabPart}" data-composition-part="${part}" style="${creatureTransformStyle(part, draft)}"><img src="${creatureAssetUrl(kind, id)}" alt=""></span>`;
}

function creatureCompositionMarkup(draft, interactive = false) {
    const parts = new Set(Array.isArray(draft.parts) ? draft.parts : []);
    const keyedParts = [...parts].some((part) => ["head", "body", "leftHand", "rightHand", "leftFoot", "rightFoot", "wing", "tail", "decoration"].includes(part));
    const included = (part, value) => Boolean(value) && (keyedParts ? parts.has(part) : true);
    const head = included("head", draft.head) ? normalizeCreatureHead(draft.head) : "";
    const body = included("body", draft.body) ? normalizeCreatureBody(draft.body) : "";
    const leftHand = included("leftHand", draft.leftHand) ? normalizeCreatureHand(draft.leftHand) : "";
    const rightHand = included("rightHand", draft.rightHand) ? normalizeCreatureHand(draft.rightHand) : "";
    const leftFoot = included("leftFoot", draft.leftFoot) ? normalizeCreatureFoot(draft.leftFoot) : "";
    const rightFoot = included("rightFoot", draft.rightFoot) ? normalizeCreatureFoot(draft.rightFoot) : "";
    const legacyHand = draft.hand ? normalizeCreatureHand(draft.hand) : "";
    const legacyFoot = draft.foot ? normalizeCreatureFoot(draft.foot) : "";
    const wing = included("wing", draft.wing) ? normalizeCreatureWing(draft.wing) : "";
    const tail = included("tail", draft.tail) && creatureTails.length ? normalizeCreatureTail(draft.tail) : "";
    const decoration = included("decoration", draft.decoration) && creatureDecorations.length ? normalizeCreatureDecoration(draft.decoration) : "";
    const selectedPart = interactive ? activeCreaturePart(draft) : "";
    const edit = (part, attribute, id) => interactive ? `data-edit-part="${part}" data-${attribute}="${id}"` : "";
    return `
        <div class="creature-preview raster-creature ${interactive ? "" : "snapshot-composition"}" style="--creature-color: ${draft.color || "#8fc6f5"};">
            <span class="creature-color-glow" aria-hidden="true"></span>
            ${tail ? `<img class="creature-asset asset-tail ${selectedPart === "tail" ? "selected-part" : ""}" data-composition-part="tail" ${edit("tail", "tail", tail)} style="${creatureTransformStyle("tail", draft)}" src="${creatureAssetUrl("tail", tail)}" alt="">` : ""}
            ${wing ? `<img class="creature-asset asset-wing ${selectedPart === "wing" ? "selected-part" : ""}" data-composition-part="wing" ${edit("wing", "wing", wing)} style="${creatureTransformStyle("wing", draft)}" src="${creatureAssetUrl("wing", wing)}" alt="">` : ""}
            ${body ? `<img class="creature-asset asset-body ${selectedPart === "body" ? "selected-part" : ""}" data-composition-part="body" ${edit("body", "body", body)} style="${creatureTransformStyle("body", draft)}" src="${creatureAssetUrl("body", body)}" alt="">` : ""}
            ${head ? `<img class="creature-asset asset-head ${selectedPart === "head" ? "selected-part" : ""}" data-composition-part="head" ${edit("head", "head", head)} style="${creatureTransformStyle("head", draft)}" src="${creatureAssetUrl("head", head)}" alt="">` : ""}
            ${splitCreaturePartMarkup("leftHand", leftHand, interactive ? "stage" : "snapshot", selectedPart === "leftHand", draft)}
            ${splitCreaturePartMarkup("rightHand", rightHand, interactive ? "stage" : "snapshot", selectedPart === "rightHand", draft)}
            ${splitCreaturePartMarkup("leftFoot", leftFoot, interactive ? "stage" : "snapshot", selectedPart === "leftFoot", draft)}
            ${splitCreaturePartMarkup("rightFoot", rightFoot, interactive ? "stage" : "snapshot", selectedPart === "rightFoot", draft)}
            ${legacyHand ? `<img class="creature-asset asset-hand" data-composition-part="hand" style="${creatureTransformStyle("hand", draft)}" src="${creatureAssetUrl("hand", legacyHand)}" alt="">` : ""}
            ${legacyFoot ? `<img class="creature-asset asset-foot" data-composition-part="foot" style="${creatureTransformStyle("foot", draft)}" src="${creatureAssetUrl("foot", legacyFoot)}" alt="">` : ""}
            ${decoration ? `<img class="creature-asset asset-decoration ${selectedPart === "decoration" ? "selected-part" : ""}" data-composition-part="decoration" ${edit("decoration", "decoration", decoration)} style="${creatureTransformStyle("decoration", draft)}" src="${creatureAssetUrl("decoration", decoration)}" alt="">` : ""}
        </div>
    `;
}

function creatureSnapshotMarkup(draft, variant) {
    const snapshot = typeof draft.snapshot === "string" ? draft.snapshot : "";
    return `
        <div class="creature-snapshot creature-snapshot-${variant}">
            ${snapshot
                ? `<img class="saved-creature-snapshot" src="${snapshot}" alt="${escapeHtml(draft.name || "我的奇妙动物")}">`
                : `<span class="creature-snapshot-placeholder">收藏后生成</span>`}
        </div>
    `;
}

function creaturePreview(draft) {
    return `
        <div class="imagine-stage" data-creature-drop-zone="true">
            ${creatureCompositionMarkup(draft, true)}
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

function formatSyncTimeText(value) {
    if (!value) return "尚未同步";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "尚未同步";

    return `上次同步：${date.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    })}`;
}

function formatParentSyncStatusText(selectedChild = {}) {
    const selectedChildId = selectedChild.id || "";
    const refreshedAt = state.lastSyncRefreshAt;
    const refreshedChildId = state.lastSyncRefreshChildId || "";

    if (refreshedAt && selectedChildId && refreshedChildId === selectedChildId) {
        const refreshDate = new Date(refreshedAt);
        if (!Number.isNaN(refreshDate.getTime())) {
            return `刷新完成：${refreshDate.toLocaleString("zh-CN", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            })}`;
        }
    }

    return formatSyncTimeText(
        selectedChild.last_synced_at
        || state.linkedChildProfile?.last_synced_at
        || state.lastSyncedAt
    );
}

function renderReportMetricCard(key, value, label) {
    const active = state.reportMetricDetail === key;
    return `
        <div class="metric-stack ${active ? "active" : ""}">
            <button
                class="metric metric-button ${active ? "active" : ""}"
                type="button"
                data-action="open-report-metric"
                data-metric-key="${key}"
                aria-expanded="${active ? "true" : "false"}"
            >
                <strong>${value}</strong>
                <span>${label}</span>
            </button>
            ${active ? renderReportMetricDetailPanel(key) : ""}
        </div>
    `;
}

function reportMetricActivities(filterFn) {
    const activities = Array.isArray(state.progress.activities) ? state.progress.activities : [];
    return activities.filter((item) => item && (!filterFn || filterFn(item)));
}

function renderReportMetricActivityList(items, emptyText) {
    if (!items.length) {
        return `<div class="empty-state">${emptyText}</div>`;
    }

    return `
        <div class="activity-list">
            ${items.slice(0, 20).map((item) => `
                <article class="activity-item">
                    <p class="activity-main"><strong>${escapeHtml(item.type)}</strong> ${escapeHtml(item.label)}</p>
                    <time class="activity-time">${formatTime(item.time)}</time>
                </article>
            `).join("")}
        </div>
    `;
}

function renderReportMetricDetailPanel(key) {
    const allActivities = reportMetricActivities();
    const exploredAnimals = animals
        .map((animal) => ({
            ...animal,
            count: state.progress.visits?.[animal.id] || 0
        }))
        .filter((animal) => animal.count > 0)
        .sort((a, b) => b.count - a.count);
    const maxCount = Math.max(1, ...exploredAnimals.map((animal) => animal.count), 1);

    let title = "";
    let summary = "";
    let body = "";

    if (key === "explored") {
        const exploreActivities = reportMetricActivities((item) => item.type === "探索");
        const totalExploreCount = exploredAnimals.reduce((sum, animal) => sum + animal.count, 0);
        title = "已探索动物详情";
        summary = `
            <div class="detail-list">
                <p><strong>已探索种类：</strong>${exploredAnimals.length} 种</p>
                <p><strong>累计探索次数：</strong>${totalExploreCount} 次</p>
            </div>
        `;
        body = exploredAnimals.length ? `
            <div class="panel-title">
                <h3>动物分布</h3>
                <span>${exploredAnimals.length} 项</span>
            </div>
            ${exploredAnimals.map((animal) => `
                <div class="bar-row">
                    <span>${animal.icon} ${animal.name}</span>
                    <span class="bar-track"><span class="bar-fill" style="width: ${(animal.count / maxCount) * 100}%;"></span></span>
                    <span>${animal.count}</span>
                </div>
            `).join("")}
            <div class="panel-title" style="margin-top: 12px;">
                <h3>最近探索记录</h3>
                <span>${Math.min(exploreActivities.length, 20)} 条</span>
            </div>
            ${renderReportMetricActivityList(exploreActivities, "还没有探索记录。")}
        ` : `<div class="empty-state">还没有探索动物的记录。</div>`;
    } else if (key === "questions") {
        const questionActivities = reportMetricActivities((item) => item.type === "问答");
        title = "AI知识提问详情";
        summary = `
            <div class="detail-list">
                <p><strong>提问次数：</strong>${state.progress.questions || 0} 次</p>
                <p><strong>可查看内容：</strong>最近提问的动物和问题标题</p>
            </div>
        `;
        body = renderReportMetricActivityList(questionActivities, "还没有 AI 提问记录。");
    } else if (key === "feedings") {
        const feedingActivities = reportMetricActivities((item) => item.type === "喂养");
        title = "投喂详情";
        summary = `
            <div class="detail-list">
                <p><strong>投喂次数：</strong>${state.progress.feedings || 0} 次</p>
                <p><strong>说明：</strong>随机饥饿事件中选择合适食物后计入这里</p>
            </div>
        `;
        body = renderReportMetricActivityList(feedingActivities, "还没有投喂记录。");
    } else if (key === "treatments") {
        const treatmentActivities = reportMetricActivities((item) => item.type === "治疗");
        title = "AI医生治疗详情";
        summary = `
            <div class="detail-list">
                <p><strong>治疗次数：</strong>${state.progress.treatments || 0} 次</p>
                <p><strong>可查看内容：</strong>最近触发治疗的动物与场景</p>
            </div>
        `;
        body = renderReportMetricActivityList(treatmentActivities, "还没有 AI 医生治疗记录。");
    } else if (key === "quiz-rate") {
        const quizActivities = reportMetricActivities((item) => item.type === "测验");
        const quizTotal = state.progress.quizTotal || 0;
        const quizCorrect = state.progress.quizCorrect || 0;
        title = "小测验正确率详情";
        summary = `
            <div class="detail-list">
                <p><strong>正确率：</strong>${quizTotal ? Math.round((quizCorrect / quizTotal) * 100) : 0}%</p>
                <p><strong>答对 / 总题数：</strong>${quizCorrect} / ${quizTotal}</p>
            </div>
        `;
        body = renderReportMetricActivityList(quizActivities, "还没有小测验记录。");
    } else if (key === "activities") {
        const activityTypes = ["探索", "问答", "测验", "治疗", "故事", "创作"];
        title = "总活动数详情";
        summary = `
            <div class="detail-list">
                <p><strong>活动总数：</strong>${allActivities.length} 条</p>
                ${activityTypes.map((type) => {
                    const count = allActivities.filter((item) => item.type === type).length;
                    return count ? `<p><strong>${type}：</strong>${count} 条</p>` : "";
                }).join("")}
            </div>
        `;
        body = renderReportMetricActivityList(allActivities, "还没有学习活动记录。");
    }

    if (!title) return "";

    return `
        <div class="panel metric-detail-panel">
            <div class="panel-title">
                <h3>${title}</h3>
            </div>
            ${summary}
            ${body}
        </div>
    `;
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
    const syncTimeText = formatParentSyncStatusText(state.selectedChild || {});

    return `
        <div class="grid-3">
            ${renderReportMetricCard("explored", totals.explored, "已探索动物")}
            ${renderReportMetricCard("questions", state.progress.questions, "AI知识提问")}
            ${renderReportMetricCard("feedings", state.progress.feedings || 0, "投喂次数")}
            ${renderReportMetricCard("treatments", state.progress.treatments || 0, "AI医生治疗")}
            ${renderReportMetricCard("quiz-rate", `${Math.round(totals.quizRate)}%`, "小测验正确率")}
            ${renderReportMetricCard("activities", state.progress.activities.length, "总活动数")}
        </div>

        ${state.profile.role === "parent" ? `
        <div class="panel">
            <div class="sync-data-card">
                <div>
                    <h3>同步数据</h3>
                    <span>${syncTimeText}</span>
                </div>
                <button class="secondary-button" type="button" data-action="refresh-sync-data" ${state.syncRefreshLoading ? "disabled" : ""}>
                    ${state.syncRefreshLoading ? "同步中..." : "刷新同步数据"}
                </button>
            </div>
        </div>
        ` : ""}

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
                            <div class="period-count">${period.activityLevel || "不活跃"}</div>
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
                        <p class="activity-main"><strong>${escapeHtml(item.type)}</strong> ${escapeHtml(item.label)}</p>
                        <time class="activity-time">${formatTime(item.time)}</time>
                    </article>
                `).join("") : `<div class="empty-state">还没有学习记录。</div>`}
            </div>
        </div>
        <div class="action-row no-print">
            <button class="danger-button" type="button" data-action="reset-progress">清空记录</button>
        </div>
    `;
}

function reportSettingsTab() {
    const selectedChild = state.selectedChild || {};
    const entryCode = selectedChild.entry_code || "";
    const syncIntervalHours = typeof getChildSyncIntervalHours === "function" ? getChildSyncIntervalHours() : 6;
    const syncTimeText = formatParentSyncStatusText(selectedChild);

    return `
        <div class="panel">
            <div class="panel-title">
                <h3>⚙️ 家长设置</h3>
            </div>
            <div class="field">
                <label for="dailyLimit">每日使用时长限制</label>
                <select class="select-input" id="dailyLimit">
                    <option value="0" ${(state.dailyLimit || 0) == 0 ? "selected" : ""}>不限制</option>
                    <option value="30" ${(state.dailyLimit || 0) == 30 ? "selected" : ""}>30分钟</option>
                    <option value="60" ${(state.dailyLimit || 0) == 60 ? "selected" : ""}>1小时</option>
                    <option value="90" ${(state.dailyLimit || 0) == 90 ? "selected" : ""}>1.5小时</option>
                    <option value="120" ${(state.dailyLimit || 0) == 120 ? "selected" : ""}>2小时</option>
                </select>
                <p style="margin: 8px 2px 0; color: var(--muted); font-size: 14px;">家长可按孩子当天状态，安排合适的使用时长。</p>
            </div>

            <div class="animal-info-card">
                <div class="info-card-header">
                    <h3>进入码</h3>
                    <span>🔐</span>
                </div>
                <p style="margin: 0 0 6px; font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #243746;">${escapeHtml(entryCode || "------")}</p>
                <p style="margin: 0; color: var(--muted);">孩子端输入孩子姓名和进入码即可进入。</p>
                ${entryCode ? `
                    <div class="action-row" style="margin-top: 12px;">
                        <button class="secondary-button" type="button" data-action="copy-entry-code" data-entry-code="${escapeHtml(entryCode)}">复制进入码</button>
                        <button class="secondary-button" type="button" data-action="refresh-entry-code">修改进入码</button>
                    </div>
                ` : ""}
            </div>

            <div class="animal-info-card" style="margin-top: 10px;">
                <div class="info-card-header">
                    <h3>学习数据同步</h3>
                    <span>🔄</span>
                </div>
                <p style="margin: 0 0 6px; font-weight: 700; color: #243746;">${escapeHtml(syncTimeText)}</p>
                <p style="margin: 0; color: var(--muted);">系统会每 ${syncIntervalHours} 小时自动同步一次，家长也可以主动刷新。</p>
                <div class="action-row" style="margin-top: 12px; justify-content: flex-end;">
                    <button class="secondary-button" type="button" data-action="refresh-sync-data" ${state.syncRefreshLoading ? "disabled" : ""}>
                        ${state.syncRefreshLoading ? "同步中..." : "立即同步数据"}
                    </button>
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
