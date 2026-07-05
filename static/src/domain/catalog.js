const STORE_KEY = "applePuddingAnimalSessionsV3";
const LEGACY_STORE_KEY = "applePuddingAnimalStateV2";
const ACTIVE_SESSION_KEY = "applePuddingActiveSessionId";

const models = [
    "Doubao-Seed-2.0-pro",
    "Doubao-Seed-2.0-mini",
    "Doubao-Seed-2.0-lite",
    "Volc-DeepSeek-V3.2",
    "qwen3.5-plus"
];

const routes = [
    { id: "map", label: "地图", icon: "🗺️", title: "动物地图", subtitle: "", roles: ["child"] },
    { id: "qa", label: "动物学堂", icon: "❓", title: "动物学堂", subtitle: "", roles: ["child"] },
    { id: "imagine", label: "想象", icon: "🎨", title: "想象动物区", subtitle: "组合栖息地、能力和性格，创建自己的动物。", roles: ["child"] },
    { id: "story", label: "故事", icon: "📖", title: "故事页", subtitle: "", roles: ["child"] },
    { id: "report-overview", label: "数据", icon: "📊", title: "数据概览", subtitle: "", roles: ["parent"] },
    { id: "report-analysis", label: "分析", icon: "🎯", title: "学习分析", subtitle: "", roles: ["parent"] },
    { id: "report-activity", label: "记录", icon: "📝", title: "活动记录", subtitle: "", roles: ["parent"] },
    { id: "report-settings", label: "设置", icon: "⚙️", title: "家长设置", subtitle: "", roles: ["parent"] }
];

