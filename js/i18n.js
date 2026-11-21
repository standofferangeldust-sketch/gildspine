/* ==========================================================================
   GILDSPINE — Stay Gold
   js/i18n.js  ·  Переключение языка RU / EN без перезагрузки страницы

   ПОДКЛЮЧЕНИЕ (в <head>, с defer — так перевод применяется до первой отрисовки):
     <script src="js/i18n.js" defer></script>

   АТРИБУТЫ РАЗМЕТКИ
     data-i18n="nav.home"                   → подставляет перевод в textContent
     data-i18n-html="home.intro"            → подставляет перевод как HTML
                                              (только для доверенных строк из словаря!)
     data-i18n-attr="placeholder:form.name; aria-label:nav.main"
                                            → переводит атрибуты (пары «атрибут:ключ» через «;»)
     data-set-lang="ru" | "en"              → кнопка выбора языка
     data-year                              → подставляет текущий год

   ПУБЛИЧНЫЙ API (для остальных страниц проекта)
     GildspineI18n.getLang()                → 'ru' | 'en'
     GildspineI18n.setLang('en')            → переключить язык
     GildspineI18n.t('nav.home')            → получить строку на текущем языке
     GildspineI18n.extend({ ru: {...}, en: {...} })
                                            → добавить переводы страницы (напр. music.*)
     Событие 'gildspine:languagechange' на document, detail: { lang }
   ========================================================================== */

