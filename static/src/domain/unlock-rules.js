// ========== 解锁系统核心函数 ==========

/**
 * 检查动物是否解锁
 */
function isAnimalUnlocked(animalId) {
    return state.animalUnlocks[animalId]?.unlocked || false;
}

/**
 * 获取已解锁的动物列表
 */
function getUnlockedAnimals() {
    return animals.filter(a => isAnimalUnlocked(a.id));
}

/**
 * 获取未解锁的动物列表
 */
function getLockedAnimals() {
    return animals.filter(a => !isAnimalUnlocked(a.id));
}

/**
 * 检查解锁条件是否满足
 */
function checkUnlockConditions(animal) {
    const { type, conditions } = animal.unlockRequirements;

    if (type === "initial") {
        return true;
    }

    return conditions.every(condition => {
        switch (condition.stat) {
            case "animalInteraction":
                const targetAnimal = state.animalUnlocks[condition.target];
                return targetAnimal && targetAnimal.interactionCount >= condition.count;

            case "totalQuestions":
                return state.progress.totalQuestions >= condition.count;

            case "quickQA":
                const qaAnimal = state.animalUnlocks[condition.target];
                return qaAnimal && qaAnimal.quickQACount >= condition.count;

            case "totalChats":
                return state.progress.totalChats >= condition.count;

            case "uniqueAnimals":
                return state.progress.uniqueAnimalsInteracted.length >= condition.count;

            case "storiesCompleted":
                return state.progress.storiesCompleted >= condition.count;

            case "quizPassed":
                return state.progress.totalQuizPassed >= condition.count;

            case "unlockedAnimals":
                return getUnlockedAnimals().length >= condition.count;

            case "totalStories":
                return state.progress.totalStories >= condition.count;

            case "allQuizPassed":
                const unlockedCount = getUnlockedAnimals().length;
                const passedCount = Object.values(state.animalUnlocks)
                    .filter(a => a.unlocked && a.quizPassed).length;
                return condition.value && passedCount >= unlockedCount - 1;

            default:
                return false;
        }
    });
}

/**
 * 计算解锁进度
 */
function calculateUnlockProgress(animal) {
    const { type, conditions } = animal.unlockRequirements;

    if (type === "initial") {
        return { current: 1, required: 1, percentage: 100 };
    }

    if (conditions.length === 0) {
        return { current: 0, required: 1, percentage: 0 };
    }

    // 对于多条件，计算平均进度
    const progresses = conditions.map(condition => {
        let current = 0;
        let required = 0;

        switch (condition.stat) {
            case "animalInteraction":
                const targetAnimal = state.animalUnlocks[condition.target];
                current = targetAnimal?.interactionCount || 0;
                required = condition.count;
                break;

            case "totalQuestions":
                current = state.progress.totalQuestions;
                required = condition.count;
                break;

            case "quickQA":
                const qaAnimal = state.animalUnlocks[condition.target];
                current = qaAnimal?.quickQACount || 0;
                required = condition.count;
                break;

            case "totalChats":
                current = state.progress.totalChats;
                required = condition.count;
                break;

            case "uniqueAnimals":
                current = state.progress.uniqueAnimalsInteracted.length;
                required = condition.count;
                break;

            case "storiesCompleted":
                current = state.progress.storiesCompleted;
                required = condition.count;
                break;

            case "quizPassed":
                current = state.progress.totalQuizPassed;
                required = condition.count;
                break;

            case "unlockedAnimals":
                current = getUnlockedAnimals().length;
                required = condition.count;
                break;

            case "totalStories":
                current = state.progress.totalStories;
                required = condition.count;
                break;

            case "allQuizPassed":
                const unlockedCount = getUnlockedAnimals().length;
                const passedCount = Object.values(state.animalUnlocks)
                    .filter(a => a.unlocked && a.quizPassed).length;
                current = passedCount;
                required = Math.max(1, unlockedCount - 1);
                break;
        }

        return {
            current: Math.min(current, required),
            required: required,
            percentage: required > 0 ? Math.floor((Math.min(current, required) / required) * 100) : 0
        };
    });

    // 返回平均进度
    const avgPercentage = Math.floor(
        progresses.reduce((sum, p) => sum + p.percentage, 0) / progresses.length
    );

    return {
        current: progresses[0].current,
        required: progresses[0].required,
        percentage: avgPercentage,
        details: progresses
    };
}

function getUnlockInstruction(animal) {
    const requirements = animal.unlockRequirements?.conditions || [];
    const descriptions = requirements.map((condition) => {
        const targetName = animals.find((item) => item.id === condition.target)?.name || "指定动物";
        switch (condition.stat) {
            case "animalInteraction":
                return `与${targetName}完成 ${condition.count} 次对话`;
            case "totalQuestions":
                return `累计提出 ${condition.count} 个问题`;
            case "quickQA":
                return `完成${targetName}的 ${condition.count} 次快问快答`;
            case "totalChats":
                return `累计完成 ${condition.count} 次动物对话`;
            case "uniqueAnimals":
                return `与 ${condition.count} 种不同动物互动`;
            case "storiesCompleted":
                return `完整阅读 ${condition.count} 个故事`;
            case "quizPassed":
                return `通过 ${condition.count} 次动物测验`;
            case "unlockedAnimals":
                return `解锁 ${condition.count} 种动物`;
            case "totalStories":
                return `生成 ${condition.count} 个故事`;
            case "allQuizPassed":
                return "通过所有已解锁动物的测验";
            default:
                return "";
        }
    }).filter(Boolean);

    return descriptions.length ? `需要：${descriptions.join("，并且")}` : "继续完成动物探索任务即可解锁";
}

