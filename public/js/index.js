// 全局状态管理（已有，无需改）
const state = {
    isLogin: false,  // 默认未登录
    userId: '',
    userName: '',
    ratedMovies: [],
    currentRating: 0,
    currentSlideIndex: 0,
    carouselInterval: null
};

// 初始化应用（关键：接收后端传递的状态）
function initApp() {
    // 核心代码：从window.appState接收后端传递的信息（已有则无需改）
    if (window.appState) {
        state.isLogin = window.appState.isLogin;  // 接收已登录状态
        state.userId = window.appState.userId;    // 接收用户ID
        state.userName = window.appState.userName;// 接收用户名
        state.ratedMovies = window.appState.ratedMovies || [];
    }

    bindEvents();
    updateUIByLoginState();  // 自动更新UI为已登录状态
    initCarousel();
    if (state.isLogin && state.ratedMovies.length > 0) {
        generateRecommendations();
    }
}

// DOM元素缓存
const elements = {
    // 轮播相关（确保选择器正确）
    carouselTrack: document.querySelector('.carousel-track'),
    carouselItems: document.querySelectorAll('.carousel-item'),
    introContents: document.querySelectorAll('.intro-content'),
    prevBtn: document.querySelector('.carousel-control.prev'),
    nextBtn: document.querySelector('.carousel-control.next'),
    indicators: document.querySelectorAll('.carousel-indicators span'),

    // 评分相关
    rateButtons: document.querySelectorAll('.rate-btn'),
    modal: document.getElementById('rate-modal'),
    modalClose: document.querySelector('.modal-close'),
    cancelBtn: document.querySelector('.btn-cancel'),
    submitBtn: document.querySelector('.btn-submit'),
    stars: document.querySelectorAll('.stars i'),
    modalTitle: document.getElementById('modal-title'),
    modalGenre: document.getElementById('modal-genre'),
    modalImg: document.querySelector('.movie-poster img'),
    recommendGrid: document.getElementById('recommend-grid'),
    loginTip: document.querySelector('.login-tip'),
    loginButtons: document.querySelectorAll('.btn-login, .btn-login-small'),
    signupButton: document.querySelector('.btn-signup')
};

// 初始化应用
function initApp() {
    // 接收后端传递的状态
    if (window.appState) {
        state.isLogin = window.appState.isLogin;
        state.userId = window.appState.userId;
        state.userName = window.appState.userName;
        state.ratedMovies = window.appState.ratedMovies;
    }

    bindEvents();
    updateUIByLoginState();
    initCarousel(); // 初始化轮播（修复自动播放）
    if (state.isLogin && state.ratedMovies.length > 0) {
        generateRecommendations();
    }
}

// 事件绑定（确保轮播事件正确绑定）
function bindEvents() {
    // 轮播事件（修复：确保按钮存在再绑定）
    if (elements.prevBtn && elements.nextBtn) {
        elements.prevBtn.addEventListener('click', () => {
            clearInterval(state.carouselInterval); // 点击时暂停自动播放
        changeSlide(-1);
        startCarouselInterval(); // 暂停后重启自动播放
    });
        elements.nextBtn.addEventListener('click', () => {
            clearInterval(state.carouselInterval);
        changeSlide(1);
        startCarouselInterval();
    });
    }

    // 指示器事件
    elements.indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
        clearInterval(state.carouselInterval);
    goToSlide(index);
    startCarouselInterval();
});
});

    // 评分按钮点击
    elements.rateButtons.forEach(btn => {
        btn.addEventListener('click', handleRateClick);
});

    // 弹窗控制
    elements.modalClose.addEventListener('click', closeModal);
    elements.cancelBtn.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', e => {
        if (e.target === elements.modal) closeModal();
});

    // 星星评分交互
    elements.stars.forEach((star, index) => {
        star.addEventListener('mouseover', () => highlightStars(index + 1));
    star.addEventListener('mouseout', () => highlightStars(state.currentRating));
    star.addEventListener('click', () => setRating(index + 1));
});

    // 提交评分
    elements.submitBtn.addEventListener('click', submitRating);

    // 登录/注册按钮
    elements.loginButtons.forEach(btn => {
        btn.addEventListener('click', handleLogin);
});

    if (elements.signupButton) {
        elements.signupButton.addEventListener('click', handleSignup);
    }
}

// 初始化轮播（修复自动播放核心逻辑）
function initCarousel() {
    // 初始化第一帧激活状态
    goToSlide(0);
    // 启动自动轮播
    startCarouselInterval();
}

// 启动轮播定时器
function startCarouselInterval() {
    // 清除已有定时器，避免重复
    if (state.carouselInterval) clearInterval(state.carouselInterval);
    // 5秒切换一次
    state.carouselInterval = setInterval(() => changeSlide(1), 5000);
}

// 切换轮播（修复索引计算）
function changeSlide(direction) {
    const totalSlides = elements.carouselItems.length;
    state.currentSlideIndex = (state.currentSlideIndex + direction + totalSlides) % totalSlides;
    updateCarouselState();
}

// 跳转到指定轮播（修复激活状态）
function goToSlide(index) {
    state.currentSlideIndex = index;
    updateCarouselState();
}

