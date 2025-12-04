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

  // 禁用提交按钮
  const submitBtn = document.getElementById('submitButton');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在保存评分...';

  // 准备数据
  const selectedData = [];
  ratings.forEach((rating, movieId) => {
    selectedData.push({
      movieid: movieId,
      rating: rating
    });
  });

  // 提交评分数据
  fetch('/submit-and-recommend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `userid=${window.userid}&selectedData=${encodeURIComponent(JSON.stringify(selectedData))}`
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('评分保存成功:', data);

      // 显示推荐进度弹窗
      showRecommendProgress();

    } else {
      alert('评分保存失败: ' + (data.error || '未知错误'));
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-magic"></i> 完成评分，获取推荐';
    }
  })
  .catch(error => {
    console.error('提交失败:', error);
    alert('提交失败，请重试');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-magic"></i> 完成评分，获取推荐';
  });
}

// 显示推荐进度弹窗
function showRecommendProgress() {
  // 创建弹窗
  const modal = document.createElement('div');
  modal.id = 'progressModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 24px;
      padding: 50px 60px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    ">
      <div style="
        width: 120px;
        height: 120px;
        margin: 0 auto 30px;
        border-radius: 50%;
        background: linear-gradient(135deg, #007aff, #af52de);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <i class="fas fa-magic" style="font-size: 3.5rem; color: white;"></i>
      </div>

      <h2 style="
        font-size: 2rem;
        font-weight: 800;
        color: #1d1d1f;
        margin-bottom: 16px;
        letter-spacing: -1px;
      ">生成个性化推荐中</h2>

      <p id="progressMessage" style="
        font-size: 1.1rem;
        color: #6e6e73;
        margin-bottom: 30px;
      ">正在分析你的观影偏好...</p>

      <div style="
        width: 100%;
        height: 8px;
        background: #e8e8ed;
        border-radius: 10px;
        overflow: hidden;
        margin-bottom: 20px;
      ">
        <div id="progressBar" style="
          width: 0%;
          height: 100%;
          background: linear-gradient(90deg, #007aff, #af52de);
          transition: width 0.5s ease;
        "></div>
      </div>

      <p id="progressPercent" style="
        font-size: 2rem;
        font-weight: 700;
        color: #007aff;
      ">0%</p>
    </div>
  `;

  document.body.appendChild(modal);

  // 触发推荐生成
  fetch('/api/recommend/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userid: window.userid })
  })
  .then(response => response.json())
  .then(data => {
    console.log('推荐任务已启动:', data);
    // 开始轮询进度
    pollProgress();
  })
  .catch(error => {
    console.error('启动推荐失败:', error);
    alert('启动推荐失败，请刷新页面重试');
  });
}

// 轮询推荐进度
function pollProgress() {
  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');
  const progressMessage = document.getElementById('progressMessage');

  // 初始状态
  progressBar.style.width = '10%';
  progressPercent.textContent = '10%';

  // 定期检查实际进度
  const checkInterval = setInterval(() => {
    fetch(`/api/recommend/progress/${window.userid}`)
      .then(response => response.json())
      .then(data => {
        console.log('推荐进度:', data);

        // 更新进度条
        if (data.progress !== undefined) {
          // 平滑过渡到新进度
          const currentProgress = parseInt(progressBar.style.width) || 10;
          const targetProgress = Math.max(currentProgress, data.progress);
          progressBar.style.width = targetProgress + '%';
          progressPercent.textContent = targetProgress + '%';
        }

        // 更新进度消息
        if (data.step) {
          progressMessage.textContent = data.step;
        } else if (data.message) {
          progressMessage.textContent = data.message;
        }

        // 检查是否完成
        if (data.status === 'completed') {
          clearInterval(checkInterval);

          // 完成动画
          progressBar.style.width = '100%';
          progressPercent.textContent = '100%';
          progressMessage.textContent = `太棒了！已为你推荐 ${data.count || 10} 部电影`;

          // 延迟跳转
          setTimeout(() => {
            window.location.href = '/recommendmovieforuser';
          }, 1500);
        }
      })
      .catch(error => {
        console.error('查询进度失败:', error);
      });
  }, 2000); // 每2秒查询一次
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
