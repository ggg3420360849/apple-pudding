// 全局状态
let currentAccount = null;
let currentChild = null;
let offlineQueue = [];

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    console.log('应用启动...');

    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/static/service-worker.js');
            console.log('Service Worker 注册成功:', registration);
        } catch (error) {
            console.error('Service Worker 注册失败:', error);
        }
    }

    // 检查网络状态
    updateOnlineStatus();
    window.addEventListener('online', () => {
        updateOnlineStatus();
        syncOfflineData();
    });
    window.addEventListener('offline', updateOnlineStatus);

    // 从 localStorage 加载账号信息
    loadAccountFromStorage();

    // 家庭数据只能在登录后访问。
    if (!currentAccount) {
        const parentAccount = localStorage.getItem('parentAccount');
        if (parentAccount) currentAccount = JSON.parse(parentAccount);
    }
    if (!currentAccount || !localStorage.getItem('parentToken')) {
        window.location.href = '/static/index-login.html';
        return;
    } else {
        await loadChildren();
        await loadDashboard();
        await loadImaginedAnimals();
    }
});

// 更新在线状态
function updateOnlineStatus() {
    const indicator = document.getElementById('offlineIndicator');
    if (!navigator.onLine) {
        indicator.classList.add('active');
    } else {
        indicator.classList.remove('active');
    }
}

// 从存储加载账号
function loadAccountFromStorage() {
    const stored = localStorage.getItem('familyAccount');
    if (stored) {
        currentAccount = JSON.parse(stored);
    }
}

// 保存账号到存储
function saveAccountToStorage() {
    if (currentAccount) {
        localStorage.setItem('familyAccount', JSON.stringify(currentAccount));
    }
}

// 初始化账号
async function initializeAccount() {
    try {
        const response = await authFetch('/api/family/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                parent_name: '家长',
                email: 'parent@example.com'
            })
        });

        if (response.ok) {
            const data = await response.json();
            currentAccount = {
                id: data.account_id,
                parent_name: data.parent_name
            };
            saveAccountToStorage();
            console.log('账号创建成功:', currentAccount);
        }
    } catch (error) {
        console.error('创建账号失败:', error);
    }
}

// 加载孩子列表
async function loadChildren() {
    if (!currentAccount) return;

    try {
        const response = await authFetch(`/api/family/accounts/${currentAccount.id}`);
        if (response.ok) {
            const data = await response.json();
            const children = data.account.children || [];

            const selector = document.getElementById('childSelector');
            selector.innerHTML = '<option value="">请选择孩子</option>';

            children.forEach(child => {
                const option = document.createElement('option');
                option.value = child.id;
                option.textContent = `${child.avatar || '👤'} ${child.name}`;
                selector.appendChild(option);
            });

            // 如果有孩子，自动选择第一个
            if (children.length > 0) {
                selector.value = children[0].id;
                currentChild = children[0];
                loadDashboard();
            }
        }
    } catch (error) {
        console.error('加载孩子列表失败:', error);
    }
}

// 切换孩子
document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('childSelector');
    if (selector) {
        selector.addEventListener('change', async (e) => {
            const childId = e.target.value;
            if (childId && currentAccount) {
                try {
                    const response = await authFetch(`/api/family/accounts/${currentAccount.id}/children/${childId}`);
                    if (response.ok) {
                        const data = await response.json();
                        currentChild = data.child;
                        await loadDashboard();
                        await loadImaginedAnimals();
                    }
                } catch (error) {
                    console.error('加载孩子信息失败:', error);
                }
            }
        });
    }
});

// 切换标签页
function switchTab(tabName) {
    // 更新标签按钮
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    // 更新内容
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    // 加载对应数据
    switch(tabName) {
        case 'overview':
            loadDashboard();
            loadImaginedAnimals();
            break;
        case 'achievements':
            loadAchievements();
            break;
        case 'calendar':
            loadCalendar();
            break;
        case 'leaderboard':
            loadLeaderboard();
            break;
        case 'goals':
            loadGoals();
            break;
        case 'offline':
            loadOfflineStats();
            break;
    }
}

