const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
window.API_URL = isLocal ? 'http://localhost:3000' : 'https://physics-cyber-lab-api.onrender.com';