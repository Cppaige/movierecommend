/**
 * 收藏功能模块
 */

// 切换收藏状态
async function toggleFavorite(movieId, buttonElement) {
    // 检查是否登录
    const isLogin = document.body.dataset.isLogin === 'true';
    if (!isLogin) {
        alert('请先登录');
        window.location.href = '/loginpage';
        return;
    }

    const isFavorited = buttonElement.classList.contains('favorited');
    const action = isFavorited ? 'remove' : 'add';

    try {
        const response = await fetch(`/api/favorites/${action}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ movieid: movieId })
        });

        const data = await response.json();

        if (data.success) {
            // 更新按钮状态
            if (isFavorited) {
                buttonElement.classList.remove('favorited');
                buttonElement.querySelector('i').classList.remove('fas');
                buttonElement.querySelector('i').classList.add('far');
                showToast('已取消收藏');
            } else {
                buttonElement.classList.add('favorited');
                buttonElement.querySelector('i').classList.remove('far');
                buttonElement.querySelector('i').classList.add('fas');
                showToast('收藏成功');
            }
        } else {
            alert(data.message || '操作失败');
        }
    } catch (error) {
        console.error('收藏操作失败:', error);
        alert('操作失败，请重试');
    }
}

// 批量检查收藏状态
async function checkFavoritesStatus(movieIds) {
    if (!movieIds || movieIds.length === 0) return;

    try {
        const promises = movieIds.map(movieId =>
            fetch(`/api/favorites/check/${movieId}`)
                .then(res => res.json())
                .then(data => ({ movieId, favorited: data.favorited }))
        );

        const results = await Promise.all(promises);

        // 更新UI
        results.forEach(({ movieId, favorited }) => {
            const button = document.querySelector(`[data-movie-id="${movieId}"] .favorite-btn`);
            if (button && favorited) {
                button.classList.add('favorited');
                const icon = button.querySelector('i');
                if (icon) {
                    icon.classList.remove('far');
                    icon.classList.add('fas');
                }
            }
        });
    } catch (error) {
        console.error('检查收藏状态失败:', error);
    }
}

// 显示提示信息
function showToast(message) {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;

    // 添加样式
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 24px;
        border-radius: 25px;
        font-size: 14px;
        z-index: 10000;
        animation: slideDown 0.3s ease;
    `;

    document.body.appendChild(toast);

    // 3秒后移除
    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2000);
}

// 添加动画CSS
if (!document.getElementById('favorites-animations')) {
    const style = document.createElement('style');
    style.id = 'favorites-animations';
    style.textContent = `
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translate(-50%, -20px);
            }
            to {
                opacity: 1;
                transform: translate(-50%, 0);
            }
        }

        @keyframes slideUp {
            from {
                opacity: 1;
                transform: translate(-50%, 0);
            }
            to {
                opacity: 0;
                transform: translate(-50%, -20px);
            }
        }
    `;
    document.head.appendChild(style);
}

// 导出函数
window.toggleFavorite = toggleFavorite;
window.checkFavoritesStatus = checkFavoritesStatus;