// 加载仪表盘
async function loadDashboard() {
    if (!currentChild || !currentAccount) return;

    try {
        const response = await authFetch(`/api/family/accounts/${currentAccount.id}/children/${currentChild.id}`);
        if (response.ok) {
            const data = await response.json();
            const child = data.child;

            // 更新统计卡片
            document.getElementById('animalsCount').textContent = child.animals_explored?.length || 0;

            const accuracy = child.questions_answered > 0
                ? Math.round((child.questions_correct / child.questions_answered) * 100)
                : 0;
            document.getElementById('accuracy').textContent = accuracy + '%';
            document.getElementById('totalQuestions').textContent = child.questions_answered || 0;

            document.getElementById('storiesCount').textContent = child.stories_created || 0;
            document.getElementById('streak').textContent = child.current_streak || 0;

            // 显示已获得徽章
            const badgesDiv = document.getElementById('earnedBadges');
            if (child.badges && child.badges.length > 0) {
                badgesDiv.innerHTML = child.badges.map(badge =>
                    `<span style="font-size: 32px; margin: 5px;">🏆</span>`
                ).join('');
            } else {
                badgesDiv.innerHTML = '<p style="color: #61707d;">暂无徽章，快去解锁成就吧！</p>';
            }
        }
    } catch (error) {
        console.error('加载仪表盘失败:', error);
    }
}

// 加载成就系统
async function loadAchievements() {
    if (!currentChild || !currentAccount) return;

    try {
        // 获取所有成就
        const allResponse = await authFetch('/api/achievements/all');
        const allData = await allResponse.json();

        // 获取进度
        const progressResponse = await authFetch(`/api/achievements/progress/${currentAccount.id}/${currentChild.id}`);
        const progressData = await progressResponse.json();

        const container = document.getElementById('achievementsList');
        container.innerHTML = '';

        allData.achievements.forEach(achievement => {
            const progress = progressData.progress.progress_by_achievement[achievement.id];
            const earned = progress?.earned || false;

            const card = document.createElement('div');
            card.className = `achievement-card ${earned ? 'earned' : 'locked'}`;

            const tierClass = `tier-${achievement.tier}`;
            const progressPercent = progress?.percentage || 0;

            card.innerHTML = `
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-tier ${tierClass}">${achievement.tier.toUpperCase()}</div>
                <h3>${achievement.name}</h3>
                <p style="color: #61707d; font-size: 14px; margin: 10px 0;">${achievement.description}</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%">
                        ${Math.round(progressPercent)}%
                    </div>
                </div>
                <p style="font-size: 12px; color: #61707d;">
                    ${progress?.current || 0} / ${achievement.requirement_value}
                </p>
            `;

            container.appendChild(card);
        });
    } catch (error) {
        console.error('加载成就失败:', error);
    }
}

// 加载日历
async function loadCalendar() {
    if (!currentChild || !currentAccount) return;

    try {
        const response = await authFetch(`/api/achievements/calendar/${currentAccount.id}/${currentChild.id}`);
        const data = await response.json();
        const calendar = data.calendar;

        const container = document.getElementById('calendarGrid');
        container.innerHTML = '';

        const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

        calendar.days.forEach((day, index) => {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';
            if (day.has_activity) dayDiv.classList.add('completed');
            if (day.is_today) dayDiv.classList.add('active');

            dayDiv.innerHTML = `
                <div class="calendar-day-num">${weekDays[index]}</div>
                <div class="calendar-day-badge">${day.has_activity ? '✓' : ''}</div>
                <div style="font-size: 10px; color: var(--muted);">${day.date.split('-')[2]}</div>
            `;

            container.appendChild(dayDiv);
        });
    } catch (error) {
        console.error('加载日历失败:', error);
    }
}

