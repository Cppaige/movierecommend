// 全局状态管理
let currentBatchIndex = window.currentBatchIndex || 0;
let totalBatches = window.totalBatches || 1;
let minSelectionRequired = window.minSelectionRequired || 10;
let movieBatches = window.movieBatches || [];
let ratings = new Map(); // 存储评分：movieId -> rating

let currentMovieId = null;
let currentRating = 0;

// 评分描述文本
const RATING_DESCRIPTIONS = {
    1: '⭐ 很差劲 - 完全不推荐',
    2: '⭐⭐ 不太行 - 可以跳过',
    3: '⭐⭐⭐ 还可以 - 值得一看',
    4: '⭐⭐⭐⭐ 很不错 - 强烈推荐',
    5: '⭐⭐⭐⭐⭐ 超级喜欢 - 必看佳作'
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('初始化评分系统...', {
        currentBatchIndex,
        totalBatches,
        minSelectionRequired,
        movieCount: movieBatches.length
    });

    updateProgress();
    updateBatchInfo();
});

// 选择电影（打开评分弹窗）
function selectMovie(movieId) {
    currentMovieId = movieId;
    currentRating = ratings.get(movieId) || 0;

    // 查找电影信息
    const movie = findMovieById(movieId);
    if (!movie) {
        alert('电影信息未找到');
        return;
    }

    // 填充弹窗内容
    document.getElementById('modalTitle').textContent = movie.moviename;

    // 设置海报
    const posterElement = document.getElementById('modalPoster');
    if (movie.picture) {
        posterElement.innerHTML = `<img src="${movie.picture}" alt="${movie.moviename}" onerror="this.parentElement.innerHTML='<div class=\\'poster-error\\'><i class=\\'fas fa-film\\'></i></div>'">`;
    } else {
        posterElement.innerHTML = '<div class="poster-error"><i class="fas fa-film"></i></div>';
    }

    // 设置类型
    if (movie.typelist) {
        const genres = movie.typelist.split(',').slice(0, 3).map(g => g.trim()).join(' / ');
        document.getElementById('modalGenres').innerHTML = `<i class="fas fa-tags"></i> ${genres}`;
    } else {
        document.getElementById('modalGenres').innerHTML = '';
    }

    // 设置评分
    if (movie.averating) {
        document.getElementById('modalRating').innerHTML = `<i class="fas fa-star"></i> 平均分: ${movie.averating}`;
    } else {
        document.getElementById('modalRating').innerHTML = '';
    }

    // 重置星星状态
    resetStars();

    // 如果已经评过分，显示之前的评分
    if (currentRating > 0) {
        selectRating(currentRating);
    }

    // 显示弹窗
    document.getElementById('ratingModal').style.display = 'flex';
}

// 选择评分
function selectRating(rating) {
    currentRating = rating;

    // 更新星星显示
    const stars = document.querySelectorAll('.star-label');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('selected');
        } else {
            star.classList.remove('selected');
        }
    });

    // 更新描述文本
    document.getElementById('ratingDesc').textContent = RATING_DESCRIPTIONS[rating];

    // 启用确认按钮
    document.querySelector('.btn-confirm').disabled = false;
}

// 确认评分
function confirmRating() {
    if (currentRating === 0) {
        alert('请选择评分');
        return;
    }

    // 保存评分
    ratings.set(currentMovieId, currentRating);

    // 更新卡片显示
    updateMovieCard(currentMovieId, currentRating);

    // 更新进度
    updateProgress();

    // 关闭弹窗
    closeRatingModal();

    // 显示成功提示
    showToast(`已为《${findMovieById(currentMovieId).moviename}》评分 ${currentRating} 星`, 'success');
}

// 更新电影卡片显示
function updateMovieCard(movieId, rating) {
    const card = document.getElementById(`movie-${movieId}`);
    if (!card) return;

    card.classList.add('rated');

    const badge = document.getElementById(`badge-${movieId}`);
    if (badge) {
        badge.style.display = 'flex';
        badge.querySelector('.rating-text').textContent = `${rating}星`;
    }
}

// 重置星星状态
function resetStars() {
    const stars = document.querySelectorAll('.star-label');
    stars.forEach(star => {
        star.classList.remove('selected');
    });
    document.getElementById('ratingDesc').textContent = '请选择评分';
    document.querySelector('.btn-confirm').disabled = true;
    currentRating = 0;
}

// 关闭评分弹窗
function closeRatingModal() {
    document.getElementById('ratingModal').style.display = 'none';
    currentMovieId = null;
    currentRating = 0;
}

// 更新进度显示
function updateProgress() {
    const ratedCount = ratings.size;
    const remaining = Math.max(0, minSelectionRequired - ratedCount);
    const percentage = Math.min((ratedCount / minSelectionRequired) * 100, 100);

    // 更新文本
    document.getElementById('ratedCount').textContent = ratedCount;
    document.getElementById('ratedCountText').textContent = ratedCount;
    document.getElementById('remainingCount').textContent = remaining;

    // 更新环形进度条
    const circle = document.getElementById('progressCircle');
    const circumference = 2 * Math.PI * 50;
    const offset = circumference - (percentage / 100) * circumference;
    circle.style.strokeDashoffset = offset;

    // 更新提交按钮状态
    const submitBtn = document.getElementById('submitButton');
    if (ratedCount >= minSelectionRequired) {
        submitBtn.disabled = false;
        submitBtn.classList.add('ready');
    } else {
        submitBtn.disabled = true;
        submitBtn.classList.remove('ready');
    }
}

