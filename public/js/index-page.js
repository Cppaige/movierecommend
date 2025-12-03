// ================================
// 首页专属JavaScript
// ================================

document.addEventListener('DOMContentLoaded', function() {
  initCarousel();
  initMovieIntro();
});

// ================================
// 轮播图功能
// ================================

let currentSlide = 0;
let carouselInterval;

function initCarousel() {
  const track = document.querySelector('.carousel-track');
  const items = document.querySelectorAll('.carousel-item');
  const indicators = document.querySelectorAll('.indicator');
  const prevBtn = document.querySelector('.carousel-control.prev');
  const nextBtn = document.querySelector('.carousel-control.next');

  if (!track || items.length === 0) return;

  const totalSlides = items.length;

  // 设置初始状态
  updateCarousel(0);

  // 上一张
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
      updateCarousel(currentSlide);
      resetAutoPlay();
    });
  }

  // 下一张
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentSlide = (currentSlide + 1) % totalSlides;
      updateCarousel(currentSlide);
      resetAutoPlay();
    });
  }

  // 指示器点击
  indicators.forEach((indicator, index) => {
    indicator.addEventListener('click', () => {
      currentSlide = index;
      updateCarousel(currentSlide);
      resetAutoPlay();
    });
  });

  // 自动播放
  startAutoPlay();

  // 鼠标悬停时暂停
  const carousel = document.querySelector('.carousel');
  if (carousel) {
    carousel.addEventListener('mouseenter', stopAutoPlay);
    carousel.addEventListener('mouseleave', startAutoPlay);
  }
}

function updateCarousel(index) {
  const track = document.querySelector('.carousel-track');
  const indicators = document.querySelectorAll('.indicator');

  if (!track) return;

  // 移动轨道
  track.style.transform = `translateX(-${index * 100}%)`;

  // 更新指示器
  indicators.forEach((indicator, i) => {
    if (i === index) {
      indicator.classList.add('active');
    } else {
      indicator.classList.remove('active');
    }
  });

  // 触发电影介绍切换
  updateMovieIntro(index);
}

function startAutoPlay() {
  stopAutoPlay(); // 先清除可能存在的定时器
  carouselInterval = setInterval(() => {
    const items = document.querySelectorAll('.carousel-item');
    currentSlide = (currentSlide + 1) % items.length;
    updateCarousel(currentSlide);
  }, 5000); // 每5秒切换一次
}

function stopAutoPlay() {
  if (carouselInterval) {
    clearInterval(carouselInterval);
    carouselInterval = null;
  }
}

function resetAutoPlay() {
  stopAutoPlay();
  startAutoPlay();
}

// ================================
// 电影介绍切换动画
// ================================

function initMovieIntro() {
  // 确保第一个介绍是激活状态
  const intros = document.querySelectorAll('.intro-content');
  if (intros.length > 0) {
    intros[0].classList.add('active');
  }
}

function updateMovieIntro(index) {
  const intros = document.querySelectorAll('.intro-content');

  intros.forEach((intro, i) => {
    if (i === index) {
      // 延迟显示，让切换更自然
      setTimeout(() => {
        intro.classList.add('active');
      }, 300);
    } else {
      intro.classList.remove('active');
    }
  });
}

// ================================
// 推荐电影卡片点击
// ================================

// 为电影卡片添加点击跳转
document.addEventListener('click', function(e) {
  const movieCard = e.target.closest('.movie-card');
  if (movieCard && movieCard.dataset.movieId) {
    // 如果点击的不是按钮，则跳转到电影详情页
    if (!e.target.closest('button') && !e.target.closest('.movie-actions')) {
      window.location.href = `/movie/${movieCard.dataset.movieId}`;
    }
  }
});

// ================================
// 平滑滚动
// ================================

// 为所有锚点链接添加平滑滚动
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// ================================
// 滚动动画（可选）
// ================================

// 观察元素进入视口时添加动画
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('fade-in');
      observer.unobserve(entry.target); // 只触发一次
    }
  });
}, observerOptions);

// 为需要动画的元素添加观察
document.addEventListener('DOMContentLoaded', () => {
  const animateElements = document.querySelectorAll('.step, .movie-card, .entry-card');
  animateElements.forEach(el => observer.observe(el));
});
