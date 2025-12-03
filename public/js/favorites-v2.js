/**
 * 收藏功能模块 V2 - 支持分类（想看、已看、喜欢）
 */

// 分类配置
const CATEGORIES = {
    want_watch: { label: '想看', icon: 'fa-bookmark', color: '#3498db' },
    watched: { label: '已看', icon: 'fa-check-circle', color: '#2ecc71' },
    liked: { label: '喜欢', icon: 'fa-heart', color: '#e74c3c' }
};

// 显示收藏菜单
function showFavoriteMenu(movieId, buttonElement) {
    // 检查是否登录
    const isLogin = document.body.dataset.isLogin === 'true';
    if (!isLogin) {
        showToast('请先登录', 'warning');
        setTimeout(() => {
            window.location.href = '/loginpage';
        }, 1500);
        return;
    }

    // 移除已存在的菜单
    const existingMenu = document.querySelector('.favorite-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    // 创建菜单
    const menu = document.createElement('div');
    menu.className = 'favorite-menu';
    menu.innerHTML = `
        <div class="favorite-menu-header">
            <i class="fas fa-star"></i>
            <span>添加到收藏</span>
        </div>
        <div class="favorite-menu-options">
            <div class="favorite-option" data-category="want_watch">
                <i class="fas fa-bookmark"></i>
                <span>想看</span>
            </div>
            <div class="favorite-option" data-category="watched">
                <i class="fas fa-check-circle"></i>
                <span>已看</span>
            </div>
            <div class="favorite-option" data-category="liked">
                <i class="fas fa-heart"></i>
                <span>喜欢</span>
            </div>
        </div>
    `;

    // 定位菜单
    const rect = buttonElement.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = rect.bottom + 10 + 'px';
    menu.style.left = rect.left + 'px';
    menu.style.zIndex = '10000';

    document.body.appendChild(menu);

    // 添加点击事件
    menu.querySelectorAll('.favorite-option').forEach(option => {
        option.addEventListener('click', async function() {
            const category = this.dataset.category;
            await addToFavorite(movieId, category, buttonElement);
            menu.remove();
        });
    });

    // 点击外部关闭菜单
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && e.target !== buttonElement) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

// 添加到收藏
async function addToFavorite(movieId, category, buttonElement) {
    try {
        const response = await fetch('/api/favorites/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                movieid: movieId,
                category: category
            })
        });

        const data = await response.json();

        if (data.success) {
            // 更新按钮状态
            if (buttonElement) {
                buttonElement.classList.add('favorited');
                buttonElement.classList.add(`favorited-${category}`);
            }

            const categoryInfo = CATEGORIES[category];
            showToast(`已添加到"${categoryInfo.label}"`, 'success');

            // 更新导航栏收藏数量
            updateFavoriteCount();
        } else {
            if (data.alreadyExists) {
                showToast('该电影已在此分类中', 'info');
            } else {
                showToast(data.message || '添加失败', 'error');
            }
        }
    } catch (error) {
        console.error('添加收藏失败:', error);
        showToast('操作失败，请重试', 'error');
    }
}

// 移除收藏
async function removeFromFavorite(movieId, category, buttonElement) {
    try {
        const response = await fetch('/api/favorites/remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                movieid: movieId,
                category: category
            })
        });

        const data = await response.json();

        if (data.success) {
            if (buttonElement) {
                buttonElement.classList.remove('favorited');
                buttonElement.classList.remove(`favorited-${category}`);
            }

            showToast('已取消收藏', 'success');

            // 更新导航栏收藏数量
            updateFavoriteCount();
        } else {
            showToast(data.message || '取消失败', 'error');
        }
    } catch (error) {
        console.error('取消收藏失败:', error);
        showToast('操作失败，请重试', 'error');
    }
}

// 批量检查收藏状态
async function checkFavoritesStatus(movieIds) {
    if (!movieIds || movieIds.length === 0) return;

    try {
        const promises = movieIds.map(movieId =>
            fetch(`/api/favorites/check/${movieId}`)
                .then(res => res.json())
                .then(data => ({ movieId, categories: data.categories || [] }))
        );

        const results = await Promise.all(promises);

        // 更新UI
        results.forEach(({ movieId, categories }) => {
            const buttons = document.querySelectorAll(`[data-movie-id="${movieId}"] .favorite-btn`);
            buttons.forEach(button => {
                if (categories.length > 0) {
                    button.classList.add('favorited');
                    // 添加第一个分类的样式
                    button.classList.add(`favorited-${categories[0]}`);
                }
            });
        });
    } catch (error) {
        console.error('检查收藏状态失败:', error);
    }
}

