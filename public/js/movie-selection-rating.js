// 全局变量
let currentBatchIndex = window.currentBatchIndex || 0;
let totalBatches = window.totalBatches || 5;
let minSelectionRequired = window.minSelectionRequired || 10;
let movieBatches = window.movieBatches || [];
let selectedMovies = new Map();

// 切换电影选择
function toggleMovieSelection(movieId) {
    const checkbox = document.getElementById(`checkbox-${movieId}`);
    const card = document.getElementById(`movie-${movieId}`);

    if (!checkbox || !card) return;

    const ratingSection = card.querySelector('.rating-section');
    const ratingValue = card.querySelector('.rating-value');

    // 切换选择状态
    checkbox.checked = !checkbox.checked;

    if (checkbox.checked) {
        // 选择电影
        card.classList.add('selected');
        if (ratingSection) ratingSection.style.display = 'block';

        if (!selectedMovies.has(movieId)) {
            selectedMovies.set(movieId, 3); // 默认3分
            updateMovieRatingDisplay(movieId, 3);
        }

        // 确保默认选中3星
        const starInput = card.querySelector(`input[value="3"]`);
        if (starInput) starInput.checked = true;
    } else {
        // 取消选择
        card.classList.remove('selected');
        if (ratingSection) ratingSection.style.display = 'none';
        selectedMovies.delete(movieId);

        if (ratingValue) ratingValue.textContent = '未评分';

        // 重置所有星星
        const starLabels = card.querySelectorAll('.rating-star');
        starLabels.forEach(label => {
            label.classList.remove('selected');
            const input = label.querySelector('input');
            if (input) input.checked = false;
        });
    }

    updateSelectionInfo();
}

// 处理评分变化
function handleRatingChange(movieId, rating) {
    const card = document.getElementById(`movie-${movieId}`);
    if (!card) return;

    selectedMovies.set(movieId, parseInt(rating));

    // 更新星星显示状态
    const starLabels = card.querySelectorAll('.rating-star');
    starLabels.forEach(label => {
        const starValue = parseInt(label.getAttribute('data-star-value'));
        if (starValue <= rating) {
            label.classList.add('selected');
        } else {
            label.classList.remove('selected');
        }

        // 更新radio状态
        const input = label.querySelector('input');
        if (input && parseInt(input.value) === rating) {
            input.checked = true;
        }
    });

    // 更新评分显示
    const ratingValue = card.querySelector('.rating-value');
    if (ratingValue) {
        ratingValue.textContent = `${rating} 星`;
    }

    updateSelectionInfo();
}

// 更新电影评分显示
function updateMovieRatingDisplay(movieId, rating) {
    const card = document.getElementById(`movie-${movieId}`);
    if (!card) return;

    const ratingValue = card.querySelector('.rating-value');
    if (ratingValue) ratingValue.textContent = `${rating} 星`;

    // 更新星星状态
    const starLabels = card.querySelectorAll('.rating-star');
    starLabels.forEach(label => {
        const starValue = parseInt(label.getAttribute('data-star-value'));
        label.classList.toggle('selected', starValue <= rating);
    });
}

// 更新选择信息
function updateSelectionInfo() {
    const selectedCount = selectedMovies.size;

    const selectedCountElement = document.getElementById('selectedCount');
    const selectedCountTextElement = document.getElementById('selectedCountText');
    const recommendButton = document.getElementById('recommendButton');
    const progressFill = document.getElementById('progressFill');
    const selectedDataInput = document.getElementById('selectedData');

    if (selectedCountElement) selectedCountElement.textContent = selectedCount;
    if (selectedCountTextElement) selectedCountTextElement.textContent = selectedCount;

    const progressPercentage = Math.min((selectedCount / minSelectionRequired) * 100, 100);
    if (progressFill) {
        progressFill.style.width = progressPercentage + '%';
        progressFill.style.backgroundColor = selectedCount >= minSelectionRequired ? '#28a745' : '#ffc107';
    }

    if (recommendButton) {
        recommendButton.disabled = selectedCount < minSelectionRequired;
        recommendButton.classList.toggle('active', selectedCount >= minSelectionRequired);
    }

    // 构建数据格式：movieId:rating,movieId:rating
    const dataArray = Array.from(selectedMovies.entries())
        .map(([movieId, rating]) => `${movieId}:${rating}`);
    if (selectedDataInput) selectedDataInput.value = dataArray.join(',');
}

// 加载下一批电影
function loadNextBatch() {
    currentBatchIndex = (currentBatchIndex + 1) % totalBatches;
    renderCurrentBatch();
}