(function () {
  'use strict';

  var STORAGE_KEY = 'gildspine-lang';
  var DEFAULT_LANG = 'ru';
  var SUPPORTED = ['ru', 'en'];

  /* ------------------------------------------------------------------------
     СЛОВАРИ
     ------------------------------------------------------------------------ */
  var translations = {
    ru: {
      /* Доступность */
      'a11y.skip': 'Перейти к содержимому',
      'nav.toggle': 'Открыть или закрыть меню',
      'nav.main': 'Основная навигация',
      'lang.label': 'Выбор языка',

      /* Навигация */
      'nav.home': 'Главная',
      'nav.music': 'Музыка',
      'nav.book': 'Книга',
      'nav.universe': 'Вселенная',
      'nav.media': 'Медиа',
      'nav.support': 'Поддержать',
      'nav.about': 'О проекте',
      'nav.contact': 'Связаться',

      /* Подвал */
      'footer.slogan': 'Stay Gold',
      'footer.description': 'Тёмное фэнтези в музыке и литературе. Золото не тускнеет — даже во тьме.',
      'footer.navTitle': 'Навигация',
      'footer.followTitle': 'Следите за нами',
      'footer.rights': 'Все права защищены.',
      'footer.backToTop': 'Наверх'
    },

    en: {
      /* Accessibility */
      'a11y.skip': 'Skip to content',
      'nav.toggle': 'Open or close the menu',
      'nav.main': 'Main navigation',
      'lang.label': 'Language',

      /* Navigation */
      'nav.home': 'Home',
      'nav.music': 'Music',
      'nav.book': 'Book',
      'nav.universe': 'Universe',
      'nav.media': 'Media',
      'nav.support': 'Support',
      'nav.about': 'About',
      'nav.contact': 'Contact',

      /* Footer */
      'footer.slogan': 'Stay Gold',
      'footer.description': 'Dark fantasy in music and literature. Gold does not fade — not even in the dark.',
      'footer.navTitle': 'Navigation',
      'footer.followTitle': 'Follow us',
      'footer.rights': 'All rights reserved.',
      'footer.backToTop': 'Back to top'
    }
  };

  /* ------------------------------------------------------------------------
     ВНУТРЕННЕЕ СОСТОЯНИЕ И ХЕЛПЕРЫ
     ------------------------------------------------------------------------ */
  var currentLang = DEFAULT_LANG;

  function isSupported(lang) {
    return SUPPORTED.indexOf(lang) !== -1;
  }

  function readStoredLang() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      return isSupported(stored) ? stored : null;
    } catch (e) {
      return null; // localStorage недоступен (приватный режим и т.п.)
    }
  }

  function storeLang(lang) {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* без сохранения — переключение всё равно работает на текущей странице */
    }
  }

  function detectBrowserLang() {
    var list = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || DEFAULT_LANG];
    var first = String(list[0] || '').toLowerCase();
    // Русскоязычные браузеры → RU, остальные → EN
    return /^(ru|be|uk|kk)/.test(first) ? 'ru' : 'en';
  }

  function initialLang() {
    return readStoredLang() || detectBrowserLang();
  }

  /** Возвращает строку по ключу. Если на нужном языке её нет — берёт язык по умолчанию. */
  function t(key, lang) {
    var l = lang || currentLang;
    var dict = translations[l];
    if (dict && Object.prototype.hasOwnProperty.call(dict, key)) {
      return dict[key];
    }
    var fallback = translations[DEFAULT_LANG];
    if (fallback && Object.prototype.hasOwnProperty.call(fallback, key)) {
      return fallback[key];
    }
    return undefined;
  }

  function warnMissing(key) {
    if (window.console && console.warn) {
      console.warn('[i18n] Нет перевода для ключа: "' + key + '"');
    }
  }

  /* ------------------------------------------------------------------------
     ПРИМЕНЕНИЕ ПЕРЕВОДОВ К DOM
     ------------------------------------------------------------------------ */
  function applyAttrTranslations(el) {
    var rules = el.getAttribute('data-i18n-attr');
    if (!rules) return;

    rules.split(';').forEach(function (rule) {
      var idx = rule.indexOf(':');
      if (idx === -1) return;
      var attr = rule.slice(0, idx).trim();
      var key = rule.slice(idx + 1).trim();
      if (!attr || !key) return;

      var value = t(key);
      if (value === undefined) {
        warnMissing(key);
        return;
      }
      el.setAttribute(attr, value);
    });
  }

  function apply(root) {
    var scope = root || document;

    // Текст
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var value = t(key);
      if (value === undefined) {
        warnMissing(key);
        return;
      }
      el.textContent = value;
    });

    // HTML (только из собственного словаря)
    scope.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      var value = t(key);
      if (value === undefined) {
        warnMissing(key);
        return;
      }
      el.innerHTML = value;
    });

    // Атрибуты
    scope.querySelectorAll('[data-i18n-attr]').forEach(applyAttrTranslations);

    // Текущий год
    var year = String(new Date().getFullYear());
    scope.querySelectorAll('[data-year]').forEach(function (el) {
      el.textContent = year;
    });

    updateDocumentState();
  }

  function updateDocumentState() {
    document.documentElement.setAttribute('lang', currentLang);

    document.querySelectorAll('[data-set-lang]').forEach(function (btn) {
      var active = btn.getAttribute('data-set-lang') === currentLang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  /* ------------------------------------------------------------------------
     ПУБЛИЧНЫЕ ДЕЙСТВИЯ
     ------------------------------------------------------------------------ */
  function setLang(lang, options) {
    if (!isSupported(lang)) return currentLang;

    var persist = !options || options.persist !== false;
    var changed = lang !== currentLang;

    currentLang = lang;
    if (persist) storeLang(lang);
    apply(document);

    if (changed) {
      document.dispatchEvent(
        new CustomEvent('gildspine:languagechange', { detail: { lang: lang } })
      );
    }
    return currentLang;
  }

  /** Добавляет переводы страницы к общему словарю: extend({ ru: {...}, en: {...} }) */
  function extend(extra) {
    if (!extra || typeof extra !== 'object') return;

    SUPPORTED.forEach(function (lang) {
      if (extra[lang] && typeof extra[lang] === 'object') {
        translations[lang] = Object.assign(translations[lang] || {}, extra[lang]);
      }
    });

    if (document.readyState !== 'loading') {
      apply(document);
    }
  }

  /* ------------------------------------------------------------------------
     ИНИЦИАЛИЗАЦИЯ
     ------------------------------------------------------------------------ */
  function init() {
    currentLang = initialLang();
    apply(document);

    // Клики по кнопкам RU / EN (делегирование — работает и для динамического DOM)
    document.addEventListener('click', function (event) {
      var btn = event.target.closest && event.target.closest('[data-set-lang]');
      if (!btn) return;
      event.preventDefault();
      setLang(btn.getAttribute('data-set-lang'));
    });

    // Синхронизация языка между открытыми вкладками сайта
    window.addEventListener('storage', function (event) {
      if (event.key === STORAGE_KEY && isSupported(event.newValue) && event.newValue !== currentLang) {
        setLang(event.newValue, { persist: false });
      }
    });
  }

  // Язык выставляется сразу — до загрузки DOM, чтобы <html lang> был верным как можно раньше
  currentLang = initialLang();
  document.documentElement.setAttribute('lang', currentLang);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.GildspineI18n = {
    t: t,
    getLang: function () { return currentLang; },
    setLang: setLang,
    extend: extend,
    supported: SUPPORTED.slice()
  };
})();
