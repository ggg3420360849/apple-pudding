/**
 * 增强版家长端报告系统
 *
 * 功能特性:
 * - 分页式布局，避免单页滚动过长
 * - 时间趋势图可视化
 * - 成就徽章系统
 * - 学习画像个性化分析
 */

// ============= 数据分析函数 =============

/**
 * 获取近7天学习趋势数据
 */
function getLast7DaysActivity(activities) {
    const days = [];
    const now = Date.now();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000);
        const dateKey = `${date.getMonth() + 1}/${date.getDate()}`;

        const dayActivities = activities.filter(activity => {
            const activityDate = new Date(activity.time);
            return activityDate.toDateString() === date.toDateString();
        });

        days.push({
            date: dateKey,
            count: dayActivities.length,
            types: {
                explore: dayActivities.filter(a => a.type === "探索").length,
                quiz: dayActivities.filter(a => a.type === "测验").length,
                story: dayActivities.filter(a => a.type === "故事").length,
                create: dayActivities.filter(a => a.type === "创作").length
            }
        });
    }

    return days;
}

/**
 * 获取学习时段分布
 */
function getTimeDistribution(activities) {
    const periods = {
        morning: { label: "上午(6-12)", count: 0, icon: "🌅" },
        afternoon: { label: "下午(12-18)", count: 0, icon: "☀️" },
        evening: { label: "晚上(18-22)", count: 0, icon: "🌙" },
        night: { label: "深夜(22-6)", count: 0, icon: "🌃" }
    };

    activities.forEach(activity => {
        const hour = new Date(activity.time).getHours();
        if (hour >= 6 && hour < 12) periods.morning.count++;
        else if (hour >= 12 && hour < 18) periods.afternoon.count++;
        else if (hour >= 18 && hour < 22) periods.evening.count++;
        else periods.night.count++;
    });

    return Object.values(periods);
}

/**
 * 获取成就徽章列表
 */
function getAchievements(progress, visits, stories, creations) {
    const achievements = [
        {
            id: "explorer_beginner",
            name: "初级探险家",
            icon: "🔰",
            condition: () => Object.keys(visits).length >= 3,
            desc: "探索3种动物"
        },
        {
            id: "explorer_master",
            name: "探险大师",
            icon: "🏆",
            condition: () => Object.keys(visits).length >= 8,
            desc: "探索全部动物"
        },
        {
            id: "quiz_ace",
            name: "知识达人",
            icon: "🎓",
            condition: () => progress.quizCorrect >= 10,
            desc: "答对10道题"
        },
        {
            id: "story_writer",
            name: "故事作家",
            icon: "📚",
            condition: () => stories >= 5,
            desc: "创作5个故事"
        },
        {
            id: "creator",
            name: "创意大师",
            icon: "🎨",
            condition: () => creations >= 3,
            desc: "设计3个想象动物"
        },
        {
            id: "caring_heart",
            name: "爱心照护员",
            icon: "❤️",
            condition: () => (progress.feedings || 0) >= 15,
            desc: "喂养动物15次"
        },
        {
            id: "persistent",
            name: "坚持学习",
            icon: "⭐",
            condition: () => getDaysActive(progress.activities) >= 7,
            desc: "学习7天"
        }
    ];

    return achievements.map(ach => ({
        ...ach,
        unlocked: ach.condition()
    }));
}

/**
 * 计算活跃天数
 */
function getDaysActive(activities) {
    const days = new Set();
    activities.forEach(activity => {
        const date = new Date(activity.time).toDateString();
        days.add(date);
    });
    return days.size;
}

/**
 * 获取个性化学习画像
 */
function getPersonalizedInsights(progress, visits, stories, creations) {
    return {
        explorationType: getExplorationType(visits),
        learningStyle: getLearningStyle(progress, stories, creations),
        preferredTime: getPreferredTime(progress.activities),
        strengthArea: getStrengthArea(progress, stories, creations),
        improvementArea: getImprovementArea(progress, visits, stories)
    };
}

function getExplorationType(visits) {
    const visitList = Object.entries(visits)
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count);

    const maxVisit = visitList[0]?.count || 0;
    const avgVisit = visitList.reduce((sum, v) => sum + v.count, 0) / visitList.length || 0;

    if (maxVisit > avgVisit * 2) {
        return {
            type: "专注型",
            desc: "喜欢深入了解某一种动物，建议鼓励孩子尝试比较不同动物。",
            icon: "🎯"
        };
    } else if (visitList.length >= 6) {
        return {
            type: "探索型",
            desc: "喜欢广泛探索，建议引导孩子对喜欢的动物进行深度学习。",
            icon: "🔍"
        };
    } else {
        return {
            type: "初步探索",
            desc: "刚开始了解动物世界，建议保持兴趣，慢慢扩展。",
            icon: "🌱"
        };
    }
}

function getLearningStyle(progress, stories, creations) {
    const quizRate = progress.quizTotal
        ? progress.quizCorrect / progress.quizTotal
        : 0;
    const activityCount = progress.activities.length || 1;
    const storyRate = stories / activityCount;
    const questionRate = progress.questions / activityCount;

    if (quizRate > 0.8) {
        return { style: "逻辑记忆型", desc: "擅长通过问答巩固知识", icon: "🧠" };
    } else if (storyRate > 0.3) {
        return { style: "叙事想象型", desc: "通过故事理解世界", icon: "📖" };
    } else if (questionRate > 0.4) {
        return { style: "好奇探究型", desc: "喜欢主动提问", icon: "❓" };
    } else {
        return { style: "多元混合型", desc: "适合多种学习方式", icon: "🎨" };
    }
}

function getPreferredTime(activities) {
    const distribution = getTimeDistribution(activities);
    return distribution.reduce((max, p) =>
        p.count > max.count ? p : max, distribution[0]);
}

function getStrengthArea(progress, stories, creations) {
    const strengths = [];

    if (progress.quizTotal > 0 && progress.quizCorrect / progress.quizTotal > 0.7) {
        strengths.push("知识记忆力强");
    }
    if (stories >= 3) {
        strengths.push("创造力丰富");
    }
    if (progress.questions >= 5) {
        strengths.push("好奇心强");
    }
    if (creations >= 2) {
        strengths.push("想象力出色");
    }

    return strengths.length ? strengths.join("、") : "正在培养各项能力";
}

function getImprovementArea(progress, visits, stories) {
    const areas = [];

    if (Object.keys(visits).length < 4) {
        areas.push("拓展动物种类认知");
    }
    if (progress.quizTotal < 5) {
        areas.push("增加知识巩固练习");
    }
    if (stories < 2) {
        areas.push("尝试创作动物故事");
    }

    return areas.length ? areas : ["继续保持当前学习节奏"];
}

// ============= 导出函数 =============

if (typeof window !== 'undefined') {
    window.ParentReportEnhanced = {
        getLast7DaysActivity,
        getTimeDistribution,
        getAchievements,
        getDaysActive,
        getPersonalizedInsights
    };
}
