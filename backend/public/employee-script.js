/**
 * employee-script.js
 * - Navigation for employee sidebar
 * - Loads sections: dashboard, profile, leave, reports, quick-actions, settings
 * - Integrates with backend (empId-based auth)
 *
 * NOTE: API_BASE points to your backend. If frontend is served from same origin, set to ''
 */
const API_BASE = "http://localhost:4000"; // change to '' if serving frontend from same origin

function getToken() {
  return localStorage.getItem('nxt_token');
}
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ===== AUTH CHECK ===== */
(function initAuth() {
  const token = getToken();
  if (!token) {
    // Not logged in -> redirect to login page
    window.location = './index.html';
    return;
  }
})();

// --- Global fetch wrapper to handle 401 Unauthorized ---
async function fetchWithAuth(url, options = {}) {
  // Merge Authorization header
  const headers = { ...(options.headers || {}), ...authHeaders() };
  const opts = { ...options, headers };
  try {
    const res = await fetch(url, opts);
    if (res.status === 401) {
      // Token invalid/expired, force logout
      localStorage.removeItem('nxt_token');
      localStorage.removeItem('nxt_user');
      alert('Session expired or unauthorized. Please log in again.');
      window.location = './index.html';
      return Promise.reject(new Error('Unauthorized'));
    }
    return res;
  } catch (err) {
    throw err;
  }
}

/* ===== SIDEBAR NAV HANDLING ===== */
// attach click listeners to sidebar nav links (.nav-item a expected)
document.querySelectorAll('.sidebar .nav-list .nav-item a').forEach(link => {
  link.addEventListener('click', function (e) {
    e.preventDefault();
    const href = this.getAttribute('href') || '#dashboard';
    let sectionId = href.replace('#', '') || 'dashboard';
    // Map 'attendance' nav to 'profile' section
    if (sectionId === 'attendance') sectionId = 'profile';

    // show the selected section
    document.querySelectorAll('.content-section').forEach(function (s) { s.classList.remove('active'); });
    var target = document.getElementById(sectionId);
    if (target) {
      target.classList.add('active');
      // If settings section, ensure options are visible
      if (sectionId === 'settings') {
        var settingsOptions = document.querySelector('.settings-options');
        if (settingsOptions) settingsOptions.style.display = '';
      }
    }

    // update active item
    document.querySelectorAll('.sidebar .nav-list .nav-item').forEach(function (i) { i.classList.remove('active'); });
    this.parentElement.classList.add('active');

    // update breadcrumb .current element if present
    var crumb = document.querySelector('.breadcrumb .current');
    if (crumb) crumb.innerText = this.innerText.trim();

    // lazy-load dynamic content for the section
    loadSectionContent(sectionId);
  });
});

/* Logout link (last sidebar item usually) */

