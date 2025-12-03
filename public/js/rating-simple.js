// ================================
// 简化版评分系统 - Apple 风格
// ================================

// 存储评分数据
const ratings = new Map();

// 初始化
document.addEventListener('DOMContentLoaded', function() {
  updateStats();
  updateProgress();
  renderCurrentBatch();
});

// 选择电影（点击卡片）
function selectMovie(movieId) {
  const card = document.getElementById(`movie-${movieId}`);
  const overlay = document.getElementById(`overlay-${movieId}`);

  // 切换评分遮罩
  card.classList.toggle('rating');
}

// 评分
function rateMovie(movieId, rating) {
  // 保存评分
  ratings.set(movieId, rating);

  // 更新卡片状态
  const card = document.getElementById(`movie-${movieId}`);
  card.classList.add('rated');
  card.classList.remove('rating');

  // 更新星星显示
  updateStars(movieId, rating);

  // 更新状态文字
  const statusText = document.querySelector(`#status-${movieId} .status-text`);
  if (statusText) {
    statusText.textContent = `已评分: ${rating} 星`;
  }

  // 更新统计和进度
  updateStats();
  updateProgress();
}

// 更新星星显示
function updateStars(movieId, rating) {
  const stars = document.querySelectorAll(`#overlay-${movieId} .star-label`);
  stars.forEach((star, index) => {
    const starValue = index + 1;
    if (starValue <= rating) {
      star.classList.add('active');
    } else {
      star.classList.remove('active');
    }
  });
}

// 更新统计信息
function updateStats() {
  const ratedCount = ratings.size;
  document.getElementById('ratedCount').textContent = ratedCount;
  document.querySelectorAll('#selectedCount').forEach(el => {
    el.textContent = ratedCount;
  });

  // 更新提交按钮状态
  const submitBtn = document.getElementById('submitButton');
  const minRequired = window.minSelectionRequired || 10;
  submitBtn.disabled = ratedCount < minRequired;
}

// 更新进度条
function updateProgress() {
  const ratedCount = ratings.size;
  const minRequired = window.minSelectionRequired || 10;
  const percentage = Math.min((ratedCount / minRequired) * 100, 100);

  const progressFill = document.getElementById('progressFill');
  if (progressFill) {
    progressFill.style.width = percentage + '%';
  }
}

// 渲染当前批次
function renderCurrentBatch() {
  const grid = document.getElementById('moviesGrid');
  if (!grid || !window.movieBatches) return;

  const currentBatch = window.movieBatches[window.currentBatchIndex] || [];

  if (currentBatch.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fas fa-film"></i>
        <h3>暂无电影数据</h3>
        <p>请刷新页面重试</p>
        <button class="btn btn-primary" onclick="location.reload()">刷新页面</button>
      </div>
    `;
    return;
  }

  // 生成HTML
  let html = '';
  currentBatch.forEach(movie => {
    const hasRating = ratings.has(movie.movieid.toString());
    const rating = hasRating ? ratings.get(movie.movieid.toString()) : 0;
    const genres = movie.typelist ? movie.typelist.split(',').slice(0, 2) : [];

    html += `
      <div class="movie-rating-card ${hasRating ? 'rated' : ''}"
           id="movie-${movie.movieid}"
           data-movie-id="${movie.movieid}"
           onclick="selectMovie('${movie.movieid}')">
        <div class="card-poster">
          ${movie.picture ?
            `<img src="${movie.picture}" alt="${movie.moviename}">` :
            `<div class="poster-placeholder"><i class="fas fa-film"></i></div>`
          }
          <div class="rating-overlay" id="overlay-${movie.movieid}">
            <div class="rating-stars">
              ${[1,2,3,4,5].map(star => `
                <label class="star-label ${star <= rating ? 'active' : ''}"
                       data-star="${star}"
                       onclick="rateMovie('${movie.movieid}', ${star}); event.stopPropagation();">
                  <i class="fas fa-star"></i>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="card-info">
          <h3 class="movie-title" title="${movie.moviename}">${movie.moviename}</h3>
          ${genres.length > 0 ? `
            <div class="movie-genres">
              ${genres.map(g => `<span class="genre-tag">${g.trim()}</span>`).join('')}
            </div>
          ` : ''}
          ${movie.averating ? `
            <div class="movie-avg-rating">
              <i class="fas fa-star"></i>
              <span>${movie.averating}</span>
            </div>
          ` : ''}
        </div>
        <div class="rating-status" id="status-${movie.movieid}">
          <span class="status-text">${hasRating ? `已评分: ${rating} 星` : '点击评分'}</span>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;

  // 更新批次号显示
  const batchNum = document.getElementById('batchNum');
  if (batchNum) {
    batchNum.textContent = window.currentBatchIndex + 1;
  }
}

// 上一批
function loadPrevBatch() {
  const total = window.totalBatches || 1;
  window.currentBatchIndex = (window.currentBatchIndex - 1 + total) % total;
  renderCurrentBatch();
}

// 下一批
function loadNextBatch() {
  const total = window.totalBatches || 1;
  window.currentBatchIndex = (window.currentBatchIndex + 1) % total;
  renderCurrentBatch();
}

// 提交评分
function submitRatings() {
  if (ratings.size < (window.minSelectionRequired || 10)) {
    alert(`请至少为 ${window.minSelectionRequired} 部电影评分`);
    return;
  }

  // 确认提交
  if (!confirm(`您已为 ${ratings.size} 部电影评分，确认提交吗？`)) {
    return;
  }

  // 准备数据
  const selectedData = [];
  ratings.forEach((rating, movieId) => {
    selectedData.push({
      movieid: movieId,
      rating: rating
    });
  });

  // 设置隐藏字段
  document.getElementById('selectedData').value = JSON.stringify(selectedData);

  // 提交表单
  document.getElementById('movieSelectionForm').submit();
}

// 防止点击卡片时触发评分
document.addEventListener('click', function(e) {
  // 如果点击的是卡片但不是星星，关闭评分遮罩
  const card = e.target.closest('.movie-rating-card');
  if (card && !e.target.closest('.rating-overlay') && !e.target.closest('.star-label')) {
    const movieId = card.dataset.movieId;
    card.classList.remove('rating');
  }
});
