// Matches Studio's existing tab recovery and legacy boolean preference.
(() => {
  let dark = false;
  try {
    dark = JSON.parse(localStorage.getItem('ocharo-studio.theme') ?? 'false') === true;
    if (location.pathname.startsWith('/studio')) {
      const tab = sessionStorage.getItem('ocharo-studio:tab');
      const suffix = tab ? ':' + tab : '';
      const recovery = JSON.parse(localStorage.getItem('ocharo-studio:studio:recovery' + suffix) ?? 'null');
      const settings = recovery?.schemaVersion === 1 && typeof recovery.settings?.dark === 'boolean'
        ? recovery.settings : JSON.parse(localStorage.getItem('ocharo-studio:settings' + suffix) ?? localStorage.getItem('ocharo-studio:settings') ?? '{}');
      if (typeof settings.dark === 'boolean') dark = settings.dark;
    }
  } catch { /* Optional browser storage keeps the default light theme. */ }
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
})();