// 更新批次信息
function updateBatchInfo() {
    document.getElementById('batchInfo').textContent = `${currentBatchIndex + 1} / ${totalBatches}`;
}

// 查找电影信息
function findMovieById(movieId) {
    for (let batch of movieBatches) {
        const movie = batch.find(m => m.movieid.toString() === movieId.toString());
        if (movie) return movie;
    }
    return null;
}

// 加载上一批
function loadPrevBatch() {
    currentBatchIndex = (currentBatchIndex - 1 + totalBatches) % totalBatches;
    renderCurrentBatch();
    updateBatchInfo();
}

// 加载下一批
function loadNextBatch() {
    currentBatchIndex = (currentBatchIndex + 1) % totalBatches;
    renderCurrentBatch();
    updateBatchInfo();
}

// 渲染当前批次
function renderCurrentBatch() {
    const moviesGrid = document.getElementById('moviesGrid');
    if (!moviesGrid) return;

    const currentBatch = movieBatches[currentBatchIndex] || [];

    if (currentBatch.length === 0) {
        moviesGrid.innerHTML = `
            <div class="no-movies">
                <i class="fas fa-film"></i>
                <h3>暂无电影数据</h3>
                <p>请尝试切换批次或刷新页面</p>
            </div>
        `;
        return;
    }

    moviesGrid.innerHTML = '';

    currentBatch.forEach(movie => {
        const isRated = ratings.has(movie.movieid.toString());
        const rating = ratings.get(movie.movieid.toString()) || 0;

        const movieCard = document.createElement('div');
        movieCard.className = `movie-card ${isRated ? 'rated' : ''}`;
        movieCard.id = `movie-${movie.movieid}`;
        movieCard.setAttribute('data-movie-id', movie.movieid);
        movieCard.onclick = () => selectMovie(movie.movieid);

        // 构建类型标签
        let genreHTML = '';
        if (movie.typelist) {
            const genres = movie.typelist.split(',').slice(0, 2);
            genreHTML = genres.map(g => `<span class="genre-tag">${g.trim()}</span>`).join('');
        }

        // 构建海报HTML
        let posterHTML = '';
        if (movie.picture) {
            posterHTML = `<img src="${movie.picture}" alt="${movie.moviename}" onerror="this.parentElement.innerHTML='<div class=\\'poster-placeholder\\'><i class=\\'fas fa-film\\'></i></div>'">`;
        } else {
            posterHTML = '<div class="poster-placeholder"><i class="fas fa-film"></i></div>';
        }

        movieCard.innerHTML = `
            <div class="movie-poster">
                ${posterHTML}
                <div class="movie-overlay">
                    <i class="fas fa-star"></i>
                    <span>点击评分</span>
                </div>
            </div>
            <div class="movie-info">
                <div class="movie-title" title="${movie.moviename}">${movie.moviename}</div>
                ${movie.typelist ? `<div class="movie-genres">${genreHTML}</div>` : ''}
                ${movie.averating ? `<div class="movie-rating"><i class="fas fa-star"></i><span>${movie.averating}</span></div>` : ''}
            </div>
            <div class="rating-badge" id="badge-${movie.movieid}" style="display: ${isRated ? 'flex' : 'none'};">
                <i class="fas fa-check"></i>
                <span class="rating-text">${rating}星</span>
            </div>
        `;

        moviesGrid.appendChild(movieCard);
    });
}

// 提交评分
async function submitRatings() {
    if (ratings.size < minSelectionRequired) {
        alert(`请至少评分 ${minSelectionRequired} 部电影`);
        return;
    }

    // 构建提交数据：movieId:rating,movieId:rating
    const dataArray = Array.from(ratings.entries())
        .map(([movieId, rating]) => `${movieId}:${rating}`);
    const selectedData = dataArray.join(',');

    console.log('提交评分数据:', selectedData);

    // 禁用按钮，显示加载状态
    const submitBtn = document.getElementById('submitButton');
    const originalHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';

    try {
        const formData = new FormData();
        formData.append('userid', window.userid);
        formData.append('selectedData', selectedData);

        const response = await fetch('/submit-and-recommend', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();

            if (result.redirectUrl) {
                showToast('评分提交成功，正在生成推荐...', 'success');

                setTimeout(() => {
                    window.location.href = result.redirectUrl;
                }, 1500);
            } else {
                throw new Error('服务器返回数据错误');
            }
        } else {
            throw new Error('提交失败');
        }
    } catch (error) {
        console.error('提交错误:', error);
        alert('提交失败，请重试: ' + error.message);

        // 恢复按钮状态
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
    }
}

// 显示提示消息
function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    else if (type === 'error') icon = 'fa-exclamation-circle';
    else if (type === 'warning') icon = 'fa-exclamation-triangle';

    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// 导出全局函数
window.selectMovie = selectMovie;
window.selectRating = selectRating;
window.confirmRating = confirmRating;
window.closeRatingModal = closeRatingModal;
window.loadPrevBatch = loadPrevBatch;
window.loadNextBatch = loadNextBatch;
window.submitRatings = submitRatings;
