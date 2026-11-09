/**
 * The `localStorage` key Studio's colour mode lives under: the SDK `ColorModeProvider` persists `light`, `dark` or
 * `system` there, and the pre-paint `/theme.js` the build generates reads it before the first frame. Earlier builds
 * stored a JSON boolean under the same key; the prelude below turns that choice into a mode.
 */
export const ThemeStorageKey = "ocharo-studio.theme";

/**
 * The pre-paint prelude that runs before the SDK colour-mode script, as classic script source. It reads only local
 * browser storage and fails silently, leaving the page to the provider:
 *
 * - a legacy `true` / `false` under the key becomes `dark` / `light`;
 * - with no stored mode, the `settings.dark` this tab's recovery copy holds (else the untabbed settings earlier builds
 *   wrote) seeds the mode once, so a designer who chose dark keeps it on the first paint after the update.
 */
export const ThemeMigrationScript =
  "(function(){try{" +
  `var k=${JSON.stringify(ThemeStorageKey)},s=localStorage.getItem(k);` +
  "if(s==='true'||s==='false'){localStorage.setItem(k,s==='true'?'dark':'light');return;}" +
  "if(s==='light'||s==='dark'||s==='system')return;" +
  "var t=sessionStorage.getItem('ocharo-studio:tab'),x=t?':'+t:'',d;" +
  "var r=JSON.parse(localStorage.getItem('ocharo-studio:studio:recovery'+x)||'null');" +
  "if(r&&r.schemaVersion===1&&r.settings&&typeof r.settings.dark==='boolean')d=r.settings.dark;" +
  "else{var o=JSON.parse(localStorage.getItem('ocharo-studio:settings'+x)||localStorage.getItem('ocharo-studio:settings')||'{}');" +
  "if(o&&typeof o.dark==='boolean')d=o.dark;}" +
  "if(typeof d==='boolean')localStorage.setItem(k,d?'dark':'light');" +
  "}catch(e){}})();";
