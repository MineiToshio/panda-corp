import { SIDEBAR_STORAGE_KEY, SYSTEM_LIGHT_QUERY, THEME_STORAGE_KEY } from "./theme";

/**
 * Blocking `<head>` script source (IF-13-theme): sets `data-theme` from the stored choice or the
 * system preference, and mirrors the stored sidebar preference onto `data-sidebar-pref`, before
 * first paint. Mirrors `resolveTheme`; a storage failure falls back to the system preference.
 */
export const THEME_BOOT_SCRIPT = `(function(){var d=document.documentElement,s=null,p=null;try{s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});p=localStorage.getItem(${JSON.stringify(SIDEBAR_STORAGE_KEY)})}catch(e){}var l=false;try{l=matchMedia(${JSON.stringify(SYSTEM_LIGHT_QUERY)}).matches}catch(e){}d.setAttribute("data-theme",s==="light"||s==="dark"?s:l?"light":"dark");if(p==="collapsed"||p==="expanded")d.setAttribute("data-sidebar-pref",p)})();`;
