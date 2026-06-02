// auth.js
// Lógica de Autenticación Simulada (Mock RBAC)

const MOCK_USERS = {
    'prueba@geovisualizador.com': { password: '1234', role: 'admin' }
};

document.addEventListener('DOMContentLoaded', () => {
    checkAuthUI();
});

function openLoginModal() {
    document.getElementById('login-modal').style.display = 'flex';
}

function closeLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('login-error').style.display = 'none';
}

function handleLogin(e) {
    if (e) e.preventDefault();
    const emailInput = document.getElementById('login-email');
    if (!emailInput) return;
    const email = emailInput.value.trim().toLowerCase();
    const pass = document.getElementById('login-password').value.trim();
    const errorDiv = document.getElementById('login-error');

    if (MOCK_USERS[email] && MOCK_USERS[email].password === pass) {
        // Exito
        sessionStorage.setItem('geodash_role', MOCK_USERS[email].role);
        sessionStorage.setItem('geodash_user', email);
        closeLoginModal();
        checkAuthUI();
    } else {
        errorDiv.style.display = 'block';
        errorDiv.innerText = "Credenciales incorrectas.";
    }
}

function handleLogout() {
    sessionStorage.removeItem('geodash_role');
    sessionStorage.removeItem('geodash_user');
    checkAuthUI();
}

function checkAuthUI() {
    const role = sessionStorage.getItem('geodash_role');
    const loginBtn = document.getElementById('top-login-btn');

    if (role === 'client' || role === 'admin') {
        // Autenticado
        if (loginBtn) {
            loginBtn.innerText = 'Cerrar Sesión';
            loginBtn.onclick = handleLogout;
        }

        // Mostrar elementos bloqueados
        document.querySelectorAll('.auth-hidden').forEach(el => {
            el.style.display = 'flex'; // o 'block' dependiendo del elemento
        });

    } else {
        // Público (No autenticado)
        if (loginBtn) {
            loginBtn.innerText = 'Iniciar Sesión';
            loginBtn.onclick = openLoginModal;
        }

        // Ocultar elementos bloqueados
        document.querySelectorAll('.auth-hidden').forEach(el => {
            el.style.display = 'none';
        });
    }
}