// 更新轮播状态（修复海报和介绍同步）
function updateCarouselState() {
    const totalSlides = elements.carouselItems.length;
    if (totalSlides === 0) return;

    // 移动轨道（修复平移计算）
    elements.carouselTrack.style.transform = `translateX(-${state.currentSlideIndex * 100}%)`;

    // 更新指示器激活状态
    elements.indicators.forEach((indicator, index) => {
        if (index === state.currentSlideIndex) {
        indicator.classList.add('active');
    } else {
        indicator.classList.remove('active');
    }
});

    // 更新电影介绍激活状态（修复同步显示）
    elements.introContents.forEach((content, index) => {
        if (index === state.currentSlideIndex) {
        content.classList.add('active');
    } else {
        content.classList.remove('active');
    }
});
}

// 处理评分按钮点击
function handleRateClick(e) {
    e.stopPropagation();

    if (!state.isLogin) {
        alert('请先登录');
        return;
    }

    // 获取电影信息
    const card = this.closest('.movie-card');
    const title = card.querySelector('h3').textContent;
    const genre = card.querySelector('.meta span:first-child').textContent;
    const img = card.querySelector('.card-top img').src;

    // 填充弹窗
    elements.modalTitle.textContent = title;
    elements.modalGenre.textContent = genre;
    elements.modalImg.src = img;

    // 重置评分状态
    state.currentRating = 0;
    highlightStars(0);

    // 显示弹窗
    elements.modal.classList.add('show');
}

// 高亮星星
function highlightStars(count) {
    elements.stars.forEach((star, index) => {
        if (index < count) {
        star.style.color = '#fff';
        star.style.transform = 'scale(1.1)';
    } else {
        star.style.color = '#444';
        star.style.transform = 'scale(1)';
    }
});
}

// 设置评分
function setRating(count) {
    state.currentRating = count;
    highlightStars(count);
}

// 提交评分
function submitRating() {
    if (state.currentRating === 0) {
        alert('请选择评分');
        return;
    }

    // 保存评分
    const newRating = {
        title: elements.modalTitle.textContent,
        rating: state.currentRating,
        img: elements.modalImg.src,
        genre: elements.modalGenre.textContent
    };
    state.ratedMovies.push(newRating);

    // 关闭弹窗并提示
    closeModal();
    alert(`已为《${elements.modalTitle.textContent}》打${state.currentRating}星`);

    // 更新推荐
    generateRecommendations();
}

// 关闭弹窗
function closeModal() {
    elements.modal.classList.remove('show');
}

// 处理登录
function handleLogin() {
    window.location.href = '/loginpage';
}

// 处理注册
function handleSignup() {
    window.location.href = '/registerpage';
}

// 根据登录状态更新UI
function updateUIByLoginState() {
    if (state.isLogin) {
        if (elements.loginTip) elements.loginTip.style.display = 'none';
        if (state.ratedMovies.length > 0) {
            generateRecommendations();
        } else {
            elements.recommendGrid.innerHTML = `
                <div class="empty-state">
                  <i class="fas fa-star"></i>
                  <p>去电影库评分，获取专属推荐</p>
                </div>
            `;
        }
    } else {
        if (elements.loginTip) elements.loginTip.style.display = 'flex';
        elements.recommendGrid.innerHTML = `
            <div class="empty-state">
              <i class="fas fa-film"></i>
              <p>登录后显示个性化推荐</p>
            </div>
        `;
    }
}

// 生成推荐
function generateRecommendations() {
    // 模拟推荐逻辑：根据评分生成相似推荐
    const recommendations = [
        {
            title: '肖申克的救赎',
            genre: '剧情',
            rating: 9.7,
            img: '/images/1.jpg'
        },
        {
            title: '霸王别姬',
            genre: '剧情/爱情',
            rating: 9.6,
            img: '/images/1.jpg'
        },
        {
            title: '这个杀手不太冷',
            genre: '动作/犯罪',
            rating: 9.4,
            img: '/images/1.jpg'
        },
        {
            title: '泰坦尼克号',
            genre: '爱情/灾难',
            rating: 9.5,
            img: '/images/1.jpg'
        }
    ];

    // 渲染推荐
    renderRecommendations(recommendations);
}

// 渲染推荐列表
function renderRecommendations(movies) {
    let html = '';
    movies.forEach(movie => {
        html += `
            <div class="movie-card">
                <div class="card-top">
                    <img src="${movie.img}" alt="${movie.title}">
                    <div class="rate-btn">
                        <i class="fas fa-star"></i>
                    </div>
                </div>
                <div class="card-bottom">
                    <h3>${movie.title}</h3>
                    <div class="meta">
                        <span>${movie.genre}</span>
                        <span>${movie.rating}</span>
                    </div>
                </div>
            </div>
        `;
});

    elements.recommendGrid.innerHTML = html;

    // 重新绑定新生成的评分按钮
    const newRateBtns = document.querySelectorAll('.rate-btn');
    newRateBtns.forEach(btn => {
        btn.addEventListener('click', handleRateClick);
});
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp);

// 页面卸载时清除定时器（避免内存泄漏）
window.addEventListener('beforeunload', () => {
    if (state.carouselInterval) clearInterval(state.carouselInterval);
});