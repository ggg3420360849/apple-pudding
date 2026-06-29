async function askAI(mode, message, outputId, metaId, extra = {}) {
    const output = document.getElementById(outputId);
    const meta = document.getElementById(metaId);
    const animal = getAnimal();
    const model = extra.model || state.model;

    // 如果元素存在，显示加载状态
    if (output) {
        output.className = "answer-panel loading";
        output.textContent = "AI正在思考...";
    }
    if (meta) {
        meta.textContent = "";
    }

    try {
        const data = await BlueAnimal.chat.ask({
            mode,
            message,
            animal: animal.name,
            model
        });
        // 更新界面（如果元素存在）
        if (output) {
            output.className = "answer-panel";
            output.textContent = data.reply;
        }
        if (meta) {
            meta.textContent = `动物：${animal.name}｜模型：${data.model}`;
        }

        return { reply: data.reply, source: `模型：${data.model}` };
    } catch (error) {
        const reply = fallbackReply(mode, animal, message, extra);

        // 更新界面（如果元素存在）
        if (output) {
            output.className = "answer-panel";
            output.textContent = reply;
        }
        if (meta) {
            meta.textContent = `动物：${animal.name}｜离线回答：${error.message}`;
        }

        return { reply, source: "离线回答" };
    }
}

function fallbackReply(mode, animal, message, extra) {
    if (mode === "doctor") {
        return `${animal.name}的情况可以先观察精神、食欲、饮水和排便。\n1. 保持安静和干净环境。\n2. 记录症状出现的时间。\n3. 如果持续不吃、呼吸困难、流血或明显疼痛，请马上联系兽医。`;
    }
    if (mode === "story") {
        const theme = extra.theme || "小小探险";
        const themeText = theme.replace(/[🌙🔍🎓🏆]\s*/g, '');

        // 根据主题生成不同风格的离线故事
        if (theme.includes("睡前")) {
            return `《${animal.name}的温馨夜晚》\n\n夜晚来临，月光洒在${animal.habitat}上。${animal.name}结束了一天的探险，慢慢走回自己的小窝。\n\n它想起今天学到的本领：${animal.fact}\n\n${animal.name}闭上眼睛，听着周围轻柔的声音。它知道，明天又是充满惊喜的一天。晚安，${animal.name}。`;
        } else if (theme.includes("探险")) {
            return `《${animal.name}的大冒险》\n\n今天，${animal.name}在${animal.habitat}里发现了一条从未见过的小路。它好奇地走了过去。\n\n路上，${animal.name}遇到了小伙伴，它们一起寻找食物。${animal.name}记得：${animal.fact}\n\n最后，它们找到了美味的${animal.diet.split('、')[0]}，开心地分享着。这真是难忘的一天！`;
        } else if (theme.includes("科普")) {
            return `《认识${animal.name}》\n\n${animal.name}生活在${animal.habitat}，是一种很特别的动物。\n\n有趣的是，${animal.fact}这个特点帮助它在大自然中生存。\n\n${animal.name}喜欢吃${animal.diet}通过了解它的习性，我们能更好地保护它和它的家园。`;
        } else if (theme.includes("成长")) {
            return `《${animal.name}的成长》\n\n小${animal.name}慢慢长大了，它学会了很多本领。\n\n最重要的是：${animal.fact}这让它能够独立生活。\n\n现在，${animal.name}可以自己找到${animal.diet}它变得越来越勇敢和自信了！`;
        } else {
            return `《${animal.name}的${themeText}》\n\n在${animal.habitat}里，${animal.name}开始了新的一天。\n\n它记得自己的特点：${animal.fact}\n\n今天，${animal.name}遇到了一个小挑战，但它用智慧解决了问题。它告诉自己：每一天都是学习和成长的机会。`;
        }
    }
    return `${animal.name}生活在${animal.habitat}。${animal.fact}它常吃${animal.diet}如果你继续观察它的身体特点，就能发现动物和环境之间有很多有趣关系。`;
}
