function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

async function makeStory() {
    const button = document.querySelector('[data-action="make-story"]');
    if (!button) return;

    // 防止重复请求
    if (button.disabled) return;
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = "生成中...";

    try {
        const theme = document.getElementById("storyTheme").value;
        const prompt = document.getElementById("storyPrompt").value.trim();
        const length = document.getElementById("storyLength").value;

        // 使用当前状态中的模型，如果没有则使用默认模型
        const model = state.model || models[0];

        state.storyLength = length;

        const lengthMap = {
            short: "请写一个150-200字的短故事（约2分钟）",
            medium: "请写一个300-400字的中等长度故事（约5分钟）",
            long: "请写一个500-700字的长故事（约10分钟）"
        };

        // 构建完整的故事生成提示词
        // 故事愿望可以为空，AI会根据主题和动物自动生成
        let message = `${lengthMap[length]}。主题：${theme}。`;
        if (prompt) {
            message += `孩子的故事愿望：${prompt}。请根据孩子的愿望来创作故事。`;
        } else {
            message += `请创作一个关于${getAnimal().name}的${theme.replace(/[🌙🔍🎓🏆]\s*/g, '')}故事。`;
        }
        message += `\n\n重要：请在故事开头第一行写上吸引小朋友的标题（用《》包裹，不要超过15个字），然后空一行，再写故事正文。标题要生动有趣，能吸引3-10岁儿童。`;

        const result = await askAI("story", message, "storyAnswer", "storyMeta", { model, theme });

        // 从返回的故事中提取标题和正文
        let title = `《${getAnimal().name}的故事》`;  // 默认标题
        let storyText = result.reply;

        // 尝试提取AI生成的标题
        const titleMatch = result.reply.match(/^《(.+?)》\s*\n/);
        if (titleMatch) {
            title = `《${titleMatch[1]}》`;
            storyText = result.reply.replace(/^《.+?》\s*\n+/, '');  // 移除标题部分
        }

        const tags = [];
        if (theme.includes("睡前")) tags.push("睡前");
        if (theme.includes("探险")) tags.push("探险");
        if (theme.includes("科普")) tags.push("科普");
        if (theme.includes("成长")) tags.push("成长");
        if (theme.includes("新朋友")) tags.push("友谊");
        if (theme.includes("勇敢")) tags.push("勇敢");

        state.stories.unshift({
            animalId: state.selectedAnimalId,
            title,
            text: storyText,  // 使用提取的正文，不包含标题
            source: result.source,
            time: Date.now(),
            length: length,
            tags: tags,
            isFavorite: false,
            readCount: 0
        });
        state.stories = state.stories.slice(0, 24);
        state.progress.stories += 1;
        addActivity("故事", title, state.selectedAnimalId);

        // 更新解锁统计
        updateInteractionStats(state.selectedAnimalId, "storyGenerated");

        saveState();
        render();
        showToast("故事生成成功！");
    } catch (error) {
        console.error("故事生成失败:", error);
        showToast("故事生成失败，请重试");
    } finally {
        // 恢复按钮状态
        button.disabled = false;
        button.textContent = originalText;
    }
}

async function continueStory() {
    const lastStory = state.stories[0];
    if (!lastStory) {
        showToast("请先生成一个故事");
        return;
    }

    const button = document.querySelector('[data-action="continue-story"]');
    if (!button) return;

    // 防止重复请求
    if (button.disabled) return;
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = "续写中...";

    try {
        // 使用当前状态中的模型
        const model = state.model || models[0];

        const message = `请根据以下故事续写一段（约200-300字），保持风格一致：\n\n${lastStory.text}`;
        const result = await askAI("story", message, "storyAnswer", "storyMeta", { model });

        lastStory.text += "\n\n" + result.reply;
        lastStory.time = Date.now();
        lastStory.source = result.source;

        // 重要：更新DOM元素显示完整故事，而不是只显示续写部分
        const storyAnswer = document.getElementById("storyAnswer");
        if (storyAnswer) {
            storyAnswer.innerHTML = `<div class="story-title">${escapeHtml(lastStory.title)}</div>${escapeHtml(formatStoryText(lastStory.text))}`;
        }

        addActivity("故事", `续写：${lastStory.title}`, lastStory.animalId);
        saveState();
        render();
        showToast("故事续写成功");
    } catch (error) {
        console.error("故事续写失败:", error);
        showToast("故事续写失败，请重试");
    } finally {
        // 恢复按钮状态
        button.disabled = false;
        button.textContent = originalText;
    }
}

function toggleFavorite() {
    const lastStory = state.stories[0];
    if (!lastStory) return;

    lastStory.isFavorite = !lastStory.isFavorite;
    saveState();

    // 只更新收藏按钮，不重新渲染整个页面
    const favoriteBtn = document.querySelector('[data-action="toggle-favorite"]');
    if (favoriteBtn) {
        const icon = lastStory.isFavorite ? "⭐" : "☆";
        const text = lastStory.isFavorite ? "已收藏" : "收藏";
        favoriteBtn.innerHTML = `<span style="margin-right: 4px;">${icon}</span>${text}`;
    }

    showToast(lastStory.isFavorite ? "已收藏" : "已取消收藏");
}

let currentUtterance = null;
let isPaused = false;
let lastClickTime = 0;

