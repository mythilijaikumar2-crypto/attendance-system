// Toggle password view
function togglePasswordView() {
    const pwdInput = document.getElementById('passwordInput');
    const icon = document.getElementById('togglePasswordIcon');
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        pwdInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}
/* ==========================================================
   login-script.js
   Handles Employee + Admin login using backend API
   Works with updated index.html
========================================================== */

const API_BASE = "http://localhost:4000";   // Backend URL


/* ==========================================================
   LOGIN HANDLER
========================================================== */


// Attach event listener for unified login form
window.onload = function () {
    const form = document.getElementById('unifiedLoginForm');
    if (form) {
        form.addEventListener('submit', loginHandlerUnified);
    }
};

async function loginHandlerUnified(event) {
    event.preventDefault();
    const form = event.target;
    const empId = form.username.value.trim();
    const password = form.password.value.trim();
    if (!empId || !password) {
        alert("Please enter credentials");
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ empId, password })
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.message || "Invalid credentials");
            return;
        }
        // Save token + user info
        localStorage.setItem("nxt_token", data.token);
        localStorage.setItem("nxt_user", JSON.stringify(data.user));
        // Redirect based on role
        if (data.user.role === "admin") {
            window.location.href = "admin.html";
        } else if (data.user.role === "employee") {
            window.location.href = "employee.html";
        } else {
            alert("Unknown user role. Contact admin.");
        }
    } catch (error) {
        console.error("Login Error:", error);
        alert("Server not reachable");
    }
}

// Remove auto-redirect if already logged in
// (User must always see login page at root, even if already logged in)
// (function () {
//     const user = localStorage.getItem("nxt_user");
//     if (!user) return;
//
//     const u = JSON.parse(user);
//
//     if (u.role === "admin") {
//         window.location.href = "admin.html";
//     } else {
//         window.location.href = "employee.html";
//     }
// ...existing code...
// })();


/* ================= MOUSE GLOW EFFECT ================= */
(function initMouseGlow() {
    // Create glow element
    const glow = document.createElement('div');
    glow.classList.add('mouse-glow');
    document.body.appendChild(glow);

    // Track mouse
    let mouseX = 0, mouseY = 0;
    let currentX = 0, currentY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // Smooth follow
    function animate() {
        // Linear interpolation for smoothness
        currentX += (mouseX - currentX) * 0.1;
        currentY += (mouseY - currentY) * 0.1;

        glow.style.transform = `translate(${currentX}px, ${currentY}px) translate(-50%, -50%)`;
        requestAnimationFrame(animate);
    }
    animate();
})();