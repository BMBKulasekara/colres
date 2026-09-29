export const THEME_STORAGE_KEY = 'colres-admin-theme';

/**
 * Inline script for <head> that applies the stored theme before first paint,
 * so a dark-mode user never sees a white flash.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.add(d?'dark':'light');r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