const imagineAssetBase = "/static/assets/imagine/";
const creatureHeads = [
    { id: "dog", label: "小狗头", file: "builder/heads/dog.png" },
    { id: "duck", label: "鸭鸭头", file: "builder/heads/duck.png" },
    { id: "frog", label: "青蛙头", file: "builder/heads/frog.png" },
    { id: "panda", label: "熊猫头", file: "builder/heads/panda.png" },
    { id: "pig", label: "小猪头", file: "builder/heads/pig.png" },
    { id: "rabbit", label: "兔兔头", file: "builder/heads/rabbit.png" },
    { id: "cat", label: "猫咪头", file: "builder/heads/cat.png" },
    { id: "chick", label: "小鸡头", file: "builder/heads/chick.png" }
];
const creatureBodies = [
    { id: "dog", label: "小狗身体", file: "builder/bodies/dog.png" },
    { id: "duck", label: "鸭鸭身体", file: "builder/bodies/duck.png" },
    { id: "frog", label: "青蛙身体", file: "builder/bodies/frog.png" },
    { id: "panda", label: "熊猫身体", file: "builder/bodies/panda.png" },
    { id: "pig", label: "小猪身体", file: "builder/bodies/pig.png" },
    { id: "rabbit", label: "兔兔身体", file: "builder/bodies/rabbit.png" },
    { id: "cat", label: "猫咪身体", file: "builder/bodies/cat.png" },
    { id: "chick", label: "小鸡身体", file: "builder/bodies/chick.png" }
];
const creatureHands = [
    { id: "dog", label: "小狗手", file: "builder/hands/dog.png" },
    { id: "duck", label: "鸭鸭手", file: "builder/hands/duck.png" },
    { id: "frog", label: "青蛙手", file: "builder/hands/frog.png" },
    { id: "panda", label: "熊猫手", file: "builder/hands/panda.png" },
    { id: "pig", label: "小猪手", file: "builder/hands/pig.png" },
    { id: "rabbit", label: "兔兔手", file: "builder/hands/rabbit.png" },
    { id: "cat", label: "猫咪手", file: "builder/hands/cat.png" },
    { id: "chick", label: "小鸡手", file: "builder/hands/chick.png" }
];
const creatureFeet = [
    { id: "dog", label: "小狗脚", file: "builder/feet/dog.png" },
    { id: "duck", label: "鸭鸭脚", file: "builder/feet/duck.png" },
    { id: "frog", label: "青蛙脚", file: "builder/feet/frog.png" },
    { id: "panda", label: "熊猫脚", file: "builder/feet/panda.png" },
    { id: "pig", label: "小猪脚", file: "builder/feet/pig.png" },
    { id: "rabbit", label: "兔兔脚", file: "builder/feet/rabbit.png" },
    { id: "cat", label: "猫咪脚", file: "builder/feet/cat.png" },
    { id: "chick", label: "小鸡脚", file: "builder/feet/chick.png" }
];
const creatureWings = [
    { id: "golden", label: "金黄翅膀", file: "builder/wings/golden.png" }
];
const creatureTails = [
    { id: "panda", label: "熊猫尾巴", file: "builder/tail/transparent/panda.png" },
    { id: "duck", label: "鸭鸭尾巴", file: "builder/tail/transparent/duck.png" },
    { id: "curly", label: "卷卷尾巴", file: "builder/tail/transparent/curly.png" },
    { id: "rabbit", label: "兔兔尾巴", file: "builder/tail/transparent/rabbit.png" },
    { id: "striped", label: "条纹尾巴", file: "builder/tail/transparent/striped.png" },
    { id: "fluffy", label: "蓬蓬尾巴", file: "builder/tail/transparent/fluffy.png" }
];
const creatureDecorations = [
    { id: "blue-collar", label: "蓝色项圈", file: "builder/decorate/transparent/blue-collar.png" },
    { id: "golden-bell", label: "金色铃铛", file: "builder/decorate/transparent/golden-bell.png" },
    { id: "lily-pad", label: "小荷叶", file: "builder/decorate/transparent/lily-pad.png" },
    { id: "bamboo", label: "翠绿竹子", file: "builder/decorate/transparent/bamboo.png" },
    { id: "mud-splash", label: "淘气泥点", file: "builder/decorate/transparent/mud-splash.png" },
    { id: "cloud", label: "软软云朵", file: "builder/decorate/transparent/cloud.png" },
    { id: "bell-collar", label: "铃铛项圈", file: "builder/decorate/transparent/bell-collar.png" },
    { id: "eggshell", label: "蛋壳帽子", file: "builder/decorate/transparent/eggshell.png" }
];
const animals = [
    {
        id: "panda",
        name: "大熊猫",
        icon: "🐼",
        habitat: "竹林山地",
        biome: "森林",
        x: 46,
        y: 29,
        color: "#8fcf7a",
        diet: "竹子、竹笋，也会吃少量水果。",
        fact: "大熊猫每天会花很久吃竹子，因为竹子能量不高，它需要慢慢补充力气。",
        care: "安静、凉爽、干净的环境会让它更舒服。",
        quiz: {
            question: "大熊猫最常吃什么？",
            options: ["竹子", "贝壳", "仙人掌"],
            answer: 0
        },
        quick: ["熊猫为什么爱吃竹子？", "熊猫宝宝多大开始爬？", "熊猫住在哪里？"],
        tier: 1,
        unlockRequirements: {
            type: "initial",
            conditions: []
        },
        unlockHint: "欢迎来到动物乐园！"
    },
    {
        id: "rabbit",
        name: "兔子",
        icon: "🐰",
        habitat: "草地和洞穴",
        biome: "草地",
        x: 62,
        y: 52,
        color: "#e6c4d6",
        diet: "草、叶子和少量蔬菜。",
        fact: "兔子的长耳朵能帮助它听到远处声音，也能帮助散热。",
        care: "家养兔子需要干草、清水、安静空间和安全咀嚼物。",
        quiz: {
            question: "兔子的长耳朵能帮助它做什么？",
            options: ["听声音和散热", "游得更快", "挖金子"],
            answer: 0
        },
        quick: ["兔子为什么总在咬东西？", "兔子能洗澡吗？", "兔子害怕时会怎样？"],
        tier: 2,
        unlockRequirements: {
            type: "grassland-group",
            conditions: [
                { stat: "animalInteraction", target: "panda", count: 3 },
                { stat: "storiesCompleted", count: 1 },
                { stat: "quizPassed", count: 1 }
            ]
        },
        unlockHint: "和熊猫聊3次，再完成1个故事和1次测验，兔子与大象会一起跑出草原！"
    },
    {
        id: "frog",
        name: "青蛙",
        icon: "🐸",
        habitat: "池塘和湿地",
        biome: "湿地",
        x: 25,
        y: 65,
        color: "#73bd72",
        diet: "小虫、蚊子和其他小型无脊椎动物。",
        fact: "青蛙小时候是蝌蚪，长大后会长出腿，能在水边跳来跳去。",
        care: "两栖动物需要干净水源和湿润环境。",
        quiz: {
            question: "青蛙小时候通常叫什么？",
            options: ["蝌蚪", "小贝壳", "小羽毛"],
            answer: 0
        },
        quick: ["蝌蚪怎么变成青蛙？", "青蛙为什么会叫？", "青蛙吃什么虫子？"],
        tier: 2,
        unlockRequirements: {
            type: "question",
            conditions: [
                { stat: "totalQuestions", count: 5 }
            ]
        },
        unlockHint: "再问2个问题，湿地会传来小青蛙的声音！"
    },
    {
        id: "penguin",
        name: "企鹅",
        icon: "🐧",
        habitat: "寒冷海岸",
        biome: "冰原",
        x: 72,
        y: 10,
        color: "#dceef7",
        diet: "小鱼、磷虾和乌贼。",
        fact: "企鹅不会飞，但很会游泳，翅膀像小船桨。",
        care: "企鹅喜欢低温和稳定的水质。",
        quiz: {
            question: "企鹅最擅长什么？",
            options: ["游泳", "爬树", "织网"],
            answer: 0
        },
        quick: ["企鹅为什么不会飞？", "企鹅怎么保暖？", "企鹅爸爸会照顾蛋吗？"],
        tier: 2,
        unlockRequirements: {
            type: "quiz",
            conditions: [
                { stat: "quickQA", target: "panda", count: 3 }
            ]
        },
        unlockHint: "完成快问快答，冰原上的小企鹅在等你！"
    },
    {
        id: "dolphin",
        name: "海豚",
        icon: "🐬",
        habitat: "温暖海洋",
        biome: "海洋",
        x: 83,
        y: 70,
        color: "#76c8dd",
        diet: "小鱼、乌贼和甲壳类动物。",
        fact: "海豚会用声音互相联系，还会用回声找到附近的东西。",
        care: "海洋动物需要清洁水域和足够活动空间。",
        quiz: {
            question: "海豚常用什么寻找周围的东西？",
            options: ["回声", "翅膀", "长鼻子"],
            answer: 0
        },
        quick: ["海豚为什么会跳出水面？", "海豚怎么睡觉？", "海豚会互相说话吗？"],
        tier: 3,
        unlockRequirements: {
            type: "compound",
            conditions: [
                { stat: "totalChats", count: 10 },
                { stat: "uniqueAnimals", count: 2 }
            ]
        },
        unlockHint: "和更多动物成为朋友，海洋会有惊喜！"
    },
    {
        id: "elephant",
        name: "大象",
        icon: "🐘",
        habitat: "草原和森林",
        biome: "草原",
        x: 43,
        y: 47,
        color: "#c7d47a",
        diet: "草、树叶、树皮和水果。",
        fact: "大象的鼻子又像手又像吸管，可以拿食物、喝水、闻气味。",
        care: "大象需要很多水、宽阔空间和同伴。",
        quiz: {
            question: "大象用鼻子可以做什么？",
            options: ["拿食物和喝水", "像鸟一样飞", "发光"],
            answer: 0
        },
        quick: ["大象鼻子有多灵活？", "大象为什么喜欢泥巴？", "小象怎么跟妈妈走路？"],
        tier: 3,
        unlockRequirements: {
            type: "grassland-group",
            conditions: [
                { stat: "animalInteraction", target: "panda", count: 3 },
                { stat: "storiesCompleted", count: 1 },
                { stat: "quizPassed", count: 1 }
            ]
        },
        unlockHint: "和熊猫聊3次，再完成1个故事和1次测验，兔子与大象会一起跑出草原！"
    },
    {
        id: "tiger",
        name: "老虎",
        icon: "🐯",
        habitat: "森林和草丛",
        biome: "森林",
        x: 78,
        y: 35,
        color: "#f3b05b",
        diet: "鹿、野猪等动物，是肉食动物。",
        fact: "老虎身上的条纹像森林里的影子，可以帮助它隐藏自己。",
        care: "猛兽需要专业保护，不适合私人饲养。",
        quiz: {
            question: "老虎身上的条纹有什么用？",
            options: ["帮助隐藏", "变成翅膀", "装水"],
            answer: 0
        },
        quick: ["老虎为什么有条纹？", "老虎会游泳吗？", "老虎怎么照顾幼崽？"],
        tier: 4,
        unlockRequirements: {
            type: "achievement",
            conditions: [
                { stat: "totalChats", count: 20 },
                { stat: "quizPassed", count: 3 },
                { stat: "unlockedAnimals", count: 5 }
            ]
        },
        unlockHint: "成为动物专家，森林之王会认可你！"
    },
    {
        id: "camel",
        name: "骆驼",
        icon: "🐫",
        habitat: "沙漠和戈壁",
        biome: "沙漠",
        x: 45,
        y: 88,
        color: "#e3bc6f",
        diet: "干草、灌木和耐旱植物。",
        fact: "骆驼的驼峰主要储存脂肪，可以在缺少食物时提供能量。",
        care: "骆驼适应干燥环境，但仍需要饮水和休息。",
        quiz: {
            question: "骆驼的驼峰主要储存什么？",
            options: ["脂肪", "冰块", "沙子"],
            answer: 0
        },
        quick: ["骆驼为什么能走沙漠？", "骆驼睫毛有什么用？", "驼峰里是水吗？"],
        tier: 4,
        unlockRequirements: {
            type: "ultimate",
            conditions: [
                { stat: "totalChats", count: 30 },
                { stat: "allQuizPassed", value: true },
                { stat: "totalStories", count: 3 }
            ]
        },
        unlockHint: "探索所有生态圈，沙漠之舟在远方等你！"
    }
];