// 渲染当前批次的电影
function renderCurrentBatch() {
    const moviesGrid = document.getElementById('moviesGrid');
    if (!moviesGrid) return;

    const currentBatch = movieBatches[currentBatchIndex] || [];

    if (currentBatch.length === 0) {
        moviesGrid.innerHTML = '<div class="no-movies">暂无更多电影数据</div>';
        return;
    }

    moviesGrid.innerHTML = '';

    currentBatch.forEach(movie => {
        const isSelected = selectedMovies.has(movie.movieid.toString());
        const currentRating = selectedMovies.get(movie.movieid.toString()) || 3;

        const movieCard = document.createElement('div');
        movieCard.className = `movie-card ${isSelected ? 'selected' : ''}`;
        movieCard.id = `movie-${movie.movieid}`;
        movieCard.setAttribute('data-movie-id', movie.movieid);

        // 创建星星HTML
        let starsHtml = '';
        for (let star = 5; star >= 1; star--) {
            const isSelectedStar = currentRating >= star;
            starsHtml += `
                <label class="rating-star ${isSelectedStar ? 'selected' : ''}" 
                        data-star-value="${star}"
                        onclick="handleRatingChange('${movie.movieid}', ${star})">
                    <input type="radio" 
                           name="rating_${movie.movieid}" 
                           value="${star}"
                           ${currentRating === star ? 'checked' : ''}
                           style="display: none;">
                    <span class="star">★</span>
                </label>
            `;
        }

        movieCard.innerHTML = `
            <div class="movie-title">${movie.moviename}</div>
            ${movie.picture ? `<img class="movie-poster" src="${movie.picture}" alt="${movie.moviename}">` : '<div class="movie-poster-placeholder">暂无图片</div>'}

            <div class="rating-section" style="display: ${isSelected ? 'block' : 'none'}">
                <div class="rating-title">请评分：</div>
                <div class="rating-stars">
                    ${starsHtml}
                </div>
                <div class="rating-value" id="rating-value-${movie.movieid}">${isSelected ? currentRating + ' 星' : '未评分'}</div>
            </div>

            <div class="checkbox-wrapper">
                <input class="checkbox-input"
                    type="checkbox"
                    name="selectedMovies"
                    id="checkbox-${movie.movieid}"
                    ${isSelected ? 'checked' : ''}
                    onclick="toggleMovieSelection('${movie.movieid}')">
                <label class="checkbox-label" for="checkbox-${movie.movieid}">选择</label>
            </div>
        `;

        moviesGrid.appendChild(movieCard);
    });

    const nextBatchButton = document.querySelector('.next-batch-button');
    if (nextBatchButton) {
        nextBatchButton.textContent = `换一批 (${currentBatchIndex + 1}/${totalBatches})`;
    }
}

// 搜索过滤电影
function filterMovies() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase().trim();
    const movieCards = document.querySelectorAll('.movie-card');

    movieCards.forEach(card => {
        const movieTitle = card.querySelector('.movie-title')?.textContent.toLowerCase() || '';
        card.style.display = movieTitle.includes(searchTerm) || searchTerm === '' ? '' : 'none';
    });
}

// 提交表单
async function submitForm() {
    if (selectedMovies.size < minSelectionRequired) {
        alert(`请至少选择并评分 ${minSelectionRequired} 部电影`);
        return;
    }

    const modal = document.getElementById('loadingModal');
    if (modal) modal.style.display = 'flex';

    updateProgress(10, '正在保存评分数据...');

    try {
        const formData = new FormData();
        const useridInput = document.querySelector('input[name="userid"]');
        const selectedDataInput = document.getElementById('selectedData');

        if (useridInput) formData.append('userid', useridInput.value);
        if (selectedDataInput) formData.append('selectedData', selectedDataInput.value);

        const submitBtn = document.getElementById('recommendButton');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner">⏳</span> 提交中...';
        }

        updateProgress(30, '保存评分数据...');

        const response = await fetch('/submit-and-recommend', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();

            if (result.redirectUrl) {
                updateProgress(60, '启动推荐引擎...');

                setTimeout(() => {
                    updateProgress(80, '生成推荐结果...');

                    setTimeout(() => {
                        updateProgress(100, '推荐生成完成！');
                        setTimeout(() => {
                            window.location.href = result.redirectUrl;
                        }, 1000);
                    }, 2000);
                }, 1000);
            } else {
                throw new Error('服务器返回数据错误');
            }

        } else {
            throw new Error('提交失败');
        }

    } catch (error) {
        console.error('提交错误:', error);
        alert('提交失败，请重试: ' + error.message);

        const modal = document.getElementById('loadingModal');
        if (modal) modal.style.display = 'none';

        const submitBtn = document.getElementById('recommendButton');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '开始个性化推荐';
        }
    }
}

// 更新进度显示
function updateProgress(percent, message) {
    const progressBar = document.getElementById('modalProgressBar');
    const progressText = document.getElementById('progressText');

    if (progressBar) progressBar.style.width = percent + '%';
    if (progressText) progressText.textContent = message;

    const steps = document.querySelectorAll('.loading-steps .step');
    steps.forEach((step, index) => {
        const stepIndex = Math.floor(percent / 25);
        step.classList.toggle('active', index <= stepIndex);
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化变量
    currentBatchIndex = window.currentBatchIndex || 0;
    totalBatches = window.totalBatches || 5;
    minSelectionRequired = window.minSelectionRequired || 10;
    movieBatches = window.movieBatches || [];

    console.log('初始化数据:', {
        currentBatchIndex,
        totalBatches,
        minSelectionRequired,
        movieBatchesLength: movieBatches.length
    });

    // 更新按钮文本
    const nextBatchButton = document.querySelector('.next-batch-button');
    if (nextBatchButton) {
        nextBatchButton.textContent = `换一批 (${currentBatchIndex + 1}/${totalBatches})`;
    }

    updateSelectionInfo();

    // 搜索功能
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                filterMovies();
            }
        });
    }
});

// 添加全局函数到window对象
window.toggleMovieSelection = toggleMovieSelection;
window.handleRatingChange = handleRatingChange;
window.loadNextBatch = loadNextBatch;
window.filterMovies = filterMovies;
window.submitForm = submitForm;