// 加载学习目标
async function loadGoals() {
    if (!currentChild || !currentAccount) return;

    try {
        const response = await authFetch(`/api/family/goals/${currentChild.id}`);
        const data = await response.json();
        const goals = data.goals || [];

        const container = document.getElementById('goalsList');

        if (goals.length === 0) {
            container.innerHTML = '<p style="color: var(--muted);">还没有设置学习目标</p>';
            return;
        }

        container.innerHTML = goals.map(goal => {
            const progress = goal.current_progress || 0;
            const target = goal.target;
            const percentage = Math.min(100, Math.round((progress / target) * 100));
            const completed = progress >= target;

            return `
                <div class="goal-card">
                    <div class="goal-header">
                        <div class="goal-title">${getGoalTypeLabel(goal.goal_type)}</div>
                        <div class="goal-status ${completed ? 'completed' : 'active'}">
                            ${completed ? '✓ 已完成' : '进行中'}
                        </div>
                    </div>
                    <div style="font-size: 14px; color: var(--muted); margin-bottom: 8px;">
                        目标：${target} ${getGoalTypeUnit(goal.goal_type)}
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%">
                            ${progress} / ${target}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('加载目标失败:', error);
    }
}

// 加载排行榜
async function loadLeaderboard() {
    if (!currentAccount) return;

    try {
        const response = await authFetch(`/api/achievements/leaderboard/${currentAccount.id}`);
        const data = await response.json();
        const leaderboard = data.leaderboard || [];

        const container = document.getElementById('leaderboardList');

        if (leaderboard.length === 0) {
            container.innerHTML = '<p style="color: var(--muted);">还没有多个孩子的数据</p>';
            return;
        }

        container.innerHTML = leaderboard.map((child, index) => `
            <div class="leaderboard-item">
                <div class="leaderboard-rank">#${index + 1}</div>
                <div class="leaderboard-avatar">${child.avatar || '👤'}</div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">${child.name}</div>
                    <div class="leaderboard-stats">
                        🏆 ${child.total_badges} 徽章 |
                        🐾 ${child.animals_explored} 动物 |
                        📖 ${child.stories_created} 故事 |
                        🔥 ${child.current_streak} 天连续
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('加载排行榜失败:', error);
    }
}

// 获取目标类型标签
function getGoalTypeLabel(type) {
    const labels = {
        'animals_explored': '探索新动物',
        'questions_correct': '答对题目',
        'stories_created': '创作故事',
        'daily_streak': '连续学习天数'
    };
    return labels[type] || type;
}

// 获取目标类型单位
function getGoalTypeUnit(type) {
    const units = {
        'animals_explored': '种',
        'questions_correct': '道',
        'stories_created': '个',
        'daily_streak': '天'
    };
    return units[type] || '个';
}

// 加载排行榜
async function loadLeaderboard() {
    if (!currentAccount) return;

    try {
        const response = await authFetch(`/api/achievements/leaderboard/${currentAccount.id}`);
        const data = await response.json();
        const leaderboard = data.leaderboard;

        const container = document.getElementById('leaderboardList');
        if (leaderboard && leaderboard.length > 0) {
            container.innerHTML = leaderboard.map((child, index) => `
                <div class="leaderboard-item">
                    <div class="leaderboard-rank">${index + 1}</div>
                    <div class="leaderboard-avatar">${child.avatar || '👤'}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${child.name}</div>
                        <div class="leaderboard-stats">
                            🏆 ${child.total_badges} 徽章 |
                            🔥 ${child.current_streak} 天连续 |
                            🎯 ${child.accuracy.toFixed(1)}% 正确率
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p style="color: #61707d;">暂无数据</p>';
        }
    } catch (error) {
        console.error('加载排行榜失败:', error);
    }
}

// 加载目标
async function loadGoals() {
    // 目标已在日历页加载
}

// 显示添加孩子模态框
function showAddChildModal() {
    document.getElementById('addChildModal').classList.add('active');
}

// 关闭模态框
function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// 添加孩子
async function addChild() {
    const name = document.getElementById('childName').value;
    const age = document.getElementById('childAge').value;
    const avatar = document.getElementById('childAvatar').value;

    if (!name) {
        showNotification('请输入孩子姓名', 'error');
        return;
    }

    try {
        const response = await authFetch(`/api/family/accounts/${currentAccount.id}/children`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                age: age ? parseInt(age) : null,
                avatar: avatar
            })
        });

        if (response.ok) {
            showNotification('添加成功！', 'success');
            closeModal();
            loadChildren();
        } else {
            showNotification('添加失败，请重试', 'error');
        }
    } catch (error) {
        console.error('添加孩子失败:', error);
        showNotification('添加失败，请重试', 'error');
    }
}

// 创建每周目标
async function createWeeklyGoal() {
    if (!currentChild || !currentAccount) {
        showNotification('请先选择孩子', 'error');
        return;
    }

    const goalType = document.getElementById('goalType').value;
    const target = parseInt(document.getElementById('goalTarget').value);

    try {
        const response = await authFetch('/api/family/goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                child_id: currentChild.id,
                goal_type: goalType,
                target: target
            })
        });

        if (response.ok) {
            showNotification('目标创建成功！', 'success');
            switchTab('calendar');
        } else {
            showNotification('创建失败，请重试', 'error');
        }
    } catch (error) {
        console.error('创建目标失败:', error);
        showNotification('创建失败，请重试', 'error');
    }
}

// 生成动物卡片
async function generateAnimalCard() {
    if (!currentChild || !currentAccount) {
        showNotification('请先选择孩子', 'error');
        return;
    }

    showNotification('正在生成卡片...', 'info');

    try {
        // 这里假设有想象动物数据，实际应该从后端获取
        const response = await authFetch('/api/sharing/card/animal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                account_id: currentAccount.id,
                child_id: currentChild.id,
                content_type: 'imagined_animal',
                content_id: 'demo_animal_1'
            })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            const preview = document.getElementById('sharePreview');
            preview.innerHTML = `
                <img src="${url}" alt="分享卡片">
                <button class="btn btn-primary" style="margin-top: 10px; width: 100%;" onclick="downloadImage('${url}', 'animal_card.png')">
                    下载卡片
                </button>
            `;

            showNotification('卡片生成成功！', 'success');
        }
    } catch (error) {
        console.error('生成卡片失败:', error);
        showNotification('生成失败，请重试', 'error');
    }
}

// 生成故事卡片
async function generateStoryCard() {
    if (!currentChild || !currentAccount) {
        showNotification('请先选择孩子', 'error');
        return;
    }

    showNotification('正在生成卡片...', 'info');

    try {
        const response = await authFetch('/api/sharing/card/story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                account_id: currentAccount.id,
                child_id: currentChild.id,
                content_type: 'story',
                content_id: 'demo_story_1'
            })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            const preview = document.getElementById('sharePreview');
            preview.innerHTML = `
                <img src="${url}" alt="故事卡片">
                <button class="btn btn-primary" style="margin-top: 10px; width: 100%;" onclick="downloadImage('${url}', 'story_card.png')">
                    下载卡片
                </button>
            `;

            showNotification('卡片生成成功！', 'success');
        }
    } catch (error) {
        console.error('生成卡片失败:', error);
        showNotification('生成失败，请重试', 'error');
    }
}

// 生成二维码
async function generateQRCode() {
    if (!currentAccount) {
        showNotification('请先创建账号', 'error');
        return;
    }

    try {
        const response = await authFetch(`/api/sharing/qr-code?account_id=${currentAccount.id}`);

        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            const preview = document.getElementById('qrCodePreview');
            preview.innerHTML = `
                <img src="${url}" alt="邀请二维码" style="max-width: 300px;">
                <p style="text-align: center; margin-top: 10px; color: #61707d;">
                    扫描二维码邀请好友
                </p>
            `;

            showNotification('二维码生成成功！', 'success');
        }
    } catch (error) {
        console.error('生成二维码失败:', error);
        showNotification('生成失败，请重试', 'error');
    }
}

// 下载图片
function downloadImage(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification';

    const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
    const color = type === 'success' ? '#3f9a68' : type === 'error' ? '#ef7d61' : '#2678c7';

    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 24px; color: ${color};">${icon}</div>
            <div>${message}</div>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// 离线数据同步
async function syncOfflineData() {
    if (offlineQueue.length === 0) return;

    try {
        const response = await authFetch('/api/offline/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(offlineQueue)
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`同步成功: ${data.synced} 条记录`);
            offlineQueue = [];
            localStorage.removeItem('offlineQueue');
            showNotification('离线数据同步成功！', 'success');
        }
    } catch (error) {
        console.error('同步失败:', error);
    }
}

// 辅助函数
function getGoalTypeLabel(type) {
    const labels = {
        'explore_animals': '探索动物',
        'answer_questions': '回答问题',
        'create_stories': '创作故事'
    };
    return labels[type] || type;
}

function createOfflineActivityId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// 记录活动（支持离线）
async function recordActivity(activityType, data = {}) {
    if (!currentChild || !currentAccount) return;

    const activity = {
        id: createOfflineActivityId(),
        account_id: currentAccount.id,
        child_id: currentChild.id,
        activity_type: activityType,
        data: data,
        timestamp: Date.now()
    };

    if (navigator.onLine) {
        try {
            await authFetch('/api/family/activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(activity)
            });

            // 检查新成就
            checkNewAchievements();
        } catch (error) {
            console.error('记录活动失败:', error);
            queueOfflineActivity(activity);
        }
    } else {
        queueOfflineActivity(activity);
    }
}

// 队列离线活动
function queueOfflineActivity(activity) {
    const queuedActivity = {
        ...activity,
        id: activity.id || createOfflineActivityId(),
        timestamp: activity.timestamp || Date.now()
    };
    offlineQueue.push(queuedActivity);
    localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
}

// 检查新成就
async function checkNewAchievements() {
    if (!currentChild || !currentAccount) return;

    try {
        const response = await authFetch(`/api/achievements/check/${currentAccount.id}/${currentChild.id}`, {
            method: 'POST'
        });

        if (response.ok) {
            const data = await response.json();
            if (data.newly_earned && data.newly_earned.length > 0) {
                data.newly_earned.forEach(achievement => {
                    showNotification(`🎉 解锁成就：${achievement.icon} ${achievement.name}`, 'success');
                });
            }
        }
    } catch (error) {
        console.error('检查成就失败:', error);
    }
}

// 从localStorage恢复离线队列
const storedQueue = localStorage.getItem('offlineQueue');
if (storedQueue) {
    offlineQueue = JSON.parse(storedQueue).map(activity => ({
        ...activity,
        id: activity.id || createOfflineActivityId(),
        timestamp: activity.timestamp || Date.now()
    }));
    localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
}

// ========== 模态框管理 ==========

function showAddChildModal() {
    const modal = document.getElementById('addChildModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function showAddGoalModal() {
    if (!currentChild) {
        showNotification('请先选择一个孩子', 'error');
        return;
    }
    const modal = document.getElementById('addGoalModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// 点击模态框外部关闭
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// ========== 表单处理 ==========

// 添加孩子表单
document.addEventListener('DOMContentLoaded', () => {
    const addChildForm = document.getElementById('addChildForm');
    if (addChildForm) {
        addChildForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(e.target);
            const data = {
                name: formData.get('name'),
                age: parseInt(formData.get('age')),
                avatar: formData.get('avatar')
            };

            try {
                const response = await authFetch(`/api/family/accounts/${currentAccount.id}/children`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    showNotification('成功添加孩子！', 'success');
                    closeModal('addChildModal');
                    e.target.reset();
                    await loadChildren();
                } else {
                    showNotification('添加失败，请重试', 'error');
                }
            } catch (error) {
                console.error('添加孩子失败:', error);
                showNotification('添加失败：' + error.message, 'error');
            }
        });
    }

    // 添加目标表单
    const addGoalForm = document.getElementById('addGoalForm');
    if (addGoalForm) {
        addGoalForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!currentChild) {
                showNotification('请先选择一个孩子', 'error');
                return;
            }

            const formData = new FormData(e.target);
            const data = {
                child_id: currentChild.id,
                goal_type: formData.get('goal_type'),
                target: parseInt(formData.get('target'))
            };

            try {
                const response = await authFetch('/api/family/goals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    showNotification('目标设置成功！', 'success');
                    closeModal('addGoalModal');
                    e.target.reset();
                    await loadGoals();
                } else {
                    showNotification('设置失败，请重试', 'error');
                }
            } catch (error) {
                console.error('设置目标失败:', error);
                showNotification('设置失败：' + error.message, 'error');
            }
        });
    }
});

// ========== 通知系统 ==========

function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    if (type === 'success') {
        toast.style.background = 'var(--green)';
    } else if (type === 'error') {
        toast.style.background = 'var(--coral)';
    }

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ========== 想象动物展示 ==========

async function loadImaginedAnimals() {
    if (!currentChild || !currentAccount) return;

    try {
        const response = await authFetch(`/api/family/accounts/${currentAccount.id}/children/${currentChild.id}`);
        if (response.ok) {
            const data = await response.json();
            const child = data.child;
            const imaginedAnimals = child.imagined_animals || [];

            const container = document.getElementById('imaginedAnimals');

            if (imaginedAnimals.length === 0) {
                container.innerHTML = '<p style="color: var(--muted);">还没有创作想象动物</p>';
                return;
            }

            container.innerHTML = imaginedAnimals.map(animal => `
                <div class="card" style="margin-bottom: 12px; padding: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <h3 style="margin: 0;">${animal.name || '未命名动物'}</h3>
                        <button onclick="downloadAnimalCard('${currentAccount.id}', '${currentChild.id}', '${animal.id}')"
                                style="padding: 6px 12px; font-size: 14px;">
                            📤 生成卡片
                        </button>
                    </div>
                    <p style="color: var(--muted); font-size: 14px; margin-bottom: 12px;">
                        ${animal.description || ''}
                    </p>
                    ${animal.features && animal.features.length > 0 ? `
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            ${animal.features.map(f => `
                                <span class="badge" style="background: var(--border); color: var(--ink);">
                                    ${f}
                                </span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('加载想象动物失败:', error);
    }
}


// ========== 离线管理功能 ==========

async function loadOfflineStats() {
    try {
        // 加载本地队列统计
        const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
        const pendingCount = queue.length;

        document.getElementById('pendingActivities').textContent = pendingCount;

        // 获取服务器端队列统计
        const response = await authFetch('/api/offline/queue/stats');
        if (response.ok) {
            const data = await response.json();
            document.getElementById('syncedActivities').textContent = data.stats.synced || 0;
        }

        // 估算缓存大小
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            const sizeInKB = Math.round(estimate.usage / 1024);
            document.getElementById('cacheSize').textContent = sizeInKB + ' KB';
        }

        // 显示待同步队列
        const queueList = document.getElementById('offlineQueueList');
        if (pendingCount === 0) {
            queueList.innerHTML = '<p style="color: var(--muted);">暂无待同步数据</p>';
        } else {
            queueList.innerHTML = queue.map((activity, index) => `
                <div class="card" style="padding: 12px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${getActivityTypeLabel(activity.activity_type)}</strong>
                            <span style="color: var(--muted); font-size: 13px; margin-left: 8px;">
                                ${activity.timestamp ? new Date(activity.timestamp).toLocaleString() : '待同步'}
                            </span>
                        </div>
                        <button class="secondary" onclick="removeFromQueue(${index})" style="padding: 4px 12px; font-size: 13px;">
                            移除
                        </button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('加载离线统计失败:', error);
    }
}

function getActivityTypeLabel(type) {
    const labels = {
        'animal_explored': '探索动物',
        'question_answered': '回答问题',
        'story_created': '创作故事',
        'imagined_animal': '想象动物'
    };
    return labels[type] || type;
}

async function syncNow() {
    if (!navigator.onLine) {
        showNotification('当前处于离线状态，无法同步', 'error');
        return;
    }

    const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');

    if (queue.length === 0) {
        showNotification('没有待同步的数据', 'info');
        return;
    }

    try {
        showNotification('正在同步数据...', 'info');

        const response = await authFetch('/api/offline/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(queue)
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('offlineQueue', JSON.stringify([]));
            showNotification(`成功同步 ${data.synced} 条数据`, 'success');
            await loadOfflineStats();
        } else {
            showNotification('同步失败，请重试', 'error');
        }
    } catch (error) {
        console.error('同步失败:', error);
        showNotification('同步失败：' + error.message, 'error');
    }
}

function removeFromQueue(index) {
    const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    queue.splice(index, 1);
    localStorage.setItem('offlineQueue', JSON.stringify(queue));
    loadOfflineStats();
    showNotification('已移除', 'success');
}

async function clearSyncedQueue() {
    if (!confirm('确定要清除服务器上已同步的数据记录吗？')) {
        return;
    }

    try {
        const response = await authFetch('/api/offline/queue/clear', {
            method: 'POST'
        });

        if (response.ok) {
            showNotification('已清除已同步记录', 'success');
            await loadOfflineStats();
        } else {
            showNotification('清除失败', 'error');
        }
    } catch (error) {
        console.error('清除失败:', error);
        showNotification('清除失败：' + error.message, 'error');
    }
}

async function clearAllCache() {
    if (!confirm('警告：这将清空所有缓存数据，包括离线内容。确定要继续吗？')) {
        return;
    }

    try {
        // 清除所有缓存
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));

        // 清除本地队列
        localStorage.removeItem('offlineQueue');

        showNotification('缓存已清空', 'success');
        await loadOfflineStats();

        // 重新注册 Service Worker
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.register('/static/service-worker.js');
            console.log('Service Worker 重新注册成功');
        }
    } catch (error) {
        console.error('清空缓存失败:', error);
        showNotification('清空失败：' + error.message, 'error');
    }
}
