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

function backToParentPortal() {
    // 返回家长门户
    window.location.href = '/static/parent-portal.html';
}
