// js/animations.js

document.addEventListener("DOMContentLoaded", () => {
    // إضافة كلاسات الحركة للعناصر الرئيسية
    const heroBadge = document.querySelector('.hero-badge');
    const heroTitle = document.querySelector('.hero-title');
    const heroDesc = document.querySelector('.hero-desc');
    const heroButtons = document.querySelector('.hero-buttons');
    const sectionHeader = document.querySelector('.section-header');
    const cards = document.querySelectorAll('.teacher-card');

    if (heroBadge) heroBadge.classList.add('fade-in-up', 'delay-1');
    if (heroTitle) heroTitle.classList.add('fade-in-up', 'delay-2');
    if (heroDesc) heroDesc.classList.add('fade-in-up', 'delay-3');
    if (heroButtons) heroButtons.classList.add('fade-in-up', 'delay-3');
    if (sectionHeader) sectionHeader.classList.add('fade-in-up');

    // حركة متتالية لبطاقات المدرسين
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.05}s`;
        card.classList.add('fade-in-up');
    });
});