const animalCareProfiles = {
    panda: {
        favoriteFood: "竹子",
        edibleFoods: ["竹子", "竹笋", "苹果"],
        unsafeFoods: ["巧克力", "辣椒", "肉骨头", "糖果"]
    },
    rabbit: {
        favoriteFood: "干草",
        edibleFoods: ["干草", "叶子", "少量胡萝卜"],
        unsafeFoods: ["巧克力", "鱼骨头", "洋葱", "糖果"]
    },
    frog: {
        favoriteFood: "小虫子",
        edibleFoods: ["小虫子", "蚊子", "小飞虫"],
        unsafeFoods: ["饼干", "竹子", "牛奶", "辣椒"]
    },
    penguin: {
        favoriteFood: "小鱼",
        edibleFoods: ["小鱼", "磷虾", "乌贼"],
        unsafeFoods: ["竹子", "糖果", "热汤", "饼干"]
    },
    dolphin: {
        favoriteFood: "小鱼",
        edibleFoods: ["小鱼", "乌贼", "甲壳类"],
        unsafeFoods: ["青草", "巧克力", "竹笋", "饼干"]
    },
    elephant: {
        favoriteFood: "树叶",
        edibleFoods: ["树叶", "草", "水果"],
        unsafeFoods: ["巧克力", "肉骨头", "辣椒", "塑料袋"]
    },
    tiger: {
        favoriteFood: "鲜肉",
        edibleFoods: ["鲜肉", "鹿肉", "鸡肉"],
        unsafeFoods: ["竹子", "糖果", "青草", "巧克力"]
    },
    camel: {
        favoriteFood: "干草",
        edibleFoods: ["干草", "灌木叶", "耐旱植物"],
        unsafeFoods: ["冰淇淋", "巧克力", "鱼骨头", "糖果"]
    }
};