// 更新导航栏收藏数量
async function updateFavoriteCount() {
    try {
        const response = await fetch('/api/favorites/count');
        const data = await response.json();

        if (data.success) {
            const badge = document.querySelector('.favorite-count-badge');
            if (badge) {
                badge.textContent = data.count;
                badge.style.display = data.count > 0 ? 'flex' : 'none';
            }

            // 更新悬停提示中的分类统计
            const tooltip = document.querySelector('.favorite-tooltip');
            if (tooltip && data.byCategory) {
                tooltip.innerHTML = `
                    <div class="tooltip-item">
                        <i class="fas fa-bookmark"></i>
                        <span>想看: ${data.byCategory.want_watch || 0}</span>
                    </div>
                    <div class="tooltip-item">
                        <i class="fas fa-check-circle"></i>
                        <span>已看: ${data.byCategory.watched || 0}</span>
                    </div>
                    <div class="tooltip-item">
                        <i class="fas fa-heart"></i>
                        <span>喜欢: ${data.byCategory.liked || 0}</span>
                    </div>
                    <div class="tooltip-divider"></div>
                    <div class="tooltip-total">总计: ${data.count}</div>
                `;
            }
        }
    } catch (error) {
        console.error('更新收藏数量失败:', error);
    }
}

// 显示提示消息
function showToast(message, type = 'info') {
    // 移除已存在的toast
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) {
        existingToast.remove();
    }

    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;

    // 根据类型选择图标
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    else if (type === 'error') icon = 'fa-exclamation-circle';
    else if (type === 'warning') icon = 'fa-exclamation-triangle';

    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // 动画显示
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // 3秒后移除
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// 添加必要的CSS样式
function injectStyles() {
    if (document.getElementById('favorites-v2-styles')) return;

    const style = document.createElement('style');
    style.id = 'favorites-v2-styles';
    style.textContent = `
        /* 收藏菜单 */
        .favorite-menu {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            overflow: hidden;
            animation: menuSlideIn 0.3s ease;
            min-width: 180px;
        }

        @keyframes menuSlideIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .favorite-menu-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 500;
        }

        .favorite-menu-options {
            padding: 8px 0;
        }

        .favorite-option {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            cursor: pointer;
            transition: all 0.3s;
        }

        .favorite-option:hover {
            background: #f8f9fa;
        }

        .favorite-option i {
            font-size: 1.2rem;
            width: 24px;
            text-align: center;
        }

        .favorite-option[data-category="want_watch"] i {
            color: #3498db;
        }

        .favorite-option[data-category="watched"] i {
            color: #2ecc71;
        }

        .favorite-option[data-category="liked"] i {
            color: #e74c3c;
        }

        /* Toast消息 */
        .toast-message {
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 14px 24px;
            border-radius: 30px;
            font-size: 14px;
            z-index: 10001;
            display: flex;
            align-items: center;
            gap: 10px;
            opacity: 0;
            transition: all 0.3s ease;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }

        .toast-message.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }

        .toast-message i {
            font-size: 16px;
        }

        .toast-success {
            background: linear-gradient(135deg, #2ecc71, #27ae60);
        }

        .toast-error {
            background: linear-gradient(135deg, #e74c3c, #c0392b);
        }

        .toast-warning {
            background: linear-gradient(135deg, #f39c12, #e67e22);
        }

        .toast-info {
            background: linear-gradient(135deg, #3498db, #2980b9);
        }

        /* 收藏按钮状态 */
        .favorite-btn.favorited {
            animation: heartBeat 0.5s ease;
        }

        .favorite-btn.favorited-want_watch {
            background: #3498db !important;
            border-color: #3498db !important;
        }

        .favorite-btn.favorited-watched {
            background: #2ecc71 !important;
            border-color: #2ecc71 !important;
        }

        .favorite-btn.favorited-liked {
            background: #e74c3c !important;
            border-color: #e74c3c !important;
        }

        @keyframes heartBeat {
            0%, 100% { transform: scale(1); }
            25% { transform: scale(1.3); }
            50% { transform: scale(1.1); }
            75% { transform: scale(1.2); }
        }

        /* 收藏数量徽章 */
        .favorite-count-badge {
            position: absolute;
            top: -8px;
            right: -8px;
            background: #e74c3c;
            color: white;
            font-size: 11px;
            font-weight: bold;
            min-width: 18px;
            height: 18px;
            border-radius: 9px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 5px;
            box-shadow: 0 2px 8px rgba(231, 76, 60, 0.4);
            animation: badgePop 0.4s ease;
        }

        @keyframes badgePop {
            0% { transform: scale(0); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
        }

        /* 收藏提示框 */
        .favorite-tooltip {
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 10px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            padding: 16px;
            min-width: 200px;
            opacity: 0;
            visibility: hidden;
            transform: translateY(-10px);
            transition: all 0.3s ease;
            z-index: 1000;
        }

        .nav-favorites:hover .favorite-tooltip {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }

        .tooltip-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 0;
            color: #555;
            font-size: 14px;
        }

        .tooltip-item i {
            width: 20px;
            text-align: center;
            font-size: 16px;
        }

        .tooltip-divider {
            height: 1px;
            background: #eee;
            margin: 8px 0;
        }

        .tooltip-total {
            padding-top: 8px;
            font-weight: 600;
            color: #333;
            text-align: center;
        }
    `;
    document.head.appendChild(style);
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    injectStyles();
    updateFavoriteCount();
});

// 导出函数
window.showFavoriteMenu = showFavoriteMenu;
window.addToFavorite = addToFavorite;
window.removeFromFavorite = removeFromFavorite;
window.checkFavoritesStatus = checkFavoritesStatus;
window.updateFavoriteCount = updateFavoriteCount;
window.showToast = showToast;
