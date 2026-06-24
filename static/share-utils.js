// 社交分享工具模块

// 生成并下载想象动物分享卡片
async function downloadAnimalCard(accountId, childId, animalId) {
    try {
        const response = await fetch('/api/sharing/card/animal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                account_id: accountId,
                child_id: childId,
                content_id: animalId
            })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `animal_card_${animalId}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (typeof showNotification === 'function') {
                showNotification('卡片已下载！可以分享到朋友圈啦 🎉', 'success');
            }
            return true;
        } else {
            throw new Error('生成卡片失败');
        }
    } catch (error) {
        console.error('下载卡片失败:', error);
        if (typeof showNotification === 'function') {
            showNotification('生成卡片失败：' + error.message, 'error');
        }
        return false;
    }
}

// 生成并下载故事分享卡片
async function downloadStoryCard(accountId, childId, storyId) {
    try {
        const response = await fetch('/api/sharing/card/story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                account_id: accountId,
                child_id: childId,
                content_id: storyId
            })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `story_card_${storyId}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (typeof showNotification === 'function') {
                showNotification('故事卡片已下载！', 'success');
            }
            return true;
        } else {
            throw new Error('生成故事卡片失败');
        }
    } catch (error) {
        console.error('下载故事卡片失败:', error);
        if (typeof showNotification === 'function') {
            showNotification('生成卡片失败：' + error.message, 'error');
        }
        return false;
    }
}

// 生成邀请二维码
async function showInviteQRCode(accountId) {
    try {
        const response = await fetch(`/api/sharing/qr-code?account_id=${accountId}`);

        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            // 创建模态框显示二维码
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-content" style="text-align: center;">
                    <div class="modal-header">邀请朋友加入</div>
                    <p style="color: var(--muted); margin: 16px 0;">
                        扫描二维码或保存图片分享给朋友
                    </p>
                    <img src="${url}" alt="邀请二维码" style="max-width: 300px; border-radius: 8px; margin: 20px auto;">
                    <div class="form-actions" style="justify-content: center; margin-top: 24px;">
                        <button onclick="downloadQRCode('${url}')">下载二维码</button>
                        <button class="secondary" onclick="this.closest('.modal').remove()">关闭</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // 点击外部关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    URL.revokeObjectURL(url);
                }
            });

        } else {
            throw new Error('生成二维码失败');
        }
    } catch (error) {
        console.error('显示二维码失败:', error);
        if (typeof showNotification === 'function') {
            showNotification('生成二维码失败：' + error.message, 'error');
        }
    }
}

// 下载二维码
function downloadQRCode(url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invite_qrcode.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (typeof showNotification === 'function') {
        showNotification('二维码已下载！', 'success');
    }
}

// 复制邀请链接
function copyInviteLink(accountId) {
    const inviteUrl = `${window.location.origin}/invite?ref=${accountId}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(inviteUrl).then(() => {
            if (typeof showNotification === 'function') {
                showNotification('邀请链接已复制到剪贴板！', 'success');
            }
        }).catch(err => {
            console.error('复制失败:', err);
            fallbackCopyText(inviteUrl);
        });
    } else {
        fallbackCopyText(inviteUrl);
    }
}

// 后备复制方法
function fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();

    try {
        document.execCommand('copy');
        if (typeof showNotification === 'function') {
            showNotification('邀请链接已复制！', 'success');
        }
    } catch (err) {
        console.error('复制失败:', err);
        if (typeof showNotification === 'function') {
            showNotification('复制失败，请手动复制：' + text, 'error');
        }
    }

    document.body.removeChild(textArea);
}

// Web Share API 分享（支持移动端原生分享）
async function nativeShare(title, text, url) {
    if (navigator.share) {
        try {
            await navigator.share({
                title: title,
                text: text,
                url: url
            });
            return true;
        } catch (error) {
            console.error('分享失败:', error);
            return false;
        }
    }
    return false;
}

// 导出函数供全局使用
if (typeof window !== 'undefined') {
    window.downloadAnimalCard = downloadAnimalCard;
    window.downloadStoryCard = downloadStoryCard;
    window.showInviteQRCode = showInviteQRCode;
    window.downloadQRCode = downloadQRCode;
    window.copyInviteLink = copyInviteLink;
    window.nativeShare = nativeShare;
}