// Attach logout modal only to the actual logout link, not Settings or others
document.addEventListener('DOMContentLoaded', () => {
  // Sidebar Logout link logic
  var sidebarLogoutLink = document.getElementById('sidebarLogoutLink');
  if (sidebarLogoutLink) {
    sidebarLogoutLink.addEventListener('click', function (e) {
      e.preventDefault();
      var modal = document.getElementById('logoutModal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
      }
    });
  }
  // Resignation Request Form Logic (Employee Workflow)
  // Resignation Modal Helper Functions
  const resignationModal = document.getElementById('resignationRequestModal');
  const openResignationBtn = document.getElementById('openResignationModalBtn');
  const closeResignationBtn = document.getElementById('closeResignationModalBtn');
  const resignationForm = document.getElementById('resignationForm');
  const resignationStatus = document.getElementById('resignationStatus');

  function closeResignationModal() {
    if (resignationModal) {
      resignationModal.classList.add('hidden');
      resignationModal.classList.remove('active');
    }
  }

  function openResignationModal() {
    if (resignationModal) {
      // Clear the form and status when opening
      if (resignationForm) resignationForm.reset();
      if (resignationStatus) resignationStatus.innerHTML = '';

      resignationModal.classList.remove('hidden');
      resignationModal.classList.add('active');
      // Load status when opening the modal
      loadResignationStatus();
    }
  }

  if (openResignationBtn) {
    openResignationBtn.addEventListener('click', function (e) {
      e.preventDefault();
      openResignationModal();
    });
  }

  if (closeResignationBtn) {
    closeResignationBtn.onclick = closeResignationModal;
  }

  // Resignation Request Form Logic (Employee Workflow - Kept same IDs)
  if (resignationForm) {
    resignationForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      resignationStatus.innerHTML = '<div class="resign-loader">Submitting...</div>';

      // Disable submit button to prevent double-submission
      const submitBtn = this.querySelector('.submit-btn');
      if (submitBtn) submitBtn.disabled = true;

      const formData = new FormData(resignationForm);
      const user = JSON.parse(localStorage.getItem('nxt_user'));
      if (!user || !user.empId) {
        resignationStatus.innerHTML = '<div class="resign-error">User not logged in.</div>';
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
      formData.append('empId', user.empId);
      try {
        const res = await fetch(`${API_BASE}/api/resignations/submit`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('nxt_token')}` },
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          resignationStatus.innerHTML = '<div class="resign-success">Resignation submitted! Status: Pending. Closing in 3 seconds...</div>';
          loadResignationStatus();

          // Automatically close the modal after a successful submission delay
          setTimeout(closeResignationModal, 3000);

        } else {
          resignationStatus.innerHTML = '<div class="resign-error">' + (data.message || 'Error submitting resignation') + '</div>';
        }
      } catch (err) {
        resignationStatus.innerHTML = '<div class="resign-error">Server error</div>';
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
  async function loadResignationStatus() {
    if (!resignationStatus) return;
    resignationStatus.innerHTML = '<div class="resign-loader">Loading status...</div>';
    try {
      const res = await fetch('/api/resignations/my', {
        headers: { Authorization: `Bearer ${localStorage.getItem('nxt_token')}` }
      });
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) {
        resignationStatus.innerHTML = '<div class="resign-empty">No resignation requests found.</div>';
        return;
      }
      resignationStatus.innerHTML = data.map(r => `
            <div class="resign-history-card ${r.status}">
              <div class="resign-row"><b>Status:</b> <span class="resign-status">${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span></div>
              <div class="resign-row"><b>Submitted:</b> ${new Date(r.submittedAt).toLocaleDateString()}</div>
              <div class="resign-row"><b>Last Day:</b> ${new Date(r.lastWorkingDay).toLocaleDateString()}</div>
              <div class="resign-row"><b>Reason:</b> ${r.reason}</div>
              ${r.attachmentUrl ? `<div class="resign-row"><b>Attachment:</b> <a href="${r.attachmentUrl}" target="_blank">View</a></div>` : ''}
              ${r.feedback ? `<div class="resign-row"><b>HR Feedback:</b> ${r.feedback}</div>` : ''}
            </div>
          `).join('');
    } catch (err) {
      resignationStatus.innerHTML = '<div class="resign-error">Error loading status</div>';
    }
  }
  // Actions section: handle Resignation Request and Logout options

  // Actions section navigation: show Actions section when clicked
  var actionsNavLink = document.querySelector('.sidebar .nav-list .nav-item a[href="#actions"]');
  if (actionsNavLink) {
    actionsNavLink.addEventListener('click', function (e) {
      e.preventDefault();
      document.querySelectorAll('.content-section').forEach(function (s) { s.classList.remove('active'); });
      var actionsSection = document.getElementById('actions');
      if (actionsSection) actionsSection.classList.add('active');
      var crumb = document.querySelector('.breadcrumb .current');
      if (crumb) crumb.innerText = 'Actions';
    });
  }

  // Resignation form submit is already handled above (see resignationForm event listener)

  var actionsLogoutLink = document.getElementById('actionsLogoutLink');
  if (actionsLogoutLink) {
    actionsLogoutLink.addEventListener('click', function (e) {
      e.preventDefault();
      var modal = document.getElementById('logoutModal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
      }
    });
  }
  // Modal logic
  const modal = document.getElementById('logoutModal');
  const confirmBtn = document.getElementById('confirmLogoutBtn');
  const cancelBtn = document.getElementById('cancelLogoutBtn');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
  if (modal && confirmBtn && cancelBtn) {
    confirmBtn.onclick = function () {
      localStorage.removeItem('nxt_token');
      localStorage.removeItem('nxt_user');
      window.location = './index.html';
    };
    cancelBtn.onclick = function () {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    };
  }

  // Find the logout link by its icon (fa-sign-out-alt) or by text
  document.querySelectorAll('.sidebar .nav-list .nav-item a').forEach(link => {
    const icon = link.querySelector('i');
    const text = link.textContent.trim().toLowerCase();
    if (
      (icon && icon.classList.contains('fa-sign-out-alt')) ||
      text === 'logout'
    ) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        if (modal) {
          modal.classList.remove('hidden');
          modal.style.display = 'flex';
        }
      });
    }
  });
});

/* ===== INITIAL LOAD ===== */
document.addEventListener('DOMContentLoaded', () => {
  // ensure dashboard is active on load
  const defaultSection = document.getElementById('dashboard');
  if (defaultSection && !defaultSection.classList.contains('active')) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    defaultSection.classList.add('active');
  }

  // load default dashboard content
  loadSectionContent('dashboard');

  // fill static profile name and empId in sidebar if elements exist
  try {
    const stored = localStorage.getItem('nxt_user');
    if (stored) {
      const user = JSON.parse(stored);
      const nameEl = document.querySelector('.profile-name');
      const roleEl = document.querySelector('.profile-role');
      if (nameEl) nameEl.innerText = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.empId;
      if (roleEl) roleEl.innerText = (user.role || 'Employee');
    }
  } catch (e) {
    console.warn('Failed to set sidebar profile text', e);
  }

  // Initialize dashboard widgets if on dashboard
  if (defaultSection && defaultSection.classList.contains('active')) {
    initDashboardWidgets();
    fetchAndSetClockStatus();
    initClockButton();
    loadRecentActivity(); // New: Load activity on init
  }

  // ===== HEADER ACTIONS: BELL (NOTIFICATIONS) & ENVELOPE (MESSAGES) =====
  function showModal(title, items) {
    let modal = document.getElementById('headerActionModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'headerActionModal';
      modal.style.position = 'fixed';
      modal.style.top = '70px';
      modal.style.right = '40px';
      modal.style.background = '#fff';
      modal.style.borderRadius = '12px';
      modal.style.boxShadow = '0 4px 24px rgba(44,55,150,0.13)';
      modal.style.zIndex = '9999';
      modal.style.minWidth = '320px';
      modal.style.maxWidth = '95vw';
      modal.style.padding = '1.2rem 1.5rem';
      modal.style.display = 'block';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `<div style='display:flex;align-items:center;justify-content:space-between;'><h3 style='margin:0;font-size:1.2rem;'>${title}</h3><button id='closeHeaderActionModal' style='background:none;border:none;font-size:1.3rem;cursor:pointer;'>&times;</button></div><ul style='margin:1rem 0 0 0;padding:0;list-style:none;'>${items.map(i => `<li style='padding:0.5rem 0;border-bottom:1px solid #eee;'>${i}</li>`).join('')}</ul>`;
    document.getElementById('closeHeaderActionModal').onclick = () => { modal.style.display = 'none'; };
    modal.style.display = 'block';
  }
  const bellBtn = document.querySelector('.header-actions .action-btn i.fa-bell')?.parentElement;
  const msgBtn = document.querySelector('.header-actions .action-btn i.fa-envelope')?.parentElement;
  if (bellBtn) {
    bellBtn.addEventListener('click', () => {
      // Example notifications
      showModal('Notifications', [
        'Your leave request was approved.',
        'Attendance marked for today.',
        'Company meeting at 4 PM.'
      ]);
    });
  }
  if (msgBtn) {
    msgBtn.addEventListener('click', () => {
      // Example messages
      showModal('Messages', [
        '<b>HR:</b> Don’t forget to submit your timesheet.',
        '<b>Manager:</b> Please check your project updates.',
        '<b>Admin:</b> Welcome to the new portal!'
      ]);
    });
  }
  // ===== SEARCH BAR INTERACTION =====
  const searchInput = document.querySelector('.search-box input[type="text"]');
  let searchDropdown = document.createElement('div');
  searchDropdown.className = 'search-results-dropdown';
  document.querySelector('.search-box').appendChild(searchDropdown);

  // Example search data (replace with real API if needed)
  const searchData = [
    { label: 'My Profile', action: () => loadSectionContent('profile') },
    { label: 'Leave Requests', action: () => loadSectionContent('leave') },
    { label: 'Attendance Dashboard', action: () => loadSectionContent('dashboard') },
    { label: 'Reports', action: () => loadSectionContent('reports') }
  ];

  searchInput.addEventListener('input', function () {
    const val = this.value.trim().toLowerCase();
    if (!val) {
      searchDropdown.classList.remove('active');
      searchDropdown.innerHTML = '';
      return;
    }
    const results = searchData.filter(item => item.label.toLowerCase().includes(val));
    if (!results.length) {
      searchDropdown.innerHTML = '<div class="search-result-item">No results found</div>';
      searchDropdown.classList.add('active');
      return;
    }
    searchDropdown.innerHTML = results.map(item => `<div class="search-result-item">${item.label}</div>`).join('');
    searchDropdown.classList.add('active');
    // Attach click handlers
    Array.from(searchDropdown.children).forEach((el, idx) => {
      el.onclick = () => {
        results[idx].action();
        searchDropdown.classList.remove('active');
        searchInput.value = '';
      };
    });
  });
  // Hide dropdown on blur
  searchInput.addEventListener('blur', function () {
    setTimeout(() => searchDropdown.classList.remove('active'), 150);
  });
});
// --- Quick Actions: Real-Time Clock and Clock In/Out ---
function updateRealTimeClock() {
  const clock = document.getElementById('realTimeClock');
  if (clock) {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString();
  }
}
setInterval(updateRealTimeClock, 1000);
updateRealTimeClock();

// Clock In/Out Button Logic Removed by User Request
// const clockInOutBtn = document.getElementById('clockInOutBtn');
// ... logic removed ...


// Quick Action Option Buttons
const viewAttendanceBtn = document.getElementById('viewAttendanceBtn');
if (viewAttendanceBtn) {
  viewAttendanceBtn.addEventListener('click', () => {
    // Navigate to attendance section
    if (typeof showSection === 'function') showSection('attendance');
  });
}
const requestLeaveBtn = document.getElementById('requestLeaveBtn');
if (requestLeaveBtn) {
  requestLeaveBtn.addEventListener('click', () => {
    if (typeof showSection === 'function') showSection('leaves');
  });
}
const helpDeskBtn = document.getElementById('helpDeskBtn');
if (helpDeskBtn) {
  helpDeskBtn.addEventListener('click', () => {
    alert('Contact HR or support@example.com for help.');
  });
}

// Fetch real clock status from backend and update UI
async function fetchAndSetClockStatus() {
  const user = JSON.parse(localStorage.getItem('nxt_user'));
  const statusEl = document.getElementById('clockStatus');
  const btn = document.getElementById('clockButton');
  const lastAction = document.getElementById('lastActionTime');
  if (!user) {
    if (statusEl) statusEl.textContent = 'User not found';
    if (btn) {
      btn.className = 'clock-btn clock-in';
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Clock In';
      btn.disabled = true;
    }
    if (lastAction) lastAction.textContent = 'Last action: None recorded.';
    return;
  }
  try {
    const res = await fetchWithAuth(`${API_BASE}/api/attendance/status/${user.empId}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    let data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok || typeof data.clockedIn === 'undefined') throw new Error(data.message || 'Failed to fetch status');
    if (statusEl && btn) {
      if (data.clockedIn) {
        statusEl.textContent = 'You are currently Clocked In';
        btn.className = 'clock-btn clock-out';
        btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Clock Out';
        btn.disabled = false;
      } else {
        statusEl.textContent = 'You are currently Clocked Out';
        btn.className = 'clock-btn clock-in';
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Clock In';
        btn.disabled = false;
      }
      if (lastAction) {
        if (data.lastActionTime) {
          lastAction.textContent = `Last action: ${new Date(data.lastActionTime).toLocaleString()}`;
        } else {
          lastAction.textContent = 'Last action: None recorded.';
        }
      }
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = 'Unable to fetch status';
    if (btn) {
      btn.className = 'clock-btn clock-in';
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Clock In';
      btn.disabled = true;
    }
    if (lastAction) lastAction.textContent = 'Last action: None recorded.';
    // Optionally show error to user
    alert('Error fetching attendance status. Please try again.');
    console.error('fetchAndSetClockStatus error:', err);
  }
}
// ===== CLOCK IN/OUT BUTTON LOGIC ON DASHBOARD =====
// Clock In/Out Button Logic
// Clock In/Out Button Logic
function initClockButton() {
  const btn = document.getElementById('clockButton');
  if (!btn) return;
  btn.addEventListener('click', async function () {
    const user = JSON.parse(localStorage.getItem('nxt_user'));
    if (!user) {
      alert('User not found');
      return;
    }

    // Check current state (Simple status check)
    let isClockedIn = false;
    try {
      const statusRes = await fetchWithAuth(`${API_BASE}/api/attendance/status/${user.empId}`, { headers: { 'Content-Type': 'application/json' } });
      const statusData = await statusRes.json();
      isClockedIn = statusData.clockedIn;
    } catch { isClockedIn = false; }

    if (isClockedIn) {
      // --- CLOCK OUT (Confirmation Needed) ---
      showClockOutConfirmation(async () => {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clocking Out...';
        try {
          const res = await fetchWithAuth(`${API_BASE}/api/attendance/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ empId: user.empId })
          });
          const data = await res.json();
          if (res.ok) {
            showAttendanceStatusMessage('Checked out successfully.', 'success');
          } else {
            showAttendanceStatusMessage(data.message || 'Checkout failed', 'error');
          }
        } catch (err) {
          showAttendanceStatusMessage('Server error during checkout', 'error');
        }
        btn.disabled = false;
        await fetchAndSetClockStatus();
      });

    } else {
      // --- CLOCK IN (Trigger Selfie/Upload Modal) ---
      // Instead of direct API call, show modal.
      showSelfieModal(async (imageBlob) => {
        // This callback runs when user confirms photo/upload
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

        const formData = new FormData();
        formData.append('empId', user.empId);
        formData.append('image', imageBlob, 'selfie.jpg');

        try {
          const res = await fetch(`${API_BASE}/api/attendance/clock-in-selfie`, {
            method: 'POST',
            headers: { ...authHeaders() }, // Do NOT set Content-Type for FormData, browser sets it with boundary
            body: formData
          });
          const data = await res.json();

          if (res.ok) {
            let msg = data.message || 'Clock In Successful';
            let type = 'success';
            if (data.status === 'late') type = 'warning';
            showAttendanceStatusMessage(msg, type);
          } else {
            showAttendanceStatusMessage(data.message || 'Clock In Failed', 'error');
          }
        } catch (err) {
          console.error(err);
          showAttendanceStatusMessage('Server error during clock in', 'error');
        }

        btn.disabled = false;
        await fetchAndSetClockStatus();
      });
    }
  });
}




// --- Attendance Status Message Logic ---
function showAttendanceStatusMessage(message, type = 'info') {
  // Remove any existing message
  let old = document.getElementById('attendanceStatusMessage');
  if (old) old.remove();
  const msgDiv = document.createElement('div');
  msgDiv.id = 'attendanceStatusMessage';
  msgDiv.className = `attendance-status-message ${type}`;
  msgDiv.innerHTML = `<span>${message}</span>`;
  // Place in dashboard section if available, else body
  const dashboard = document.getElementById('dashboard');
  if (dashboard) {
    dashboard.prepend(msgDiv);
  } else {
    document.body.appendChild(msgDiv);
  }
  // Auto-hide after 4 seconds
  setTimeout(() => {
    msgDiv.classList.add('hide');
    setTimeout(() => msgDiv.remove(), 700);
  }, 4000);
}

// --- Selfie Modal Logic ---
function showSelfieModal(onConfirm) {
  const modal = document.getElementById('selfieModal');
  const video = document.getElementById('selfieVideo');
  const canvas = document.getElementById('selfieCanvas');
  const preview = document.getElementById('selfiePreview');
  const fileInput = document.getElementById('selfieFileInput');

  const startCameraBtn = document.getElementById('startCameraBtn');
  const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
  const captureBtn = document.getElementById('captureSelfieBtn');
  const cancelBtn = document.getElementById('cancelCameraBtn');
  const confirmBtn = document.getElementById('confirmSelfieBtn');
  const retakeBtn = document.getElementById('retakeSelfieBtn');
  const closeBtn = document.getElementById('closeSelfieModalBtn');

  const initialBtns = document.getElementById('initialBtns');
  const captureBtns = document.getElementById('captureBtns');
  const confirmBtns = document.getElementById('confirmBtns');

  let stream = null;
  let imageBlob = null;

  function resetModalUI() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    video.classList.add('hidden');
    canvas.classList.add('hidden');
    preview.classList.add('hidden');
    fileInput.value = '';

    initialBtns.classList.remove('hidden');
    captureBtns.classList.add('hidden');
    confirmBtns.classList.add('hidden');
    imageBlob = null;
  }

  function open() { modal.classList.remove('hidden'); modal.style.display = 'flex'; resetModalUI(); }
  function close() { modal.classList.add('hidden'); modal.style.display = 'none'; resetModalUI(); }

  // Handlers
  startCameraBtn.onclick = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      video.classList.remove('hidden');
      preview.classList.add('hidden');
      initialBtns.classList.add('hidden');
      captureBtns.classList.remove('hidden');
    } catch (e) {
      alert('Camera access denied or unavailable.');
    }
  };

  uploadPhotoBtn.onclick = () => fileInput.click();

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      imageBlob = file;
      const reader = new FileReader();
      reader.onload = (evt) => {
        preview.src = evt.target.result;
        preview.classList.remove('hidden');
        initialBtns.classList.add('hidden');
        confirmBtns.classList.remove('hidden');
      }
      reader.readAsDataURL(file);
    }
  };

  captureBtn.onclick = () => {
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      imageBlob = blob;
      preview.src = canvas.toDataURL('image/jpeg');
      preview.classList.remove('hidden');
      video.classList.add('hidden');
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      captureBtns.classList.add('hidden');
      confirmBtns.classList.remove('hidden');
    }, 'image/jpeg', 0.95);
  };

  cancelBtn.onclick = () => resetModalUI();
  retakeBtn.onclick = () => resetModalUI();

  confirmBtn.onclick = () => {
    if (!imageBlob) return alert('No image selected');
    if (!(imageBlob instanceof Blob)) {
      console.error('Invalid image data:', imageBlob);
      return alert('Image data invalid. Please retake/upload.');
    }
    const blobToSend = imageBlob; // Capture value before resetModalUI nulls it
    close();
    onConfirm(blobToSend);
  };

  closeBtn.onclick = close;

  open();
}





// collectSelfieMeta removed



// ===== DASHBOARD WIDGETS: Clock, Week Range, Calendar =====
function initDashboardWidgets() {
  // Live 12hr clock
  function updateClock() {
    const now = new Date();
    let h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    const pad = n => n.toString().padStart(2, '0');
    const timeStr = `${pad(h)}:${pad(m)}:${pad(s)} ${ampm}`;
    const el = document.getElementById('currentTime');
    if (el) el.textContent = timeStr;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // Week range (Sun-Sat)
  function getWeekRange(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diffToSun = d.getDate() - day;
    const diffToSat = d.getDate() + (6 - day);
    const sunday = new Date(d.setDate(diffToSun));
    const saturday = new Date(d.setDate(diffToSat - (d.getDate() - diffToSun)));
    const opts = { month: 'short', day: 'numeric' };
    return `${sunday.toLocaleDateString(undefined, opts)} - ${saturday.toLocaleDateString(undefined, opts)}, ${saturday.getFullYear()}`;
  }
  const weekEl = document.getElementById('currentWeek');
  if (weekEl) weekEl.textContent = getWeekRange(new Date());

  // Calendar display: show today in a readable format, update in real time
  function updateCalendarDisplay() {
    const calEl = document.getElementById('calendarDisplay');
    if (calEl) {
      const today = new Date();
      const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      calEl.textContent = today.toLocaleDateString(undefined, opts);
    }
  }
  updateCalendarDisplay();
  setInterval(updateCalendarDisplay, 1000 * 60); // update every minute
}

/* ===== SECTION DISPATCHER ===== */
function loadSectionContent(sectionId) {
  switch (sectionId) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'profile':
      loadProfile();
      break;
    case 'leave':
      loadLeave();
      break;
    case 'reports':
      loadReports();
      break;
    case 'quick-actions':
      loadQuickActions();
      break;
    case 'settings':
      loadSettings();
      break;
    default:
      // do nothing
      break;
  }
}

/* ===== DASHBOARD: load summary counts & stats ===== */
async function loadDashboard() {
  try {
    // 1. Load today's counts (Present/Absent/Leave) - Keep using summary/today or my-stats?
    // The previous summary/today was likely global or generic. 
    // If we want PERSONAL counts (e.g. "Present: 1" if I am present), we can use my-stats?
    // No, the widgets (Time, Week, Calendar) are static. The Stats Grid (Total Absent, Pending Leaves) needs data.

    // Existing summary/today endpoint returns { present, absent, onLeave } counts.
    // If this is the "Present Today" widget showing global count, let's keep it.
    // If this is checking IF the user is present, that's different.
    // Assuming the "Present Today" (etc) in the dashboard are global counts (common in admin dashboards, maybe less in employee?).
    // However, the "Attendance Rate" card likely refers to the employee's OWN rate.

    // Let's keep the widget data fetching as is (global vs personal ambiguity aside).
    const res = await fetchWithAuth(`${API_BASE}/api/attendance/summary/today`);
    if (res.ok) {
      const json = await res.json();
      const presentEl = document.getElementById('presentCount'); // These IDs might be in the LEGEND of the chart?
      const absentEl = document.getElementById('absentCount');
      const leaveEl = document.getElementById('leaveCount');
      // If these are legend counts for the rate chart, they should come from my-stats.
      // If they are separate widgets... let's see HTML.
      // HTML Line 230: <div class="legend-item"><span>Present: <span id="presentCount">0</span></span></div>
      // These are definitely LEGEND items for the Attendance Rate chart.
      // So they should reflect the graph data (My Stats), not global.

      // I will update them inside loadMyStats instead.
    }
  } catch (e) {/* ignore */ }


  // 2. Load My Stats
  loadMyStats('today'); // Default to today to match UI

  // Attach Listeners to Chart Buttons
  // Use a unique attribute to avoid double binding if loadDashboard is called multiple times
  if (!window.dashboardListenersAttached) {
    document.querySelectorAll('.chart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // 1. Handle Active Class
        e.target.parentNode.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        // 2. Determine functionality (Attendance vs OnTime is distinguished by the card context)
        const period = e.target.dataset.period;

        currentStatsPeriod = period; // Update global state

        // Since loadMyStats fetches ALL stats, we can just call it. 
        // However, if we want to change ONLY the context of one chart...
        // The backend wraps both stats in one call.
        // Ideally we should have separate calls or just refresh both.
        // Refreshing both is simpler and acceptable.
        loadMyStats(period);

        // Sync buttons in the other card to match period? 
        // Or allow mixed periods? 
        // If mixed periods allowed, I need separate calls or a backend that accepts "attendancePeriod" and "ontimePeriod".
        // My backend takes ?period=... and returns both.
        // So I will sync the UI: set active class on other card buttons too.
        document.querySelectorAll(`.chart-btn[data-period="${period}"]`).forEach(b => {
          b.classList.add('active');
          b.parentNode.querySelectorAll('.chart-btn').forEach(sibling => {
            if (sibling !== b) sibling.classList.remove('active');
          });
        });
      });
    });
    window.dashboardListenersAttached = true;
  }
}

async function loadMyStats(period) {
  try {
    const res = await fetchWithAuth(`${API_BASE}/api/attendance/my-stats?period=${period}`);
    if (!res.ok) return;
    const data = await res.json();

    // --- 1. Attendance Rate ---
    const attRate = parseFloat(data.attendanceRate || 0);
    renderGauge('attendanceGauge', attRate, '#10b981'); // Green

    const attText = document.getElementById('gaugePercentage');
    if (attText) attText.innerText = attRate + '%';

    // Update Legend for Attendance
    const presentEl = document.getElementById('presentCount');
    const absentEl = document.getElementById('absentCount'); // This might differ from "Total Absent" widget
    const leaveEl = document.getElementById('leaveCount');

    if (presentEl) presentEl.innerText = data.daysPresent;
    // absentCount in legend is usually TotalDays - Present - Leave?
    // My backend returns lateCount.
    // Let's infer absent = (totalDays - daysPresent). (Ignoring leaves calculation for simplicity if not provided)
    const absentCount = (data.totalDays || 0) - (data.daysPresent || 0);
    // backend sends precise totalAbsent now, but let's stick to received data if possible or fallback
    if (absentEl) absentEl.innerText = data.totalAbsent !== undefined ? data.totalAbsent : 0;

    if (leaveEl) leaveEl.innerText = data.daysOnLeave !== undefined ? data.daysOnLeave : 0;


    // --- 2. On Time Rate ---
    const onTimeRate = parseFloat(data.onTimeRate || 0);
    renderGauge('ontimeGauge', onTimeRate, '#3b82f6'); // Blue

    const timeText = document.getElementById('ontimePercentage');
    if (timeText) timeText.innerText = onTimeRate + '%';

    // Update Legend for On Time
    const onTimeEl = document.getElementById('onTimeCount');
    const lateEl = document.getElementById('lateCount');
    if (onTimeEl) onTimeEl.innerText = data.onTimeCount;
    if (lateEl) lateEl.innerText = data.lateCount;

    // --- 3. Stats Grid (New) ---
    // Use animation for better UX
    animateCounter('totalAbsent', data.totalAbsent || 0);
    animateCounter('pendingLeaves', data.pendingLeaves || 0);
    animateCounter('avgWorkHours', data.avgWorkHours || 0, 'h');

  } catch (e) {
    console.error('Stats load error', e);
  }
}

// Counter Animation Helper
function animateCounter(id, target, suffix = '') {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseFloat(el.innerText) || 0;
  const end = parseFloat(target);
  if (isNaN(end)) return;
  if (start === end) {
    el.innerText = end + suffix;
    return;
  }

  const duration = 1000;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease out quart
    const ease = 1 - Math.pow(1 - progress, 4);

    const current = start + (end - start) * ease;

    // Format: decimals if needed
    const isFloat = end % 1 !== 0;
    el.innerText = (isFloat ? current.toFixed(1) : Math.round(current)) + suffix;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.innerText = end + suffix;
    }
  }
  requestAnimationFrame(update);
}

// Global state for period
let currentStatsPeriod = 'today';

// Auto-refresh stats every 30 seconds
setInterval(() => {
  if (document.getElementById('dashboard')?.classList.contains('active')) {
    loadMyStats(currentStatsPeriod);
  }
}, 30000);

// Render Gauge (Semi-Circle to match design)
function renderGauge(canvasId, percent, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Set high resolution
  if (canvas.width !== 300) { canvas.width = 300; canvas.height = 150; }

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Background Arc (Gray)
  ctx.beginPath();
  // Arc: x, y, radius, startAngle, endAngle
  ctx.arc(w / 2, h, h - 20, Math.PI, 0);
  ctx.lineWidth = 25;
  ctx.strokeStyle = '#f3f4f6';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Progress Arc (Color)
  if (percent > 0) {
    ctx.beginPath();
    // Calculate end angle: Start at PI (left), go clockwise.
    // Span is PI. Percent 100% -> 0. 50% -> 1.5 PI (top).
    // Formula: Math.PI + (percent/100 * Math.PI)
    const endAngle = Math.PI + ((percent / 100) * Math.PI);
    ctx.arc(w / 2, h, h - 20, Math.PI, endAngle);
    ctx.lineWidth = 25;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}


/* ===== PROFILE ===== */
async function loadProfile() {
  const sec = document.getElementById('profile');
  if (!sec) return;
  sec.innerHTML = `<div class="dashboard-content"><h2>Loading profile…</h2></div>`;
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers: { 'Content-Type': 'application/json', ...authHeaders() } });
    if (!res.ok) {
      sec.innerHTML = `<div class="dashboard-content"><h2>Unable to load profile</h2></div>`;
      return;
    }
    const u = await res.json();
    sec.innerHTML = `
      <div class="dashboard-content">
        <h1 class="profile-title"><i class="fas fa-id-card"></i> My Profile</h1>
        <div class="profile-card" style="display:flex; flex-direction:column; gap:2rem; max-width:800px;">
          
          <div style="display:flex; align-items:center; gap:2rem; padding-bottom:2rem; border-bottom:1px solid #eee;">
             <div class="profile-avatar" style="width:100px; height:100px; font-size:3rem;"><i class="fas fa-user-circle"></i></div>
             <div>
                <h2 style="margin:0; font-size:1.8rem; color:#1e293b;">${u.firstName ?? ''} ${u.lastName ?? ''}</h2>
                <div style="color:#64748b; font-size:1.1rem; margin-top:0.4rem;">${u.role ? u.role.toUpperCase() : 'EMPLOYEE'}</div>
             </div>
          </div>

          <div class="profile-details-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1.5rem;">
            <div class="profile-item">
              <label style="display:block; color:#64748b; font-size:0.9rem; margin-bottom:0.3rem;">Employee ID</label>
              <div style="font-weight:600; font-size:1.1rem; color:#334155;">${u.empId}</div>
            </div>
            <div class="profile-item">
               <label style="display:block; color:#64748b; font-size:0.9rem; margin-bottom:0.3rem;">Email Address</label>
               <div style="font-weight:600; font-size:1.1rem; color:#334155;">${u.email ?? '—'}</div>
            </div>
            <div class="profile-item">
               <label style="display:block; color:#64748b; font-size:0.9rem; margin-bottom:0.3rem;">Mobile Number</label>
               <div style="font-weight:600; font-size:1.1rem; color:#334155;">${u.phone || '—'}</div>
            </div>
            <div class="profile-item">
               <label style="display:block; color:#64748b; font-size:0.9rem; margin-bottom:0.3rem;">Designation</label>
               <div style="font-weight:600; font-size:1.1rem; color:#334155;">${u.position?.name || 'Developer'}</div>
            </div>
            <div class="profile-item">
               <label style="display:block; color:#64748b; font-size:0.9rem; margin-bottom:0.3rem;">Department</label>
               <div style="font-weight:600; font-size:1.1rem; color:#334155;">${u.department ? (u.department.name || u.department) : '—'}</div>
            </div>
             <div class="profile-item">
               <label style="display:block; color:#64748b; font-size:0.9rem; margin-bottom:0.3rem;">Joining Date</label>
               <div style="font-weight:600; font-size:1.1rem; color:#334155;">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</div>
            </div>
            <div class="profile-item">
               <label style="display:block; color:#64748b; font-size:0.9rem; margin-bottom:0.3rem;">Account Status</label>
               <div style="font-weight:600; font-size:1.1rem; color:#10b981;">Active</div>
            </div>
          </div>

        </div>
      </div>
    `;
  } catch (err) {
    console.error('Profile error', err);
    sec.innerHTML = `<div class="dashboard-content"><h2>Error loading profile</h2></div>`;
  }
}

/* ===== LEAVE REQUEST ===== */
function loadLeave() {
  const sec = document.getElementById('leave');
  if (!sec) return;

  sec.innerHTML = `
    <div class="dashboard-content">
      <h1 style="margin-bottom:1.5rem;"><i class='fas fa-calendar-plus' style='color:var(--primary-color);margin-right:0.5rem;'></i>Leave Request</h1>
      <div class="leave-card">
        <div class="leave-field"><label for="leaveStart"><i class="fas fa-play"></i>Start Date</label><input type="date" id="leaveStart"></div>
        <div class="leave-field"><label for="leaveEnd"><i class="fas fa-flag-checkered"></i>End Date</label><input type="date" id="leaveEnd"></div>
        <div class="leave-field"><label for="leaveDepartment"><i class="fas fa-building"></i>Department</label><input type="text" id="leaveDepartment" name="department" placeholder="Enter your department"></div>
        <div class="leave-field"><label for="leaveReason"><i class="fas fa-align-left"></i>Reason</label><textarea id="leaveReason" rows="3"></textarea></div>
        <button id="leaveSubmit" class="submit-btn"><i class="fas fa-paper-plane"></i> Submit Leave</button>
      </div>
      <div style="margin-top:2.5rem;">
        <h2 style="margin-bottom:1rem;color:var(--primary-color);display:flex;align-items:center;gap:0.5rem;"><i class="fas fa-history"></i> Leave History</h2>
        <div id="myLeaves" class="leave-list"></div>
      </div>
    </div>
  `;

  document.getElementById('leaveSubmit').addEventListener('click', submitLeaveRequest);

  // also load user's leave requests (if backend has any)
  loadMyLeaves();
}

async function submitLeaveRequest() {
  const stored = localStorage.getItem('nxt_user');
  if (!stored) return alert('User not found');
  const user = JSON.parse(stored);

  const start = document.getElementById('leaveStart').value;
  const end = document.getElementById('leaveEnd').value;
  const reason = document.getElementById('leaveReason').value;

  if (!start || !end) return alert('Please select start and end date');

  try {
    const res = await fetch(`${API_BASE}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ empId: user.empId, startDate: start, endDate: end, reason })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Failed');

    // Show animated confirmation in page center
    showLeaveConfirmation();
    loadMyLeaves();
  } catch (err) {
    console.error('Submit leave error', err);
    alert('Server error');
  }
}

function showLeaveConfirmation() {
  // Remove any existing confirmation
  const old = document.getElementById('leaveConfirmationModal');
  if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'leaveConfirmationModal';
  modal.className = 'leave-confirmation-modal';
  modal.innerHTML = `
    <div class="leave-confirmation-content">
      <div class="leave-illus">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="56" fill="#e0f7fa"/><path d="M40 65l15 15 25-35" stroke="#10b981" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="60" cy="60" r="56" stroke="#10b981" stroke-width="4" stroke-dasharray="8 8"/></svg>
      </div>
      <div class="leave-confirmation-text">Leave request submitted!</div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => {
    modal.classList.add('hide');
    setTimeout(() => modal.remove(), 700);
  }, 1800);
}

async function loadMyLeaves() {
  // no dedicated endpoint in default backend; if you added one use it.
  const container = document.getElementById('myLeaves');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;color:var(--primary-color);"><i class="fas fa-spinner fa-spin"></i> Loading your leave requests...</div>`;
  try {
    const res = await fetch(`${API_BASE}/api/leaves/my`, { headers: { 'Content-Type': 'application/json', ...authHeaders() } });
    if (!res.ok) {
      container.innerHTML = `<div style="text-align:center;color:var(--primary-color);margin-top:1.5rem;"><i class="fas fa-info-circle"></i> No leave history available.</div>`;
      return;
    }
    const mine = await res.json();
    if (!mine.length) {
      container.innerHTML = `<div style="text-align:center;color:var(--primary-color);margin-top:1.5rem;"><i class="fas fa-info-circle"></i> No leave requests found.</div>`;
      return;
    }
    container.innerHTML = '<h3 style="margin-bottom:1rem;"><i class="fas fa-list"></i> My Leave Requests</h3>';
    mine.forEach(l => {
      const d = document.createElement('div');
      d.className = 'leave-request-card';
      d.innerHTML = `
        <span class="leave-request-icon"><i class="fas fa-calendar-alt"></i></span>
        <div class="leave-request-info">
          <div class="leave-request-dates">${l.startDate.substring(0, 10)} → ${l.endDate.substring(0, 10)}</div>
          <div>${l.reason || ''}</div>
        </div>
        <span class="leave-request-status">${l.status}</span>
      `;
      container.appendChild(d);
    });
  } catch (err) {
    console.error('Load my leaves', err);
    container.innerHTML = `<div style="text-align:center;color:var(--danger-color);margin-top:1.5rem;"><i class="fas fa-exclamation-triangle"></i> Error loading leave history.</div>`;
  }
}

/* ===== REPORTS (placeholder) ===== */
function loadReports() {
  const sec = document.getElementById('reports');
  if (!sec) return;
  sec.innerHTML = `
    <div class="dashboard-content">
      <h1 style="margin-bottom:1.5rem;">Reports</h1>
      <div class="report-section">
        <h2 class="report-section-title"><i class="fas fa-calendar-check"></i> Leave Requests Status</h2>
        <div id="leaveReports" class="report-leave-list"></div>
      </div>
      <div class="report-section">
        <h2 class="report-section-title"><i class="fas fa-tasks"></i> Admin Task Requests</h2>
        <div id="adminTasks" class="report-admin-task-list"></div>
      </div>
      <div class="report-section">
        <h2 class="report-section-title"><i class="fas fa-cogs"></i> Other Operations</h2>
        <div id="otherOps" class="report-other-ops-list"></div>
      </div>
    </div>
  `;
  loadLeaveReports();
  loadAdminMessages();
  // Removed fake tasks and ops
  // loadAdminTasks(); 
  // loadOtherOps();
}

// Fetch and display admin messages for the employee
async function loadAdminMessages() {
  const container = document.getElementById('adminMessages');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;color:var(--primary-color);"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>`;
  try {
    const user = JSON.parse(localStorage.getItem('nxt_user'));
    if (!user || !user.empId) {
      container.innerHTML = `<div class="report-empty">User not found.</div>`;
      return;
    }
    const res = await fetch(`${API_BASE}/api/messages/${user.empId}`, { headers: { 'Content-Type': 'application/json', ...authHeaders() } });
    if (!res.ok) {
      container.innerHTML = `<div class="report-empty">No messages found.</div>`;
      return;
    }
    const messages = await res.json();
    if (!messages.length) {
      container.innerHTML = `<div class="report-empty">No messages found.</div>`;
      return;
    }
    container.innerHTML = messages.map(m => `
      <div class="report-admin-message-card ${m.type}">
        <div class="admin-message-content">${m.message}</div>
        <div class="admin-message-date">${new Date(m.createdAt).toLocaleString()}</div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="report-empty">Error loading messages.</div>`;
  }
}

// Deprecated fake loaders
function loadAdminTasks() {
  const container = document.getElementById('adminTasks');
  if (container) container.innerHTML = '<div class="report-empty">No pending tasks.</div>';
}
function loadOtherOps() {
  const container = document.getElementById('otherOps');
  if (container) container.innerHTML = '<div class="report-empty">No other operations found.</div>';
}

async function loadLeaveReports() {
  const container = document.getElementById('leaveReports');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;color:var(--primary-color);"><i class="fas fa-spinner fa-spin"></i> Loading leave reports...</div>`;
  try {
    const res = await fetch(`${API_BASE}/api/leaves/my`, { headers: { 'Content-Type': 'application/json', ...authHeaders() } });
    if (!res.ok) {
      container.innerHTML = `<div style="text-align:center;color:var(--primary-color);margin-top:1.5rem;"><i class="fas fa-info-circle"></i> No leave report data available.</div>`;
      return;
    }
    const mine = await res.json();
    if (!mine.length) {
      container.innerHTML = `<div style="text-align:center;color:var(--primary-color);margin-top:1.5rem;"><i class="fas fa-info-circle"></i> No leave history found.</div>`;
      return;
    }
    // Group by status
    const statusGroups = {
      pending: [],
      approved: [],
      rejected: []
    };
    mine.forEach(l => {
      if (l.status === 'approved') statusGroups.approved.push(l);
      else if (l.status === 'rejected') statusGroups.rejected.push(l);
      else statusGroups.pending.push(l);
    });
    let html = '';
    html += `<div class="report-group"><h3><i class="fas fa-hourglass-half"></i> Pending Requests</h3>`;
    if (statusGroups.pending.length) {
      statusGroups.pending.forEach(l => {
        html += reportLeaveCard(l, 'pending');
      });
    } else {
      html += `<div class="report-empty"><i class="fas fa-info-circle"></i> No pending requests.</div>`;
    }
    html += `</div>`;
    html += `<div class="report-group"><h3><i class="fas fa-check-circle"></i> Approved Leaves</h3>`;
    if (statusGroups.approved.length) {
      statusGroups.approved.forEach(l => {
        html += reportLeaveCard(l, 'approved');
      });
    } else {
      html += `<div class="report-empty"><i class="fas fa-info-circle"></i> No approved leaves.</div>`;
    }
    html += `</div>`;
    html += `<div class="report-group"><h3><i class="fas fa-times-circle"></i> Rejected Leaves</h3>`;
    if (statusGroups.rejected.length) {
      statusGroups.rejected.forEach(l => {
        html += reportLeaveCard(l, 'rejected');
      });
    } else {
      html += `<div class="report-empty"><i class="fas fa-info-circle"></i> No rejected leaves.</div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
  } catch (err) {
    console.error('Load leave reports', err);
    container.innerHTML = `<div style="text-align:center;color:var(--danger-color);margin-top:1.5rem;"><i class="fas fa-exclamation-triangle"></i> Error loading leave reports.</div>`;
  }
}

function reportLeaveCard(l, status) {
  let icon = 'fa-hourglass-half', badge = 'pending';
  if (status === 'approved') { icon = 'fa-check-circle'; badge = 'approved'; }
  if (status === 'rejected') { icon = 'fa-times-circle'; badge = 'rejected'; }
  return `
    <div class="report-leave-card">
      <span class="report-leave-icon"><i class="fas ${icon}"></i></span>
      <div class="report-leave-info">
        <div class="report-leave-dates">${l.startDate.substring(0, 10)} → ${l.endDate.substring(0, 10)}</div>
        <div class="report-leave-reason">${l.reason || ''}</div>
      </div>
      <span class="report-leave-badge ${badge}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
    </div>
  `;
}

/* ===== QUICK ACTIONS ===== */
function loadQuickActions() {
  const sec = document.getElementById('quick-actions');
  if (!sec) return;
  sec.innerHTML = `
    <div class="dashboard-content">
      <h1>Quick Actions</h1>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <button class="submit-btn" id="btnCheckIn">Clock In</button>
        <button class="submit-btn" id="btnCheckOut">Clock Out</button>
      </div>
    </div>
  `;
  document.getElementById('btnCheckIn').addEventListener('click', doCheckIn);
  document.getElementById('btnCheckOut').addEventListener('click', doCheckOut);
}

/* ===== SETTINGS (placeholder) ===== */
function loadSettings() {
  const sec = document.getElementById('settings');
  if (!sec) return;
  sec.innerHTML = `
    <div class="dashboard-content">
      <h1>Settings</h1>
      <div class="card">
        <p>Account and application settings will be here.</p>
      </div>
    </div>
  `;
}

/* ===== CHECK-IN / CHECK-OUT ===== */
async function doCheckIn() {
  const user = JSON.parse(localStorage.getItem('nxt_user'));
  if (!user) return alert('User not found');
  try {
    const res = await fetch(`${API_BASE}/api/attendance/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ empId: user.empId })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Check-in failed');
    alert('Checked in successfully');
    loadDashboard();
  } catch (err) {
    console.error('checkin error', err);
    alert('Server error');
  }
}

async function doCheckOut() {
  const user = JSON.parse(localStorage.getItem('nxt_user'));
  if (!user) return alert('User not found');
  try {
    const res = await fetch(`${API_BASE}/api/attendance/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ empId: user.empId })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Check-out failed');
    alert('Checked out successfully');
    loadDashboard();
  } catch (err) {
    console.error('checkout error', err);
    alert('Server error');
  }
}

// --- Clock Out Confirmation Modal ---
async function showClockOutConfirmation(onConfirm) {
  let modal = document.getElementById('clockOutConfirmModal');

  // Fetch current status to check duration
  let isEarly = false;
  let durationMsg = 'Are you sure you want to end your shift for today?';
  let warningClass = '';

  try {
    const user = JSON.parse(localStorage.getItem('nxt_user'));
    if (user && user.empId) {
      const res = await fetch(`${API_BASE}/api/attendance/status/${user.empId}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.checkIn) {
        const checkInTime = new Date(data.checkIn);
        const now = new Date();
        const diffHours = (now - checkInTime) / (1000 * 60 * 60);
        if (diffHours < 8) {
          isEarly = true;
          durationMsg = `
                  <div style="background:#fef2f2; border:1px solid #fecaca; padding:10px; border-radius:8px; margin-bottom:1rem; color:#b91c1c; font-size:0.95rem;">
                     <strong><i class="fas fa-exclamation-triangle"></i> Early Departure Warning</strong><br>
                     You have worked less than 8 hours (${diffHours.toFixed(1)} hrs).<br>
                     Leaving early twice in a month will result in being marked <strong>ABSENT</strong>.
                  </div>
                  Are you sure you want to clock out now?
                `;
          warningClass = 'warning-mode';
        }
      }
    }
  } catch (e) { console.error(e); }

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'clockOutConfirmModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:10001; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px);';

    modal.innerHTML = `
      <div class="confirm-modal-content" style="background:#fff; padding:2rem; border-radius:16px; width:450px; max-width:90%; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,0.3); animation: scaleUp 0.3s ease;">
        <div id="modalIcon" style="font-size:3rem; color:#f59e0b; margin-bottom:1rem;"><i class="fas fa-exclamation-circle"></i></div>
        <h2 style="margin-bottom:0.5rem; color:#1e293b;">Confirm Clock Out</h2>
        <div id="modalMsg" style="color:#64748b; margin-bottom:2rem; font-size:1.05rem;">${durationMsg}</div>
        <div style="display:flex; gap:1rem; justify-content:center;">
          <button id="cancelClockOutBtn" style="padding:0.8rem 1.5rem; border:1px solid #cbd5e1; background:#fff; color:#475569; border-radius:8px; cursor:pointer; font-weight:600; transition:all 0.2s;">Cancel</button>
          <button id="confirmClockOutBtn" style="padding:0.8rem 1.5rem; border:none; background:#ef4444; color:#fff; border-radius:8px; cursor:pointer; font-weight:600; box-shadow:0 4px 12px rgba(239,68,68,0.3);">Yes, Clock Out</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    if (!document.getElementById('scaleUpStyle')) {
      const s = document.createElement('style');
      s.id = 'scaleUpStyle';
      s.textContent = `@keyframes scaleUp { from { transform:scale(0.9); opacity:0; } to { transform:scale(1); opacity:1; } }`;
      document.head.appendChild(s);
    }
  } else {
    // Update existing modal content dynamically
    const msgEl = modal.querySelector('#modalMsg');
    if (msgEl) msgEl.innerHTML = durationMsg;
  }

  modal.style.display = 'flex';

  const confirmBtn = modal.querySelector('#confirmClockOutBtn');
  const cancelBtn = modal.querySelector('#cancelClockOutBtn');

  // Reset listeners
  const newConfirm = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
  const newCancel = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

  newConfirm.onclick = () => {
    modal.style.display = 'none';
    if (onConfirm) onConfirm();
  };

  newCancel.onclick = () => {
    modal.style.display = 'none';
  };
}



// --- Recent Activity Loader ---
async function loadRecentActivity() {
  const listEl = document.getElementById('activityList');
  if (!listEl) return;
  listEl.innerHTML = '<div style="padding:1rem; text-align:center; color:#64748b;">Loading activity...</div>';

  try {
    const res = await fetchWithAuth(`${API_BASE}/api/activity/my`);
    if (!res.ok) throw new Error('Failed');
    const activities = await res.json();

    if (!activities.length) {
      listEl.innerHTML = '<div style="padding:1rem; text-align:center; color:#64748b;">No recent activity found.</div>';
      return;
    }

    listEl.innerHTML = activities.map(item => `
        <div class="activity-item">
            <div class="activity-icon ${getActivityIconClass(item.type)}">
                <i class="fas ${getActivityIcon(item.type)}"></i>
            </div>
            <div class="activity-details">
                <h4>${item.title}</h4>
                <p>${item.details}</p>
            </div>
            <div class="activity-time">
                ${timeAgo(new Date(item.timestamp))}
                ${getStatusBadge(item.status)}
            </div>
        </div>
    `).join('');

  } catch (err) {
    console.error('Activity Error', err);
    listEl.innerHTML = '<div style="padding:1rem; text-align:center; color:#ef4444;">Unable to load activity.</div>';
  }
}

function getActivityIconClass(type) {
  switch (type) {
    case 'attendance_in': return 'bg-green-light text-green';
    case 'attendance_out': return 'bg-blue-light text-blue';
    case 'leave': return 'bg-yellow-light text-yellow';
    case 'resignation': return 'bg-red-light text-red';
    default: return 'bg-gray-light text-gray';
  }
}

function getActivityIcon(type) {
  switch (type) {
    case 'attendance_in': return 'fa-sign-in-alt';
    case 'attendance_out': return 'fa-sign-out-alt';
    case 'leave': return 'fa-calendar-minus';
    case 'resignation': return 'fa-file-signature';
    default: return 'fa-bell';
  }
}

function getStatusBadge(status) {
  if (!status) return '';
  let color = 'gray';
  if (['present', 'approved', 'completed'].includes(status)) color = 'success-color';
  if (['late', 'pending'].includes(status)) color = 'warning-color';
  if (['absent', 'rejected'].includes(status)) color = 'danger-color';
  return `<div style="font-size:0.75rem; color:var(--${color}); font-weight:600; margin-top:0.2rem;">${status.toUpperCase()}</div>`;
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return Math.floor(seconds) + "s ago";
}

/* ================= MOUSE GLOW EFFECT ================= */
(function initMouseGlow() {
  const glow = document.createElement('div');
  glow.classList.add('mouse-glow');
  document.body.appendChild(glow);

  let mouseX = 0, mouseY = 0;
  let currentX = 0, currentY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function animate() {
    currentX += (mouseX - currentX) * 0.1;
    currentY += (mouseY - currentY) * 0.1;

    glow.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(animate);
  }
  animate();
})();