const animalQuizBank = {
    panda: [
        {
            question: "大熊猫主要住在哪里？",
            options: ["沙漠", "竹林山地", "海底"],
            answer: 1
        },
        {
            question: "保护熊猫最重要的是保护什么？",
            options: ["竹林家园", "玩具车", "糖果屋"],
            answer: 0
        },
        {
            question: "熊猫宝宝刚出生时通常怎样？",
            options: ["已经会飞", "很小很需要照顾", "会自己做饭"],
            answer: 1
        }
    ],
    rabbit: [
        {
            question: "兔子住在哪里更安全？",
            options: ["很吵的马路", "安静的草地洞穴", "深海里"],
            answer: 1
        },
        {
            question: "兔子为什么常常咬东西？",
            options: ["牙齿会慢慢长", "想变成老虎", "耳朵会变短"],
            answer: 0
        },
        {
            question: "兔子适合吃哪类食物？",
            options: ["巧克力", "鱼骨头", "干草和叶子"],
            answer: 2
        }
    ],
    frog: [
        {
            question: "青蛙喜欢什么样的地方？",
            options: ["干热沙漠", "湿润水边", "雪山顶"],
            answer: 1
        },
        {
            question: "青蛙用什么帮助跳跃？",
            options: ["有力的后腿", "长鼻子", "小翅膀"],
            answer: 0
        },
        {
            question: "青蛙常吃什么？",
            options: ["石头", "竹子", "小虫子"],
            answer: 2
        }
    ],
    penguin: [
        {
            question: "企鹅的翅膀游泳时像什么？",
            options: ["小船桨", "大雨伞", "长铲子"],
            answer: 0
        },
        {
            question: "企鹅常生活在什么地方？",
            options: ["竹林山地", "寒冷海岸", "热沙漠"],
            answer: 1
        },
        {
            question: "企鹅宝宝需要什么？",
            options: ["糖水", "火堆", "保暖和照顾"],
            answer: 2
        }
    ],
    dolphin: [
        {
            question: "海豚呼吸要到哪里？",
            options: ["水面", "地下", "树洞"],
            answer: 0
        },
        {
            question: "海豚喜欢吃什么？",
            options: ["青草", "小鱼和乌贼", "竹叶"],
            answer: 1
        },
        {
            question: "海豚用声音可以做什么？",
            options: ["织毛衣", "挖山洞", "寻找和交流"],
            answer: 2
        }
    ],
    elephant: [
        {
            question: "大象为什么喜欢泥巴？",
            options: ["帮助降温防晒", "变成石头", "装饰鼻子"],
            answer: 0
        },
        {
            question: "大象的大耳朵能帮助什么？",
            options: ["在天空飞", "帮助散热", "装满食物"],
            answer: 1
        },
        {
            question: "小象通常和谁一起走？",
            options: ["小鱼", "独自去月亮", "象群家人"],
            answer: 2
        }
    ],
    tiger: [
        {
            question: "老虎属于哪类动物？",
            options: ["食肉动物", "只吃草的动物", "小昆虫"],
            answer: 0
        },
        {
            question: "老虎会游泳吗？",
            options: ["只会飞", "会游泳", "不能碰水"],
            answer: 1
        },
        {
            question: "为什么要保护老虎？",
            options: ["让它住进教室", "给它穿衣服", "维持森林生态"],
            answer: 2
        }
    ],
    camel: [
        {
            question: "骆驼宽宽的脚掌有什么用？",
            options: ["不容易陷进沙里", "游得更快", "抓树枝"],
            answer: 0
        },
        {
            question: "骆驼长睫毛能帮助什么？",
            options: ["发光", "挡风沙", "听声音"],
            answer: 1
        },
        {
            question: "驼峰里的脂肪能帮助骆驼什么？",
            options: ["变成鱼", "挖沙洞", "缺食物时有能量"],
            answer: 2
        }
    ]
};