function cleanTextForReading(text) {
    // 清理Markdown、特殊符号和emoji，使朗读更自然
    return text
        .replace(/#{1,6}\s/g, '')           // 移除 # 标题符号
        .replace(/\*\*(.+?)\*\*/g, '$1')    // 移除 **粗体**
        .replace(/\*(.+?)\*/g, '$1')        // 移除 *斜体*
        .replace(/_(.+?)_/g, '$1')          // 移除 _下划线_
        .replace(/`(.+?)`/g, '$1')          // 移除 `代码`
        .replace(/\[(.+?)\]\(.+?\)/g, '$1') // 移除链接，保留文字
        .replace(/[【】《》「」『』]/g, '') // 移除中文特殊括号
        .replace(/[[\](){}]/g, '')          // 移除英文括号
        .replace(/[~!@$%^&*+=|\\<>?]/g, '') // 移除特殊符号
        // emoji处理：替换为空格（产生自然的短暂停顿，而非逗号的生硬感）
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, ' ')
        .replace(/[\u{2600}-\u{26FF}]/gu, ' ')
        .replace(/[\u{2700}-\u{27BF}]/gu, ' ')
        .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
        .replace(/[\u{1F600}-\u{1F64F}]/gu, ' ')
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, ' ')
        .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, ' ')
        .replace(/\s{2,}/g, ' ')            // 多个空格合并为一个（更自然的停顿）
        .trim();
}

function readStory() {
    const rawText = document.getElementById("storyAnswer")?.textContent.trim();
    if (!rawText || rawText === "故事会显示在这里。") {
        showToast("请先生成故事");
        return;
    }
    if (!window.speechSynthesis) {
        showToast("当前浏览器不支持朗读");
        return;
    }

    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime;
    lastClickTime = now;

    // 如果正在暂停状态
    if (isPaused) {
        // 快速双击（500ms内）则停止
        if (timeSinceLastClick < 500) {
            stopReading();
            showToast("已停止朗读");
            return;
        }
        // 单击则继续 - 立即更新按钮
        updateReadButton("暂停");
        isPaused = false;
        window.speechSynthesis.resume();
        return;
    }

    // 如果正在朗读，则暂停
    if (window.speechSynthesis.speaking && !isPaused) {
        // 立即更新按钮提供即时反馈
        updateReadButton("继续");
        isPaused = true;
        window.speechSynthesis.pause();
        return;
    }

    // 新建朗读 - 立即更新按钮提供即时反馈
    updateReadButton("暂停");

    // 使用清理后的文本
    const cleanText = cleanTextForReading(rawText);
    window.speechSynthesis.cancel();

    currentUtterance = new SpeechSynthesisUtterance(cleanText);
    currentUtterance.lang = "zh-CN";
    currentUtterance.rate = 0.85;
    currentUtterance.pitch = 1.05;
    currentUtterance.volume = 0.95;

    // 优先选择更自然的中文女声
    const voices = window.speechSynthesis.getVoices();
    const preferredVoices = [
        'Microsoft Yunxi Online (Natural) - Chinese (Mainland)',
        'Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)',
        'Microsoft Yaoyao - Chinese (Mainland)',
        'Xiaoxiao',
        'Yaoyao',
        'Tingting'
    ];

    let selectedVoice = null;
    for (const preferred of preferredVoices) {
        selectedVoice = voices.find(v => v.name.includes(preferred));
        if (selectedVoice) break;
    }

    if (!selectedVoice) {
        selectedVoice = voices.find(v =>
            v.lang.includes('zh') &&
            (v.name.includes('Female') || v.name.includes('female'))
        );
    }

    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.includes('zh'));
    }

    if (selectedVoice) {
        currentUtterance.voice = selectedVoice;
    }

    currentUtterance.onstart = () => {
        // 确保按钮状态正确
        updateReadButton("暂停");
    };

    currentUtterance.onend = () => {
        updateReadButton("朗读");
        isPaused = false;
        incrementReadCount();
    };

    currentUtterance.onerror = () => {
        updateReadButton("朗读");
        isPaused = false;
    };

    // 立即开始朗读
    window.speechSynthesis.speak(currentUtterance);
}

function stopReading() {
    window.speechSynthesis.cancel();
    isPaused = false;
    currentUtterance = null;
    updateReadButton("朗读");
}

function updateReadButton(text) {
    const btn = document.getElementById("readStoryBtn");
    if (btn) {
        // 根据状态显示不同的图标
        let icon = "🔊";
        if (text === "暂停") icon = "⏸️";
        if (text === "继续") icon = "▶️";
        btn.innerHTML = `<span style="margin-right: 4px;">${icon}</span>${text}`;
    }
}

function incrementReadCount() {
    const lastStory = state.stories[0];
    if (lastStory) {
        lastStory.readCount = (lastStory.readCount || 0) + 1;

        // 更新解锁统计 - 完整阅读故事
        if (lastStory.animalId) {
            updateInteractionStats(lastStory.animalId, "storyCompleted");
        }

        saveState();
    }
}

let recognition = null;
let isRecording = false;
let finalTranscript = '';
let interimTranscript = '';
let recognitionTimeout = null;
let restartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 3;
let useSimpleMode = false;  // 简化模式标志
