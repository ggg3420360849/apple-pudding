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
    { id: "report-settings", label: "设置", icon: "⚙️", title: "系统设置", subtitle: "", roles: ["parent"] }
];

const imagineAssetBase = "/static/assets/imagine/";
const creatureBodies = [
    { id: "panda", label: "墨团熊猫", file: "parts/body-panda.svg" },
    { id: "rabbit", label: "棉花兔兔", file: "parts/body-rabbit.svg" },
    { id: "dog", label: "焦糖小狗", file: "parts/body-dog.svg" },
    { id: "cat", label: "月牙猫咪", file: "parts/body-cat.svg" },
    { id: "chick", label: "太阳小鸡", file: "parts/body-chick.svg" },
    { id: "snake", label: "草莓小蛇", file: "parts/body-snake.svg" },
    { id: "pig", label: "桃桃小猪", file: "parts/body-pig.svg" }
];
const creatureWings = [
    { id: "angel", label: "棉花云翼", file: "parts/wing-angel.svg" },
    { id: "fairy", label: "糖果精灵翼", file: "parts/wing-fairy.svg" },
    { id: "bat", label: "紫莓蝙蝠翼", file: "parts/wing-bat.svg" },
    { id: "dragon", label: "叶片龙翼", file: "parts/wing-dragon.svg" },
    { id: "cloud", label: "云朵气球翼", file: "parts/wing-cloud.svg" }
];
const creatureTails = [
    { id: "fox", label: "枫叶狐狸尾", file: "parts/tail-fox.svg" },
    { id: "dino", label: "嫩芽恐龙尾", file: "parts/tail-dino.svg" },
    { id: "cat", label: "星星猫尾", file: "parts/tail-cat.svg" },
    { id: "puppy", label: "饼干小狗尾", file: "parts/tail-puppy.svg" }
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
    model: models[0],
    storyLength: "medium",
    readSpeed: 0.9,
    contentFilter: "moderate",
    dailyLimit: 0,
    autoSave: true,
    storyFilter: { animal: "", search: "", sort: "time" },
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
    creations: [],
    stories: [],
    draftCreature: {
        name: "云朵跳跳兽",
        habitat: "彩虹森林",
        mood: "好奇",
        color: "#8fc6f5",
        body: "panda",
        wing: "angel",
        tail: "fox",
        parts: ["wing", "tail"],
        selectedPart: "body",
        transforms: {
            body: { scale: 100 },
            wing: { scale: 100, rotation: 0, x: 0, y: 0 },
            tail: { scale: 100, rotation: 0, x: 0, y: 0 },
            horn: { scale: 100, rotation: 0, x: 0, y: 0 }
        }
    }
};
