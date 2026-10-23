// Shared by the root layout (a Server Component) and the theme toggle, so it
// must not live in a 'use client' module.
export const THEME_STORAGE_KEY = 'styleiq_theme';

// Runs in <head> before first paint, so a saved dark theme is applied without
// a light-mode flash.
export const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)})==="dark")document.documentElement.classList.add("dark")}catch(e){}})()`;