/**
 * 检查并触发解锁
 */
function checkAndUnlockAnimals() {
    const newUnlocks = [];
    const grasslandAnimals = animals.filter((animal) => ["rabbit", "elephant"].includes(animal.id));
    const grasslandLocked = grasslandAnimals.some((animal) => !isAnimalUnlocked(animal.id));
    const grasslandReady = grasslandAnimals.every((animal) => checkUnlockConditions(animal));

    if (grasslandLocked && grasslandReady) {
        const unlockedAt = new Date().toISOString();
        grasslandAnimals.forEach((animal) => {
            if (isAnimalUnlocked(animal.id)) return;
            state.animalUnlocks[animal.id] = {
                unlocked: true,
                unlockedAt,
                interactionCount: 0,
                quizPassed: false,
                quickQACount: 0
            };
            newUnlocks.push(animal);
        });
    }

    animals.forEach(animal => {
        if (["rabbit", "elephant"].includes(animal.id)) return;
        if (!isAnimalUnlocked(animal.id) && checkUnlockConditions(animal)) {
            // 解锁动物
            state.animalUnlocks[animal.id] = {
                unlocked: true,
                unlockedAt: new Date().toISOString(),
                interactionCount: 0,
                quizPassed: false,
                quickQACount: 0
            };
            newUnlocks.push(animal);
        }
    });

    if (newUnlocks.length > 0) {
        saveState();
        // 触发解锁动画
        const grasslandUnlocks = newUnlocks.filter((animal) => ["rabbit", "elephant"].includes(animal.id));
        newUnlocks
            .filter((animal) => !["rabbit", "elephant"].includes(animal.id))
            .forEach((animal) => triggerUnlockAnimation(animal));
        if (grasslandUnlocks.length) {
            triggerUnlockAnimation(grasslandUnlocks);
        }
    }

    return newUnlocks;
}

/**
 * 触发解锁动画和提示
 */
function triggerUnlockAnimation(animalOrAnimals) {
    const unlockedAnimals = Array.isArray(animalOrAnimals) ? animalOrAnimals : [animalOrAnimals];
    const icons = unlockedAnimals.map((animal) => animal.icon).join(" ");
    const names = unlockedAnimals.map((animal) => animal.name).join("和");
    const habitat = unlockedAnimals.length > 1 ? "阳光草原" : unlockedAnimals[0].habitat;

    // 创建解锁提示
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 32px 48px;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(102, 126, 234, 0.4);
        z-index: 10000;
        text-align: center;
        animation: unlockPop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;

    notification.innerHTML = `
        <div style="font-size: 64px; margin-bottom: 16px;">${icons}</div>
        <div style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">${unlockedAnimals.length > 1 ? "草原伙伴一起出现啦！" : "解锁新动物！"}</div>
        <div style="font-size: 18px; opacity: 0.95;">${names}</div>
        <div style="font-size: 14px; opacity: 0.8; margin-top: 12px;">${habitat}</div>
    `;

    document.body.appendChild(notification);

    // 添加动画样式
    if (!document.getElementById('unlock-animation-style')) {
        const style = document.createElement('style');
        style.id = 'unlock-animation-style';
        style.textContent = `
            @keyframes unlockPop {
                0% {
                    transform: translate(-50%, -50%) scale(0.5);
                    opacity: 0;
                }
                50% {
                    transform: translate(-50%, -50%) scale(1.1);
                }
                100% {
                    transform: translate(-50%, -50%) scale(1);
                    opacity: 1;
                }
            }
            @keyframes unlockFadeOut {
                to {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.9);
                }
            }
        `;
        document.head.appendChild(style);
    }

    // 3秒后淡出消失
    setTimeout(() => {
        notification.style.animation = 'unlockFadeOut 0.3s ease-out forwards';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);

    // 显示Toast提示
    showToast(`🎉 解锁了新动物：${names}！`);
}

/**
 * 更新互动统计
 */
function updateInteractionStats(animalId, type) {
    // 初始化动物解锁记录
    if (!state.animalUnlocks[animalId]) {
        state.animalUnlocks[animalId] = {
            unlocked: false,
            interactionCount: 0,
            quizPassed: false,
            quickQACount: 0
        };
    }

    // 更新统计
    switch (type) {
        case "chat":
            state.progress.totalChats++;
            state.animalUnlocks[animalId].interactionCount++;
            if (!state.progress.uniqueAnimalsInteracted.includes(animalId)) {
                state.progress.uniqueAnimalsInteracted.push(animalId);
            }
            break;

        case "question":
            state.progress.totalQuestions++;
            break;

        case "quickQA":
            state.animalUnlocks[animalId].quickQACount++;
            break;

        case "quizPassed":
            state.progress.totalQuizPassed++;
            state.animalUnlocks[animalId].quizPassed = true;
            break;

        case "storyGenerated":
            state.progress.totalStories++;
            break;

        case "storyCompleted":
            state.progress.storiesCompleted++;
            break;
    }

    saveState();
    checkAndUnlockAnimals();
}
