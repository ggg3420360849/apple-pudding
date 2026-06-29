async function handleQuiz(choice) {
    const animal = getAnimal();
    const correct = choice === animal.quiz.answer;

    // 保存当前滚动位置
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    state.progress.quizTotal += 1;
    state.lastQuiz = {
        animalId: animal.id,
        choice,
        correct,
        food: animal.diet.replace(/[。.]$/, ""),
        time: Date.now()
    };

    if (correct) {
        state.progress.quizCorrect += 1;
        feedAnimal(animal);
        addActivity("测验", `${getAnimalDisplayName(animal.id)}：答对并喂养`, animal.id);

        // 更新解锁统计
        updateInteractionStats(animal.id, "quizPassed");
    } else {
        addActivity("测验", `${getAnimalDisplayName(animal.id)}：答错，查看正确示范`, animal.id);
    }

    document.querySelectorAll("[data-quiz-choice]").forEach((button) => {
        const index = Number(button.dataset.quizChoice);
        button.classList.toggle("correct", index === animal.quiz.answer);
        button.classList.toggle("wrong", index === choice && !correct);
        button.disabled = true;
    });
    const result = document.getElementById("quizResult");
    result.textContent = correct
        ? `答对了，已经给${getAnimalDisplayName(animal.id)}喂养：${state.lastQuiz.food}`
        : `答错了，正确答案是：${animal.quiz.options[animal.quiz.answer]}。正在展示正确示范...`;

    saveState();
    if (correct) {
        // Update only the necessary parts without full re-render to keep scroll position
        showToast(`已喂养${getAnimalDisplayName(animal.id)}`);
        // Update stats without re-rendering the entire page
        updateCareStats(animal);
        return;
    }

    // 答错后：1. 展示正确示范动画 2. 进入医生问答
    await showCorrectDemonstration(animal, choice);
}

function updateCareStats(animal) {
    // Update feeding count and level display without full re-render
    const animalFeedings = state.feedingLogs.filter((item) => item.animalId === animal.id).length;
    const animalLevel = Math.floor(animalFeedings / 3) + 1;

    // Update level badge
    const levelBadge = document.querySelector('.level-badge');
    if (levelBadge) {
        levelBadge.textContent = `Lv.${animalLevel}`;
    }

    // Update progress bar
    const progressFill = document.querySelector('.level-progress-fill');
    if (progressFill) {
        progressFill.style.width = `${(animalFeedings % 3) * 33.33}%`;
    }

    // Update feeding stat
    const feedingStat = document.querySelectorAll('.stat-item')[0]?.querySelector('.stat-number');
    if (feedingStat) {
        feedingStat.textContent = animalFeedings;
    }
}

function feedAnimal(animal) {
    state.progress.feedings = (state.progress.feedings || 0) + 1;
    state.feedingLogs.unshift({
        animalId: animal.id,
        food: animal.diet.replace(/[。.]$/, ""),
        reason: "小测验答对",
        time: Date.now()
    });
    state.feedingLogs = state.feedingLogs.slice(0, 24);
}

async function showCorrectDemonstration(animal, wrongChoice) {
    // Show demonstration animation
    state.qaStage = 'demonstration';
    saveState();
    render();

    // Wait for demonstration animation (2.5 seconds)
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Then show doctor consultation
    state.qaStage = 'doctor';
    saveState();
    render();
}

async function treatAnimalAfterWrongAnswer(animal, choice) {
    try {
        const message = `孩子在小测验中答错了。题目：${animal.quiz.question}。孩子选择：${animal.quiz.options[choice]}。正确答案：${animal.quiz.options[animal.quiz.answer]}。请用AI动物医生的口吻，安慰${animal.name}，给出温和治疗和复习建议。`;
        const result = await askAI("doctor", message, "doctorAnswer", "doctorMeta", { model: state.model });
        state.progress.doctorChecks += 1;
        state.progress.treatments = (state.progress.treatments || 0) + 1;
        state.doctorLogs.unshift({
            animalId: animal.id,
            symptom: "答题错误",
            detail: message,
            reply: result.reply,
            source: result.source,
            time: Date.now()
        });
        state.doctorLogs = state.doctorLogs.slice(0, 10);
        addActivity("治疗", `${animal.name}：AI医生复习照护`, animal.id);
        saveState();
        render();
        showToast(`AI医生已治疗${animal.name}`);
    } catch (error) {
        console.error("AI医生治疗失败:", error);
        showToast("治疗失败，但没关系，继续加油！");
    }
}

async function handleAskQa() {
    const question = document.getElementById("qaQuestion").value.trim();
    const modelSelect = document.getElementById("qaModel");
    const model = modelSelect ? modelSelect.value : state.model;

    if (!question) {
        showToast("请先输入问题");
        return;
    }

    try {
        state.model = model;
        const result = await askAI("qa", question, "qaAnswer", "qaMeta", { model });
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
        console.error("AI问答失败:", error);
        showToast("问答失败，请重试");
    }
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

// 生成新的快速问题
async function generateQuickQuestion(animal) {
    const existingQuestions = animal.quick ? animal.quick.join('、') : '';
    const prompt = `你是一个专业的儿童动物科普教育专家。请为${animal.name}生成一个适合5-8岁儿童的有趣问题。

要求：
1. 问题要简短，15字以内
2. 问题要有趣，能激发好奇心
3. 问题要有教育意义
4. 避免重复：${existingQuestions}
5. 只输出问题本身，不要额外解释

示例：${animal.name}为什么...？${animal.name}怎么...？${animal.name}的...有什么用？

请直接输出一个问题：`;

    try {
        const data = await BlueAnimal.chat.ask({
            mode: 'qa',
            message: prompt,
            animal: animal.name,
            model: state.model
        });

        let question = data.reply.trim();

        // 清理可能的额外内容
        question = question.replace(/^["「『]|["」』]$/g, '');
        question = question.split('\n')[0]; // 只取第一行
        question = question.replace(/^问题[:：]\s*/, ''); // 移除"问题："前缀

        // 确保问题以问号结尾
        if (!question.endsWith('？') && !question.endsWith('?')) {
            question += '？';
        }

        // 限制长度
        if (question.length > 20) {
            question = question.substring(0, 18) + '...？';
        }

        return question;
    } catch (error) {
        console.error('生成问题失败:', error);
        // 返回默认问题
        const defaultQuestions = animal.quick || [];
        const randomIndex = Math.floor(Math.random() * defaultQuestions.length);
        return defaultQuestions[randomIndex] || `${animal.name}有什么特别的地方？`;
    }
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
            question: animal.quick?.[0] || `${animal.name}有什么特别的地方？`,
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
