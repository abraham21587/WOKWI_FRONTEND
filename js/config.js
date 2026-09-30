const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
// Cambia la URL de producción por la de tu backend en Render cuando lo despliegues:
window.API_URL = isLocal ? 'http://localhost:3000' : 'https://TU-BACKEND.onrender.com';