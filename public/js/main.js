/* ============================================================
   CareerIS — main.js
   Global JavaScript for all pages
   ============================================================ */

// ── Navbar: add 'scrolled' class on scroll ────────────────
window.addEventListener('scroll', () => {
    const nav = document.getElementById('mainNav');
    if (nav) {
        nav.classList.toggle('scrolled', window.scrollY > 50);
    }
});

// ── Scroll animations ─────────────────────────────────────
const observerOptions = {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
            // Stagger delay based on sibling index
            const siblings = entry.target.parentElement.querySelectorAll('[data-animate]');
            let delay = 0;
            siblings.forEach((el, idx) => { if (el === entry.target) delay = idx * 100; });
            setTimeout(() => { entry.target.classList.add('animated'); }, delay);
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));

// ── Animated stat counters ────────────────────────────────
function animateCount(el, target, duration = 1800) {
    let start = 0;
    const step = target / (duration / 16);
    const suffix = target >= 1000 ? '+' : (target === 3 ? '' : '+');

    const timer = setInterval(() => {
        start += step;
        if (start >= target) {
            el.textContent = target.toLocaleString() + suffix;
            clearInterval(timer);
        } else {
            el.textContent = Math.floor(start).toLocaleString() + (start > target * 0.5 ? suffix : '');
        }
    }, 16);
}

const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el     = entry.target;
            const target = parseInt(el.getAttribute('data-count'));
            animateCount(el, target);
            counterObserver.unobserve(el);
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('[data-count]').forEach(el => counterObserver.observe(el));

// ── Hero mini-counts ──────────────────────────────────────
function animateHeroCount(id, target, delay) {
    const el = document.getElementById(id);
    if (!el) return;
    setTimeout(() => animateCount(el, target, 1500), delay);
}

window.addEventListener('load', () => {
    animateHeroCount('heroCount1', 1200, 500);
    animateHeroCount('heroCount2', 580, 700);
    animateHeroCount('heroCount3', 240, 900);
});

// ── Active nav link based on current page ────────────────
document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.includes(page) && page !== '') {
            link.classList.add('active');
        } else if (page === '' || page === 'index.html') {
            if (href === 'index.html') link.classList.add('active');
        }
    });

    // Update Login/Logout in navbar based on auth state
    updateNavAuth();
});

// ── Navbar auth state ─────────────────────────────────────
function updateNavAuth() {
    const user = JSON.parse(localStorage.getItem('careeris_user') || '{}');
    const loginLink = document.querySelector('a[href="login.html"]');
    if (loginLink && user.name) {
        loginLink.textContent = user.name.split(' ')[0];
        loginLink.href = '#';
    }
}

// ── Logout helper (can be called from dashboards) ─────────
function logout() {
    localStorage.removeItem('careeris_token');
    localStorage.removeItem('careeris_user');
    window.location.href = '/index.html';
}

// ── Smooth scroll for anchor links ───────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});
