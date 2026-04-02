// js/theme-lang.js
// Handles Light/Dark Theme toggle and i18n Language switching

document.addEventListener('DOMContentLoaded', () => {
  // Theme logic
  const themeToggleBtn = document.getElementById('theme-toggle');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('uecs_theme') || (prefersDark ? 'dark' : 'light');
  
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = theme === 'light' 
        ? '<span class="material-symbols-outlined">dark_mode</span>' 
        : '<span class="material-symbols-outlined">light_mode</span>';
    }
  }
  
  applyTheme(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      localStorage.setItem('uecs_theme', newTheme);
      applyTheme(newTheme);
    });
  }

  // Language logic
  const langSelect = document.getElementById('lang-select');
  const savedLang = localStorage.getItem('uecs_lang') || 'en';

  if (langSelect) {
    langSelect.value = savedLang;
  }

  function applyLanguage(lang) {
    if (!window.i18nTranslations) return; // Wait for lang.js to load
    const dict = window.i18nTranslations[lang] || window.i18nTranslations['en'];
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });
  }

  // Initial apply (delay slightly to ensure DOM/lang.js is ready)
  setTimeout(() => applyLanguage(savedLang), 100);

  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      const newLang = e.target.value;
      localStorage.setItem('uecs_lang', newLang);
      applyLanguage(newLang);
    });
  }
  
  // Expose global function in case app needs to trigger it dynamically
  window.changeLanguage = applyLanguage;
});
