(() => {
  const KEY = 'pcl_token', UKEY = 'pcl_user';

  window.Auth = {
    token: () => localStorage.getItem(KEY),
    user() {
      try { return JSON.parse(localStorage.getItem(UKEY)); } catch { return null; }
    },
    save(d) {
      localStorage.setItem(KEY, d.token);
      localStorage.setItem(UKEY, JSON.stringify(d.user));
    },
    logout() {
      localStorage.removeItem(KEY);
      localStorage.removeItem(UKEY);
      location.href = 'login.html';
    },
    // Úsalo en páginas que exigen sesión
    require() {
      if (!Auth.token()) location.replace('login.html');
    },
    // fetch con el token incluido; lanza Error con el mensaje del servidor
    async api(path, opts = {}) {
      const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
      if (Auth.token()) headers.Authorization = 'Bearer ' + Auth.token();
      const r = await fetch(window.API_URL + path, { ...opts, headers });
      let data = null;
      try { data = await r.json(); } catch { /* sin cuerpo */ }
      const isAuthCall = path.startsWith('/api/auth/login') || path.startsWith('/api/auth/register');
      if (r.status === 401 && !isAuthCall) { Auth.logout(); throw new Error('Sesión expirada'); }
      if (!r.ok) throw new Error((data && data.error) || 'Error ' + r.status);
      return data;
    }
  };
})();