function getDateKey(time = Date.now()) {
    const date = new Date(time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getAnimalCareProfile(animal) {
    return animalCareProfiles[animal.id] || {
        favoriteFood: animal.diet.split(/[，、。；]/).find(Boolean)?.trim() || "喜欢的食物",
        edibleFoods: animal.diet.split(/[，、。；]/).map((item) => item.trim()).filter(Boolean).slice(0, 3),
        unsafeFoods: ["巧克力", "糖果", "辣椒"]
    };
}

function getDailyQuizSet(animal) {
    const set = state.dailyQuizSets?.[animal.id];
    if (set?.date === getDateKey() && Array.isArray(set.questions) && set.questions.length) {
        return set;
    }
    return null;
}

function getAnimalQuizList(animal) {
    const dailySet = getDailyQuizSet(animal);
    if (dailySet) {
        return dailySet.questions.slice(0, 4).map((quiz, index) => ({
            ...quiz,
            index,
            total: Math.min(dailySet.questions.length, 4)
        }));
    }

    const extraQuestions = animalQuizBank[animal.id] || [];
    return [animal.quiz, ...extraQuestions].filter(Boolean).slice(0, 4).map((quiz, index, list) => ({
        ...quiz,
        index,
        total: list.length
    }));
}

function getAnimalQuizCursor(animal) {
    const list = getAnimalQuizList(animal);
    const cursor = Number(state.quizCursor?.[animal.id] || 0);
    if (!Number.isFinite(cursor) || cursor < 0) return 0;
    if (getDailyQuizSet(animal)) return Math.min(cursor, list.length);
    return cursor % list.length;
}

function getActiveAnimalQuiz(animal) {
    const list = getAnimalQuizList(animal);
    const cursor = getAnimalQuizCursor(animal);
    if (cursor >= list.length) return null;
    return list[getAnimalQuizCursor(animal)] || animal.quiz;
}

function moveToNextAnimalQuiz(animal) {
    const list = getAnimalQuizList(animal);
    if (!state.quizCursor) state.quizCursor = {};
    const nextCursor = getAnimalQuizCursor(animal) + 1;
    state.quizCursor[animal.id] = getDailyQuizSet(animal)
        ? Math.min(nextCursor, list.length)
        : nextCursor % list.length;
    state.lastQuiz = null;
}

const defaultState = {
    profile: null,
    pendingRole: "child",
    route: "map",
    selectedAnimalId: "panda",
    selectedAnimal: null, // For new QA view
    qaStage: 'selection', // 'selection', 'loading', 'care', 'doctor'
    animalNicknames: {}, // Store custom names for animals {animalId: nickname}
    currentQuickQuestion: { // 当前备用问题
        animalId: 'panda',
        question: '熊猫为什么爱吃竹子？',
        isGenerating: false
    },
    quickQuestionHistory: {},
    quickQuestionTopicCursor: {},
    dailyQuizSets: {},
    dailyQuizGeneration: {},
    foodInventory: {},
    animalIntimacy: {},
    careEvents: {},
    careEventRisk: {},
    model: models[0],
    storyLength: "medium",
    readSpeed: 0.9,
    contentFilter: "moderate",
    dailyLimit: 0,
    autoSave: true,
    storyFilter: { animal: "", search: "", sort: "time" },
    reportMetricDetail: null,
    careDoctorModal: null,
    careFeedConfirm: null,
    syncRefreshLoading: false,
    lastSyncRefreshAt: null,
    lastSyncRefreshChildId: "",
    progress: {
        visits: {},
        questions: 0,
        doctorChecks: 0,
        feedings: 0,
        treatments: 0,
        quizCorrect: 0,
        quizTotal: 0,
        stories: 0,
        creations: 0,
        activities: [],
        // 解锁系统统计
        totalChats: 0,              // 累计对话次数
        totalQuestions: 0,          // 累计提问次数
        totalQuizPassed: 0,         // 通过的问答测试次数
        totalStories: 0,            // 生成的故事数量
        storiesCompleted: 0,        // 完整阅读的故事数量
        uniqueAnimalsInteracted: [] // 互动过的动物ID列表
    },
    // 动物解锁状态
    animalUnlocks: {
        "panda": {
            unlocked: true,
            unlockedAt: new Date().toISOString(),
            interactionCount: 0,
            quizPassed: false,
            quickQACount: 0
        }
    },
    answers: [],
    doctorLogs: [],
    feedingLogs: [],
    lastQuiz: null,
    quizCursor: {},
    creations: [],
    stories: [],
    draftCreature: {
        canvasVersion: 2,
        name: "",
        habitat: "",
        mood: "好奇",
        color: "#8fc6f5",
        head: "",
        body: "",
        leftHand: "",
        rightHand: "",
        leftFoot: "",
        rightFoot: "",
        wing: "",
        tail: "",
        decoration: "",
        snapshot: "",
        parts: [],
        selectedPart: "",
        transforms: {
            head: { scale: 100, rotation: 0, x: 0, y: 0 },
            body: { scale: 100, rotation: 0, x: 0, y: 0 },
            leftHand: { scale: 100, rotation: 0, x: 0, y: 0 },
            rightHand: { scale: 100, rotation: 0, x: 0, y: 0 },
            leftFoot: { scale: 100, rotation: 0, x: 0, y: 0 },
            rightFoot: { scale: 100, rotation: 0, x: 0, y: 0 },
            wing: { scale: 100, rotation: 0, x: 0, y: 0 },
            tail: { scale: 100, rotation: 0, x: 0, y: 0 },
            decoration: { scale: 100, rotation: 0, x: 0, y: 0 }
        }
    }
};
