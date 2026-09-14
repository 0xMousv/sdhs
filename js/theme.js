// js/theme.js

const themeToggleBtn = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('theme');

// تطبيق المظهر المحفوظ عند تحميل الصفحة
if (currentTheme) {
    document.documentElement.setAttribute('data-theme', currentTheme);
}

// تبديل المظهر عند الضغط على الزر
themeToggleBtn.addEventListener('click', () => {
    let theme = document.documentElement.getAttribute('data-theme');
    
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
});