function resetProgress() {
    if (!window.confirm("确定要清空所有学习记录吗？\n\n此操作将删除：\n• 所有活动记录\n• 探索进度\n• 测验成绩\n• 生成的故事\n• 想象的动物\n\n此操作不可恢复！")) {
        return;
    }
    const profile = state.profile;
    state = clone(defaultState);
    state.profile = profile;
    saveState();
    render();
    showToast("学习记录已清空");
}

function exportData() {
    try {
        const exportData = {
            version: "v3",
            exportTime: new Date().toISOString(),
            profile: state.profile,
            progress: state.progress,
            stories: state.stories,
            creations: state.creations,
            settings: {
                model: state.model,
                contentFilter: state.contentFilter,
                dailyLimit: state.dailyLimit,
                autoSave: state.autoSave,
                readSpeed: state.readSpeed
            }
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        const filename = `苹果布丁学习数据_${state.profile.name}_${new Date().toISOString().slice(0, 10)}.json`;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);
        showToast("数据已导出");
    } catch (error) {
        console.error("导出数据失败:", error);
        showToast("导出失败，请重试");
    }
}

function backToParentPortal() {
    // 返回家长门户
    window.location.href = '/static/parent-portal.html';
}
