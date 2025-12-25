/**
 * admin-script.js
 * - Navigation for admin sidebar
 * - Loads content: dashboard, employees, attendance, present, absent, leave, reports, quick-actions, settings
 * - Integrates with backend (admin role required for many endpoints)
 */
const API_BASE = "http://localhost:4000"; // use '' if same origin


function getToken() { return localStorage.getItem('nxt_token'); }
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};

}

/* ===== AUTH CHECK ===== */
(function initAdminAuth() {
  const token = getToken();
  if (!token) {
    window.location = './index.html';
    return;
  }
  // Optionally check role from stored user
  const stored = localStorage.getItem('nxt_user');
  if (stored) {
    try {
      const u = JSON.parse(stored);
      if (u.role !== 'admin') {
        // not an admin -> redirect
        window.location = './employee.html';
        return;
      }
    } catch (e) { /* ignore */ }
  }
})();

/* ===== NAV HANDLERS ===== */
document.querySelectorAll('.sidebar .nav-list .nav-item a').forEach(link => {
  link.addEventListener('click', function (e) {
    e.preventDefault();
    const href = this.getAttribute('href') || '#dashboard';
    const sectionId = href.replace('#', '');

    // toggle content
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');

    // sidebar active state
    document.querySelectorAll('.sidebar .nav-list .nav-item').forEach(i => i.classList.remove('active'));
    this.parentElement.classList.add('active');

    // breadcrumb
    const crumb = document.querySelector('.breadcrumb .current');
    if (crumb) crumb.innerText = this.innerText.trim();

    // Always reload settings content when navigating to settings
    if (sectionId === 'settings') {
      loadSettings();
    } else {
      // load dynamic content
      loadAdminSection(sectionId);
    }
  });
});

/* Logout handling (last nav item) */
/* eslint-disable no-unused-vars */
(function attachAdminLogout() {
  // Footer logout icon: remove logout operation
  const footerLogout = document.getElementById('logoutLink');
  if (footerLogout) {
    footerLogout.addEventListener('click', (e) => {
      e.preventDefault();
      // No operation (disabled)
    });
  }
  // Removed sidebar nav logout handler
})();

document.addEventListener('DOMContentLoaded', () => {
      // Real-time resignation badge update for admin sidebar
      async function updateResignationBadge() {
        const badge = document.getElementById('resignationBadge');
        if (!badge) return;
        try {
          const res = await fetch(`${API_BASE}/api/resignations/all`, { headers: { 'Content-Type': 'application/json', ...authHeaders() }});
          if (!res.ok) {
            badge.style.display = 'none';
            return;
          }
          const data = await res.json();
          const pending = data.filter(r => r.status && r.status.toLowerCase() === 'pending').length;
          if (pending > 0) {
            badge.textContent = pending;
            badge.style.display = '';
          } else {
            badge.textContent = '';
            badge.style.display = 'none';
          }
        } catch {
          badge.style.display = 'none';
        }
      }
      updateResignationBadge();
      setInterval(updateResignationBadge, 30000); // update every 30s
    // Real-time badge update for admin message box
    async function updateAdminMsgBadge() {
      const badge = document.getElementById('adminMsgBadge');
      if (!badge) return;
      try {
        const res = await fetch(`${API_BASE}/api/messages/admin/unread-count`, { headers: { 'Content-Type': 'application/json', ...authHeaders() }});
        if (!res.ok) {
          badge.style.display = 'none';
          return;
        }
        const data = await res.json();
        if (data.unread && data.unread > 0) {
          badge.textContent = data.unread;
          badge.style.display = '';
        } else {
          badge.textContent = '';
          badge.style.display = 'none';
        }
      } catch {
        badge.style.display = 'none';
      }
    }
    updateAdminMsgBadge();
    setInterval(updateAdminMsgBadge, 30000); // update every 30s
  // ensure default section
  const defaultSection = document.getElementById('dashboard');
  if (defaultSection && !defaultSection.classList.contains('active')) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    defaultSection.classList.add('active');
  }
  loadAdminSection('dashboard');
  // set admin name in header/sidebar if present
  try {
    const stored = localStorage.getItem('nxt_user');
    if (stored) {
      const u = JSON.parse(stored);
      const el = document.getElementById('adminName');
      if (el) el.innerText = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.empId;
    }
  } catch(e) {}

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
        '3 employees requested leave today.',
        'Attendance summary is ready.',
        'System update scheduled for Friday.'
      ]);
    });
  }
  if (msgBtn) {
    msgBtn.addEventListener('click', async () => {
      // Fetch real-time admin messages from backend
      try {
        const res = await fetch(`${API_BASE}/api/messages/admin`, { headers: { 'Content-Type': 'application/json', ...authHeaders() }});
        if (!res.ok) {
          showModal('Messages', ['No messages found.']);
          return;
        }
        const messages = await res.json();
        if (!messages.length) {
          showModal('Messages', ['No messages found.']);
          return;
        }
        showModal('Messages', messages.map(m => `<b>${m.sender || 'System'}:</b> ${m.message}`));
      } catch (err) {
        showModal('Messages', ['Error loading messages.']);
      }
    });
  }
});

// ===== CLOCK, DATE, WEEK RANGE =====
function updateDateTimeWidgets() {
  // Date
  const dateEl = document.getElementById('currentDate');
  const weekEl = document.getElementById('currentWeek');
  const timeEl = document.getElementById('currentTime');
  const now = new Date();
  // Date: e.g. Sunday, Nov 23, 2025
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  if (dateEl) dateEl.textContent = dateStr;
  // Time: 12hr format with AM/PM
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const timeStr = `${hours}:${minutes}:${seconds} ${ampm}`;
  if (timeEl) timeEl.textContent = timeStr;
  // Week range (Mon-Sun)
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekStr = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  if (weekEl) weekEl.textContent = weekStr;

}

document.addEventListener('DOMContentLoaded', () => {
  updateDateTimeWidgets();
  setInterval(updateDateTimeWidgets, 1000);
});

/* SECTION DISPATCHER */
function loadAdminSection(id) {
  switch (id) {
    case 'dashboard': loadAdminDashboard(); break;
    case 'employees': loadEmployeesList(); break;
    case 'attendance': loadAttendance(); break;
    case 'present': loadPresentToday(); break;
    case 'absent': loadAbsentToday(); break;
    case 'leave': loadLeaveRequests(); break;
    case 'resignations': loadResignationsSection(); break;
    case 'reports': loadReports(); break;
    case 'quick-actions': loadQuickActions(); break;
    case 'settings': loadSettings(); break;
    default: break;
  }
}

// Real-time Resignation Requests Section
async function loadResignationsSection() {
  const sec = document.getElementById('resignations');
  if (!sec) return;
  sec.innerHTML = `<div class="dashboard-content resignations-section"><h1><i class="fas fa-file-signature"></i> Resignation Requests</h1><div id="adminResignationsList" class="admin-resignations-list"><div class="msg-loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div></div>`;
  try {
    const res = await fetch(`${API_BASE}/api/resignations/all`, { headers: { 'Content-Type': 'application/json', ...authHeaders() }});
    if (!res.ok) {
      document.getElementById('adminResignationsList').innerHTML = '<div class="msg-empty">No resignation requests found.</div>';
      return;
    }
    const resignations = await res.json();
    if (!resignations.length) {
      document.getElementById('adminResignationsList').innerHTML = '<div class="msg-empty">No resignation requests found.</div>';
      return;
    }
    document.getElementById('adminResignationsList').innerHTML = resignations.map(r => {
      const emp = r.employee || {};
      const empName = emp.firstName || emp.lastName ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : (emp.empId || r.empId || 'Employee');
      const empEmail = emp.email || '';
      const empDept = emp.department?.name || '';
      const lastDay = r.lastWorkingDay ? new Date(r.lastWorkingDay).toLocaleDateString() : '';
      const docLink = r.attachmentUrl ? `<a href="${r.attachmentUrl}" target="_blank">View Document</a>` : '';
      let actions = '';
      if (r.status === 'pending') {
        actions = `<div class="admin-resignation-actions">
          <button class="msg-action-btn approve" data-id="${r._id}">Approve</button>
          <button class="msg-action-btn reject" data-id="${r._id}">Reject</button>
        </div>`;
      }
      return `
      <div class="admin-resignation-card ${r.status.toLowerCase()}">
        <div class="admin-resignation-header">
          <span class="admin-resignation-emp"><i class="fas fa-user"></i> ${empName}</span>
          <span class="admin-resignation-date">Submitted: ${new Date(r.submittedAt || r.createdAt).toLocaleString()}</span>
        </div>
        <div class="admin-resignation-details">
          <div><b>Email:</b> ${empEmail}</div>
          <div><b>Department:</b> ${empDept}</div>
          <div><b>Last Working Day:</b> ${lastDay}</div>
          <div><b>Reason:</b> ${r.reason || ''}</div>
          <div><b>Supporting Document:</b> ${docLink}</div>
        </div>
        <div class="admin-resignation-status">Status: <b>${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</b></div>
        ${actions}
      </div>
      `;
    }).join('');

    // Attach event listeners for Approve/Reject
    document.querySelectorAll('.admin-resignation-actions .approve').forEach(btn => {
      btn.onclick = async function() {
        const id = btn.getAttribute('data-id');
        btn.disabled = true;
        try {
          const res = await fetch(`${API_BASE}/api/resignations/review/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ status: 'approved' })
          });
          if (res.ok) {
            btn.closest('.admin-resignation-card').querySelector('.admin-resignation-status').innerHTML = 'Status: <b>Approved</b>';
            btn.parentElement.innerHTML = '<span class="msg-action-done">Approved</span>';
          } else {
            alert('Failed to approve resignation');
            btn.disabled = false;
          }
        } catch {
          alert('Server error');
          btn.disabled = false;
        }
      };
    });
    document.querySelectorAll('.admin-resignation-actions .reject').forEach(btn => {
      btn.onclick = async function() {
        const id = btn.getAttribute('data-id');
        btn.disabled = true;
        try {
          const res = await fetch(`${API_BASE}/api/resignations/review/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ status: 'rejected' })
          });
          if (res.ok) {
            btn.closest('.admin-resignation-card').querySelector('.admin-resignation-status').innerHTML = 'Status: <b>Rejected</b>';
            btn.parentElement.innerHTML = '<span class="msg-action-done">Rejected</span>';
          } else {
            alert('Failed to reject resignation');
            btn.disabled = false;
          }
        } catch {
          alert('Server error');
          btn.disabled = false;
        }
      };
    });
  } catch (err) {
    document.getElementById('adminResignationsList').innerHTML = '<div class="msg-empty">Error loading resignation requests.</div>';
  }
  // Real-time update: poll every 30s
  if (!window._adminResignationInterval) {
    window._adminResignationInterval = setInterval(loadResignationsSection, 30000);
  }
}

// Real-time Messages Section: shows all employee requests and updates
async function loadMessagesSection() {
  const sec = document.getElementById('messages');
  if (!sec) return;
  sec.innerHTML = `<div class="dashboard-content messages-section"><h1><i class="fas fa-envelope"></i> Employee Requests & Updates</h1><div id="adminMessagesList" class="admin-messages-list"><div class="msg-loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div></div>`;
  try {
    const res = await fetch(`${API_BASE}/api/messages`, { headers: { 'Content-Type': 'application/json', ...authHeaders() }});
    if (!res.ok) {
      document.getElementById('adminMessagesList').innerHTML = '<div class="msg-empty">No messages found.</div>';
      return;
    }
    const messages = await res.json();
    if (!messages.length) {
      document.getElementById('adminMessagesList').innerHTML = '<div class="msg-empty">No messages found.</div>';
      return;
    }
    document.getElementById('adminMessagesList').innerHTML = messages.map(m => {
      let actions = '';
      if (m.type === 'resignation' && m.status === 'Pending') {
        actions = `<div class="admin-message-actions">
          <button class="msg-action-btn approve" data-id="${m._id}">Approve</button>
          <button class="msg-action-btn reject" data-id="${m._id}">Reject</button>
        </div>`;
      }
      return `
      <div class="admin-message-card ${m.type || ''}">
        <div class="admin-message-header">
          <span class="admin-message-sender"><i class="fas fa-user"></i> ${m.senderName || m.sender || 'Employee'}</span>
          <span class="admin-message-date">${new Date(m.createdAt).toLocaleString()}</span>
        </div>
        <div class="admin-message-content">${m.message}</div>
        ${m.status ? `<div class=\"admin-message-status\">Status: <b>${m.status}</b></div>` : ''}
        ${actions}
      </div>
      `;
    }).join('');

    // Attach event listeners for Approve/Reject
    document.querySelectorAll('.msg-action-btn.approve').forEach(btn => {
      btn.onclick = async function() {
        const id = btn.getAttribute('data-id');
        btn.disabled = true;
        try {
          const res = await fetch(`${API_BASE}/api/resignations/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() }
          });
          if (res.ok) {
            btn.closest('.admin-message-card').querySelector('.admin-message-status').innerHTML = 'Status: <b>Approved</b>';
            btn.parentElement.innerHTML = '<span class="msg-action-done">Approved</span>';
          } else {
            alert('Failed to approve resignation');
            btn.disabled = false;
          }
        } catch {
          alert('Server error');
          btn.disabled = false;
        }
      };
    });
    document.querySelectorAll('.msg-action-btn.reject').forEach(btn => {
      btn.onclick = async function() {
        const id = btn.getAttribute('data-id');
        btn.disabled = true;
        try {
          const res = await fetch(`${API_BASE}/api/resignations/${id}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() }
          });
          if (res.ok) {
            btn.closest('.admin-message-card').querySelector('.admin-message-status').innerHTML = 'Status: <b>Rejected</b>';
            btn.parentElement.innerHTML = '<span class="msg-action-done">Rejected</span>';
          } else {
            alert('Failed to reject resignation');
            btn.disabled = false;
          }
        } catch {
          alert('Server error');
          btn.disabled = false;
        }
      };
    });
  } catch (err) {
    document.getElementById('adminMessagesList').innerHTML = '<div class="msg-empty">Error loading messages.</div>';
  }
  // Real-time update: poll every 30s
  if (!window._adminMsgInterval) {
    window._adminMsgInterval = setInterval(loadMessagesSection, 30000);
  }
}

/* DASHBOARD SUMMARY */
async function loadAdminDashboard() {
  try {
    const res = await fetch(`${API_BASE}/api/attendance/summary/today`, { headers: { 'Content-Type':'application/json', ...authHeaders() }});
    if (res.status === 401) {
      // Unauthorized: clear token and redirect to login
      localStorage.removeItem('nxt_token');
      localStorage.removeItem('nxt_user');
      window.location.href = './index.html';
      return;
    }
    if (!res.ok) return;
    const json = await res.json();
    const presentEl = document.getElementById('presentCount');
    const absentEl = document.getElementById('absentCount');
    const leaveEl = document.getElementById('leaveCount');
    const totalEl = document.getElementById('totalEmployees');
    if (presentEl) presentEl.innerText = json.present ?? 0;
    if (absentEl) absentEl.innerText = json.absent ?? 0;
    if (leaveEl) leaveEl.innerText = json.onLeave ?? 0;

    // get total employees
    try {
      const r = await fetch(`${API_BASE}/api/employees`, { headers: { 'Content-Type':'application/json', ...authHeaders() }});
      if (r.status === 401) {
        localStorage.removeItem('nxt_token');
        localStorage.removeItem('nxt_user');
        window.location.href = './index.html';
        return;
      }
      if (r.ok) {
        const list = await r.json();
        if (totalEl) totalEl.innerText = list.length;
      }
    } catch(e){}

    // Fetch and render late members
    loadLateMembersToday();
  } catch (err) {
    console.error('Admin dashboard error', err);
  }
}

// Fetch and render late members today
async function loadLateMembersToday() {
  const listEl = document.getElementById('lateMembersList');
  const countEl = document.getElementById('lateCount');
  if (!listEl || !countEl) return;
  listEl.innerHTML = '<div class="text-center" style="color:#aaa;">Loading…</div>';
  try {
    const res = await fetch(`${API_BASE}/api/attendance/late/today`, { headers: { 'Content-Type':'application/json', ...authHeaders() }});
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    countEl.textContent = data.length;
    if (!data.length) {
      listEl.innerHTML = '<div class="text-center" style="color:#aaa;">No late members today 🎉</div>';
      return;
    }
    listEl.innerHTML = '';
    data.forEach(m => {
      const initials = (m.name || m.empId || '?').split(' ').map(x => x[0]).join('').toUpperCase().substring(0,2);
      const checkInTime = m.checkIn ? new Date(m.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--';
      const item = document.createElement('div');
      item.className = 'late-member-item';
      item.innerHTML = `
        <div class="member-avatar">${initials}</div>
        <div class="member-info">
          <div class="member-name">${m.name || m.empId}</div>
          <div class="member-role">${m.department || ''}</div>
        </div>
        <div class="late-time"><i class="fas fa-clock"></i> ${checkInTime}</div>
      `;
      listEl.appendChild(item);
    });
  } catch (err) {
    listEl.innerHTML = '<div class="text-center" style="color:#e57373;">Error loading late members</div>';
    countEl.textContent = '0';
  }
}

/* EMPLOYEES LIST */
async function loadEmployeesList() {
  const sec = document.getElementById('employees');
  if (!sec) return;
  sec.innerHTML = `<div class="dashboard-content"><h2>Loading employees…</h2></div>`;
  try {
    const res = await fetch(`${API_BASE}/api/employees`, { headers: { 'Content-Type':'application/json', ...authHeaders() }});
    if (!res.ok) {
      sec.innerHTML = `<div class="dashboard-content"><h2>Unable to load employees</h2></div>`;
      return;
    }
    const list = await res.json();
    let html = `<div class="dashboard-content"><h1>Employees</h1><div class="employees-grid" id="employeeList"></div></div>`;
    sec.innerHTML = html;
    const container = document.getElementById('employeeList');
    if (!list.length) {
      container.innerHTML = `<div class='employees-empty-illustration'><svg fill='none' viewBox='0 0 64 64' width='120'><circle cx='32' cy='32' r='30' stroke='#e0e7ef' stroke-width='4'/><path d='M20 44c0-6 12-6 12-6s12 0 12 6v3H20v-3Z' fill='#e0e7ef'/><circle cx='32' cy='28' r='6' fill='#e0e7ef'/></svg><div class='msg'>No employees found</div></div>`;
      return;
    }
    list.forEach((emp, i) => {
      const d = document.createElement('div');
      d.className = 'employee-card-anim';
      d.style.animationDelay = (i * 0.07) + 's';
      d.innerHTML = `
        <div class="employee-card-photo-anim"><img src="${emp.photoUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp.firstName + ' ' + emp.lastName)}" alt="${emp.firstName || ''} ${emp.lastName || ''}"></div>
        <div class="employee-card-info-anim">
          <div class="employee-card-name-anim">${emp.firstName || ''} ${emp.lastName || ''}</div>
          <div class="employee-card-dept-anim">${emp.department?.name || ''}</div>
          <div class="employee-card-email-anim">${emp.email || ''}</div>
        </div>
      `;
      container.appendChild(d);
    });
  } catch (err) {
    console.error('Load employees error', err);
    sec.innerHTML = `<div class="dashboard-content"><h2>Error loading employees</h2></div>`;
  }
}

/* ATTENDANCE - simple view */
async function loadAttendance() {
  const sec = document.getElementById('attendance');
  if (!sec) return;
  sec.innerHTML = `<div class="dashboard-content"><h2>Loading attendance…</h2></div>`;
  // Real-time attendance records
  let intervalId;
  async function renderAttendanceRecords() {
    sec.innerHTML = `<div class="dashboard-content"><h1>Attendance Records <span class='attendance-refreshing' id='attendanceRefreshing'></span></h1><div class="attendance-records-grid" id="attendanceRecords"></div></div>`;
    const container = document.getElementById('attendanceRecords');
    try {
      const res = await fetch(`${API_BASE}/api/attendance/history`, { headers: { 'Content-Type':'application/json', ...authHeaders() }});
      if (!res.ok) {
        container.innerHTML = `<div class='attendance-empty-illustration'><svg fill='none' viewBox='0 0 64 64' width='120'><circle cx='32' cy='32' r='30' stroke='#e0e7ef' stroke-width='4'/><path d='M20 44c0-6 12-6 12-6s12 0 12 6v3H20v-3Z' fill='#e0e7ef'/><circle cx='32' cy='28' r='6' fill='#e0e7ef'/></svg><div class='msg'>Unable to load attendance records</div></div>`;
        return;
      }
      const list = await res.json();
      if (!list.length) {
        container.innerHTML = `<div class='attendance-empty-illustration'><svg fill='none' viewBox='0 0 64 64' width='120'><circle cx='32' cy='32' r='30' stroke='#e0e7ef' stroke-width='4'/><path d='M20 44c0-6 12-6 12-6s12 0 12 6v3H20v-3Z' fill='#e0e7ef'/><circle cx='32' cy='28' r='6' fill='#e0e7ef'/></svg><div class='msg'>No attendance records found</div></div>`;
        return;
      }
      container.innerHTML = '';
      list.forEach((rec, i) => {
        const d = document.createElement('div');
        d.className = 'attendance-record-card';
        d.style.animationDelay = (i * 0.07) + 's';
        // Selfie thumbnail
        const selfieUrl = rec.meta?.selfieUrl || rec.selfieImageUrl || '';
        // Metadata
        const meta = rec.meta || {};
        const exif = meta.exif || {};
        const gps = meta.gps || meta.geo || exif.gps || null;
        const device = meta.deviceModel || exif.Model || '';
        const resolution = meta.resolution || (exif.PixelXDimension && exif.PixelYDimension ? `${exif.PixelXDimension}x${exif.PixelYDimension}` : '');
        const capturedAt = meta.capturedAt || exif.DateTimeOriginal || '';
        // Working hours
        let workingHours = '';
        if (rec.checkIn && rec.checkOut) {
          const diffMs = new Date(rec.checkOut) - new Date(rec.checkIn);
          const hours = Math.floor(diffMs / 3600000);
          const mins = Math.floor((diffMs % 3600000) / 60000);
          workingHours = `${hours}h ${mins}m`;
        }
        d.innerHTML = `
          <div class="attendance-record-photo">
            ${selfieUrl ? `<img src="${selfieUrl}" alt="Selfie" style="width:64px;height:64px;object-fit:cover;border-radius:8px;">` : `<img src="${rec.employee?.photoUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(rec.employee?.firstName + ' ' + rec.employee?.lastName)}" alt="${rec.employee?.firstName || ''} ${rec.employee?.lastName || ''}">`}
          </div>
          <div class="attendance-record-info">
            <div class="attendance-record-name">${rec.employee?.firstName || ''} ${rec.employee?.lastName || ''}</div>
            <div class="attendance-record-dept">${rec.employee?.department?.name || ''}</div>
            <div class="attendance-record-status ${rec.status}">${rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}</div>
            <div class="attendance-record-time">Check-in: ${rec.checkIn ? new Date(rec.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--'}${rec.checkOut ? '<br>Check-out: ' + new Date(rec.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}</div>
            ${workingHours ? `<div class="attendance-record-hours">Working: ${workingHours}</div>` : ''}
            <div class="attendance-record-meta">
              ${capturedAt ? `<div><b>Capture Time:</b> ${capturedAt}</div>` : ''}
              ${device ? `<div><b>Device:</b> ${device}</div>` : ''}
              ${resolution ? `<div><b>Resolution:</b> ${resolution}</div>` : ''}
              ${gps ? `<div><b>GPS:</b> ${gps.lat || gps.latitude}, ${gps.lon || gps.longitude}</div>` : ''}
            </div>
          </div>
        `;
        container.appendChild(d);
      });
    } catch (err) {
      container.innerHTML = `<div class='attendance-empty-illustration'><svg fill='none' viewBox='0 0 64 64' width='120'><circle cx='32' cy='32' r='30' stroke='#e0e7ef' stroke-width='4'/><path d='M20 44c0-6 12-6 12-6s12 0 12 6v3H20v-3Z' fill='#e0e7ef'/><circle cx='32' cy='28' r='6' fill='#e0e7ef'/></svg><div class='msg'>Error loading attendance records</div></div>`;
    }
  }
  await renderAttendanceRecords();
  intervalId = setInterval(() => {
    const refreshing = document.getElementById('attendanceRefreshing');
    if (refreshing) refreshing.innerHTML = `<i class='fas fa-sync fa-spin'></i>`;
    renderAttendanceRecords().then(() => {
      const refreshing = document.getElementById('attendanceRefreshing');
      if (refreshing) refreshing.innerHTML = '';
    });
  }, 10000);
  // Clear interval when navigating away
  sec.addEventListener('DOMNodeRemoved', function handler() {
    clearInterval(intervalId);
    sec.removeEventListener('DOMNodeRemoved', handler);
  });
}

// Admin: Load Present Today with selfies
async function loadPresentToday() {
  const res = await fetch('/api/attendance/today', {
    headers: { Authorization: 'Bearer ' + localStorage.getItem('nxt_token') }
  });
  const data = await res.json();
  const listEl = document.getElementById('presentList');
  listEl.innerHTML = '';
  data.forEach(a => {
    listEl.innerHTML += `
      <div class="present-employee-item">
        <img src="${a.selfieImageUrl}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #6366f1;">
        <div class="present-info">
          <div class="present-name">${a.employeeName || a.empId}</div>
          <div class="present-department">${a.department || ''}</div>
        </div>
        <div class="present-time"><i class="fas fa-clock"></i> ${a.checkIn ? new Date(a.checkIn).toLocaleTimeString() : '--'}</div>
        <div class="present-ip">IP: ${a.ipAddress || '-'}</div>
        <div class="present-device">Device: ${a.deviceInfo || '-'}</div>
      </div>
    `;
  });
}

/* PRESENT / ABSENT quick filters (using summary as placeholder) */
async function loadPresentToday() {
  const sec = document.getElementById('present');
  if (!sec) return;
  sec.innerHTML = `<div class="dashboard-content present-list-section"><h1>Present Today</h1><div class="present-list" id="presentList"><div class="present-empty-illustration"><svg fill="none" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" stroke="#e0e7ef" stroke-width="4"/><path d="M16 32c0-4 8-4 8-4s8 0 8 4v2H16v-2Z" fill="#e0e7ef"/><circle cx="24" cy="20" r="4" fill="#e0e7ef"/></svg><div class="msg">Loading…</div></div></div></div>`;
  try {
    const res = await fetch(`${API_BASE}/api/attendance/present/today`, { headers: { 'Content-Type':'application/json', ...authHeaders() }});
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    const listEl = document.getElementById('presentList');
    if (!data.length) {
      listEl.innerHTML = `<div class="present-empty-illustration"><svg fill="none" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" stroke="#e0e7ef" stroke-width="4"/><path d="M16 32c0-4 8-4 8-4s8 0 8 4v2H16v-2Z" fill="#e0e7ef"/><circle cx="24" cy="20" r="4" fill="#e0e7ef"/></svg><div class="msg">No employees present yet</div></div>`;
      return;
    }
    listEl.innerHTML = '';
    data.forEach(emp => {
      // If selfieUrl is present, show image, else show initials
      let avatarHtml = '';
      if (emp.meta && emp.meta.selfieUrl) {
        avatarHtml = `<img src="${emp.meta.selfieUrl}" alt="Selfie" class="present-avatar-img" style="width:48px;height:48px;object-fit:cover;border-radius:50%;border:2px solid #6366f1;" />`;
      } else {
        const initials = (emp.name || emp.empId || '?').split(' ').map(x => x[0]).join('').toUpperCase().substring(0,2);
        avatarHtml = `<div class="present-avatar">${initials}</div>`;
      }
      const checkInTime = emp.checkIn ? new Date(emp.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--';
      const checkInDate = emp.checkIn ? new Date(emp.checkIn).toLocaleDateString('en-US') : '--';
      const location = emp.meta && emp.meta.geo ? `${emp.meta.geo.lat.toFixed(4)}, ${emp.meta.geo.lon.toFixed(4)}` : 'Not available';
      const ip = emp.meta && emp.meta.ip ? emp.meta.ip : 'Not available';
      const device = emp.meta && emp.meta.userAgent ? emp.meta.userAgent.substring(0, 30) + '...' : 'Not available';
      const item = document.createElement('div');
      item.className = 'present-employee-item';
      item.innerHTML = `
        ${avatarHtml}
        <div class="present-info">
          <div class="present-name">${emp.name || emp.empId}</div>
          <div class="present-department">${emp.department || ''}</div>
          <div class="present-details">
            <div class="present-time"><i class="fas fa-clock"></i> ${checkInTime}</div>
            <div class="present-date"><i class="fas fa-calendar"></i> ${checkInDate}</div>
            <div class="present-location"><i class="fas fa-map-marker-alt"></i> ${location}</div>
            <div class="present-ip"><i class="fas fa-globe"></i> ${ip}</div>
            <div class="present-device"><i class="fas fa-mobile-alt"></i> ${device}</div>
          </div>
        </div>
      `;
      listEl.appendChild(item);
    });
  } catch (err) {
    const listEl = document.getElementById('presentList');
    if (listEl) listEl.innerHTML = `<div class="present-empty-illustration"><svg fill="none" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" stroke="#e57373" stroke-width="4"/><path d="M16 32c0-4 8-4 8-4s8 0 8 4v2H16v-2Z" fill="#ffcdd2"/><circle cx="24" cy="20" r="4" fill="#ffcdd2"/></svg><div class="msg">Error loading present employees</div></div>`;
  }
}
async function loadAbsentToday() {
  const sec = document.getElementById('absent');
  if (!sec) return;
  sec.innerHTML = `<div class="dashboard-content absent-list-section"><h1>Absent Today</h1><div class="absent-list" id="absentList"><div class="absent-empty-illustration"><svg fill="none" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" stroke="#fee2e2" stroke-width="4"/><path d="M16 32c0-4 8-4 8-4s8 0 8 4v2H16v-2Z" fill="#fee2e2"/><circle cx="24" cy="20" r="4" fill="#fee2e2"/></svg><div class="msg">Loading…</div></div></div></div>`;
  try {
    const res = await fetch(`${API_BASE}/api/attendance/absent/today`, { headers: { 'Content-Type':'application/json', ...authHeaders() }});
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    const listEl = document.getElementById('absentList');
    if (!data.length) {
      listEl.innerHTML = `<div class="absent-empty-illustration"><svg fill="none" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" stroke="#fee2e2" stroke-width="4"/><path d="M16 32c0-4 8-4 8-4s8 0 8 4v2H16v-2Z" fill="#fee2e2"/><circle cx="24" cy="20" r="4" fill="#fee2e2"/></svg><div class="msg">No employees absent today</div></div>`;
      return;
    }
    listEl.innerHTML = '';
    data.forEach(emp => {
      const initials = (emp.name || emp.empId || '?').split(' ').map(x => x[0]).join('').toUpperCase().substring(0,2);
      const item = document.createElement('div');
      item.className = 'absent-employee-item';
      item.innerHTML = `
        <div class="absent-avatar">${initials}</div>
        <div class="absent-info">
          <div class="absent-name">${emp.name || emp.empId}</div>
          <div class="absent-department">${emp.department || ''}</div>
          <div class="absent-reason"><i class="fas fa-info-circle"></i> ${emp.reason}</div>
        </div>
      `;
      listEl.appendChild(item);
    });
  } catch (err) {
    const listEl = document.getElementById('absentList');
    if (listEl) listEl.innerHTML = `<div class="absent-empty-illustration"><svg fill="none" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" stroke="#e57373" stroke-width="4"/><path d="M16 32c0-4 8-4 8-4s8 0 8 4v2H16v-2Z" fill="#ffcdd2"/><circle cx="24" cy="20" r="4" fill="#ffcdd2"/></svg><div class="msg">Error loading absent employees</div></div>`;
  }
}

/* LEAVE REQUESTS */
async function loadLeaveRequests() {
  const sec = document.getElementById('leave');
  if (!sec) return;
  sec.innerHTML = `<div class="dashboard-content leave-requests-section"><h1>Leave Requests</h1><div id="leaveList" class="leave-requests-list"></div></div>`;
  try {
    const res = await fetch(`${API_BASE}/api/leaves`, { headers: { 'Content-Type':'application/json', ...authHeaders() }});
    if (!res.ok) {
      sec.innerHTML = `<div class="dashboard-content leave-requests-section"><h2>Unable to load leaves</h2></div>`;
      return;
    }
    const list = await res.json();
    const container = document.getElementById('leaveList');
    list.forEach(l => {
      const emp = l.employee || {};
      const empName = emp.firstName || emp.lastName ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : (emp.empId || l.empId || 'Employee');
      const empEmail = emp.email || '';
      const empDept = emp.department?.name || l.department || '';
      const empMobile = emp.phone || '';
      const dates = `${l.startDate.substring(0,10)} → ${l.endDate.substring(0,10)}`;
      const d = document.createElement('div');
      d.className = 'leave-request-item';
      d.innerHTML = `
        <div class="leave-request-header">
          <span class="leave-request-emp"><b>Name:</b> ${empName}</span>
          <span class="leave-request-emp-dept"><b>Department:</b> ${empDept}</span>
          <span class="leave-request-emp-mobile"><b>Mobile:</b> ${empMobile}</span>
          <span class="leave-request-emp-email"><b>Email:</b> ${empEmail}</span>
          <span class="leave-request-dates"><b>Dates:</b> ${dates}</span>
        </div>
        <div class="leave-request-reason"><b>Reason:</b> ${l.reason || ''}</div>
        <div>
          <span class="leave-request-status ${l.status}">${l.status.charAt(0).toUpperCase() + l.status.slice(1)}</span>
        </div>
        <div class="leave-request-actions">
          <button onclick="reviewLeave('${l._id}','approved')" class="submit-btn">Approve</button>
          <button onclick="reviewLeave('${l._id}','rejected')" class="submit-btn">Reject</button>
        </div>
      `;
      container.appendChild(d);
    });
  } catch (err) {
    console.error('Load leaves error', err);
    sec.innerHTML = `<div class="dashboard-content leave-requests-section"><h2>Error loading leaves</h2></div>`;
  }
}

/* Approve/reject leave */
async function reviewLeave(id, status) {
  try {
    const res = await fetch(`${API_BASE}/api/leaves/${id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type':'application/json', ...authHeaders() },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) return showAdminLeaveConfirmation('Failed to update', false);

    // Show animated confirmation in admin page
    showAdminLeaveConfirmation(`Leave ${status === 'approved' ? 'approved' : 'rejected'}!`, true);
    loadLeaveRequests();

    // Send message to employee's message box or reports section (backend call)
    if (data && data.empId) {
      await fetch(`${API_BASE}/api/employees/${data.empId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', ...authHeaders() },
        body: JSON.stringify({
          type: 'leave',
          message: `Your leave request from ${data.startDate?.substring(0,10) || ''} to ${data.endDate?.substring(0,10) || ''} has been ${status}.`,
          leaveId: id,
          status
        })
      });
    }
  } catch (err) {
    console.error('reviewLeave error', err);
    showAdminLeaveConfirmation('Server error', false);
  }
}

function showAdminLeaveConfirmation(msg, success = true) {
  // Remove any existing confirmation
  const old = document.getElementById('adminLeaveConfirmationModal');
  if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'adminLeaveConfirmationModal';
  modal.className = 'leave-confirmation-modal';
  modal.innerHTML = `
    <div class="leave-confirmation-content">
      <div class="leave-illus">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="56" fill="#e0f7fa"/><path d="M40 65l15 15 25-35" stroke="${success ? '#10b981' : '#e53e3e'}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="60" cy="60" r="56" stroke="${success ? '#10b981' : '#e53e3e'}" stroke-width="4" stroke-dasharray="8 8"/></svg>
      </div>
      <div class="leave-confirmation-text" style="color:${success ? 'var(--success-color,#10b981)' : 'var(--danger-color,#e53e3e)'}">${msg}</div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => {
    modal.classList.add('hide');
    setTimeout(() => modal.remove(), 700);

  }, 1800);
}


/* REPORTS placeholder */
async function loadReports() {
  const sec = document.getElementById('reports');
  if (!sec) return;
  sec.innerHTML = `
    <div class="dashboard-content">
      <h1><i class="fas fa-chart-bar"></i> Employee Reports & Analytics</h1>
      <div class="reports-section">
        
        <div class="reports-group">
          <h2>Daily Attendance Summary</h2>
          <div id="dailyReport">
            <div class="daily-report-section" id="dailyReportData">
                <div class="msg-loading"><i class="fas fa-spinner fa-spin"></i> Loading Daily Report...</div>
            </div>
          </div>
          <button id="exportDailyExcel" class="submit-btn"><i class="fas fa-file-excel"></i> Export Excel</button>
          <button id="exportDailyPDF" class="submit-btn"><i class="fas fa-file-pdf"></i> Export PDF</button>
        </div>
        
        <div class="reports-group">
          <h2>Monthly Attendance Report</h2>
          <div id="monthlyReport">
             <div class="daily-report-section" id="monthlyReportData">
                <div class="msg-loading"><i class="fas fa-spinner fa-spin"></i> Loading Monthly Report...</div>
            </div>
          </div>
          <button id="exportMonthlyExcel" class="submit-btn"><i class="fas fa-file-excel"></i> Export Excel</button>
          <button id="exportMonthlyPDF" class="submit-btn"><i class="fas fa-file-pdf"></i> Export PDF</button>
        </div>
        
        <div class="reports-group">
          <h2>Department-wise Performance</h2>
          <div id="departmentReport">
             <div class="daily-report-section" id="departmentReportData">
                <div class="msg-loading"><i class="fas fa-spinner fa-spin"></i> Loading Department Report...</div>
            </div>
          </div>
          <button id="exportDeptExcel" class="submit-btn"><i class="fas fa-file-excel"></i> Export Excel</button>
          <button id="exportDeptPDF" class="submit-btn"><i class="fas fa-file-pdf"></i> Export PDF</button>
        </div>
        
        <div class="reports-group">
          <h2>Late Members Statistics</h2>
          <div id="lateReport">
             <div class="daily-report-section" id="lateReportData">
                <div class="msg-loading"><i class="fas fa-spinner fa-spin"></i> Loading Late Members Report...</div>
            </div>
          </div>
          <button id="exportLateExcel" class="submit-btn"><i class="fas fa-file-excel"></i> Export Excel</button>
          <button id="exportLatePDF" class="submit-btn"><i class="fas fa-file-pdf"></i> Export PDF</button>
        </div>
        
      </div>
    </div>
  `;

  // --- Helper function to render simple data object as a table ---
  function renderSimpleReportTable(id, title, data) {
      const container = document.getElementById(id);
      if (!container) return;
      if (!data || Object.keys(data).length === 0) {
          container.innerHTML = `<div class="daily-report-empty">No ${title} data available.</div>`;
          return;
      }
      
      let tableRows = Object.entries(data).map(([key, value]) => {
          const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          let statusClass = '';
          if (typeof value === 'number') {
              statusClass = (key.toLowerCase().includes('absent') || key.toLowerCase().includes('late')) ? 'rejected' : 'approved';
          }
          return `
              <tr>
                  <td>${formattedKey}</td>
                  <td>${value}</td>
                  <td class="report-status ${statusClass}">${statusClass ? statusClass.charAt(0).toUpperCase() + statusClass.slice(1) : ''}</td>
              </tr>
          `;
      }).join('');

      container.innerHTML = `
        <div class="daily-report-header">
            <h3 class="daily-report-title"><i class="fas fa-chart-line"></i> ${title}</h3>
        </div>
        <div style="overflow-x: auto;">
          <table class="daily-report-table" style="min-width: 400px;">
              <thead>
                  <tr>
                      <th>Metric</th>
                      <th>Value</th>
                      <th>Status</th>
                  </tr>
              </thead>
              <tbody>
                  ${tableRows}
              </tbody>
          </table>
        </div>
      `;
  }
  
  // --- Helper function to render list of objects as a table (e.g., Department or Late Members) ---
  function renderListReportTable(id, title, data, columns, iconClass) {
      const container = document.getElementById(id);
      if (!container) return;
      if (!data || data.length === 0) {
          container.innerHTML = `<div class="daily-report-empty">No ${title} data available.</div>`;
          return;
      }
      
      const headerRow = columns.map(col => `<th>${col.header}</th>`).join('');
      
      const bodyRows = data.map((row, index) => {
          let rowHtml = columns.map(col => {
              let value = row[col.key] || '';
              // Simple formatting for status or number
              let statusClass = '';
              
              if (col.key === 'checkIn' || col.key === 'checkInTime') {
                  value = value ? new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--';
              } else if (col.key.toLowerCase().includes('status')) {
                  statusClass = value.toLowerCase();
              } else if (typeof value === 'number') {
                   // Example logic: if a number is high and related to absence/lateness, flag it.
                   if (col.key.toLowerCase().includes('absent') || col.key.toLowerCase().includes('late')) {
                       statusClass = (value > 2) ? 'rejected' : 'approved';
                   } else if (col.key.toLowerCase().includes('present')) {
                       statusClass = (value < 80) ? 'pending' : 'approved'; // Assuming percentage
                   }
              }
              
              const displayValue = col.key.toLowerCase().includes('avg') && typeof row[col.key] === 'number' ? `${row[col.key].toFixed(1)}%` : value;

              return `<td class="report-status ${statusClass}">${displayValue}</td>`;
          }).join('');
          
          return `<tr>${rowHtml}</tr>`;
      }).join('');

      container.innerHTML = `
        <div class="daily-report-header">
            <h3 class="daily-report-title"><i class="${iconClass}"></i> ${title}</h3>
        </div>
        <div style="overflow-x: auto;">
            <table class="daily-report-table" style="min-width: 500px;">
                <thead>
                    <tr>${headerRow}</tr>
                </thead>
                <tbody>
                    ${bodyRows}
                </tbody>
            </table>
        </div>
      `;
  }


  // --- 1. Daily Attendance Summary (Rendered as Table) ---
  try {
    const res = await fetch(`${API_BASE}/api/attendance/summary/today`, { headers: { 'Content-Type': 'application/json', ...authHeaders() }});
    const data = await res.json();
    const container = document.getElementById('dailyReportData');
    
    if (data && typeof data === 'object') {
        let tableHtml = `
            <div class="daily-report-header">
                <h3 class="daily-report-title"><i class="fas fa-calendar-check"></i> Today's Summary</h3>
            </div>
            <div style="overflow-x: auto;">
              <table class="daily-report-table" style="min-width: 400px;">
                  <thead>
                      <tr>
                          <th>Metric</th>
                          <th>Count</th>
                          <th>Status</th>
                      </tr>
                  </thead>
                  <tbody>
                      <tr>
                          <td>Total Employees</td>
                          <td>${data.total ?? 0}</td>
                          <td class="report-status approved">Clear</td>
                      </tr>
                      <tr>
                          <td>Present</td>
                          <td>${data.present ?? 0}</td>
                          <td class="report-status approved">On Time</td>
                      </tr>
                      <tr>
                          <td>Absent</td>
                          <td>${data.absent ?? 0}</td>
                          <td class="report-status rejected">Missed</td>
                      </tr>
                      <tr>
                          <td>On Leave</td>
                          <td>${data.onLeave ?? 0}</td>
                          <td class="report-status pending">Excused</td>
                      </tr>
                      <tr>
                          <td>Late Check-in</td>
                          <td>${data.late ?? 0}</td>
                          <td class="report-status pending">Needs Review</td>
                      </tr>
                  </tbody>
              </table>
            </div>
        `;
        container.innerHTML = tableHtml;
    } else {
        container.innerHTML = `<div class="daily-report-empty">No detailed summary available today.</div>`;
    }
  } catch(e) {
    document.getElementById('dailyReportData').innerHTML = `<div class="daily-report-empty">Error loading daily attendance summary.</div>`;
  }
  
  // --- 2. Monthly Report (Converted to Table) ---
  try {
    const res = await fetch(`${API_BASE}/api/attendance/summary/monthly`, { headers: { 'Content-Type': 'application/json', ...authHeaders() }});
    const data = await res.json();
    renderSimpleReportTable('monthlyReportData', 'Monthly Summary', data);
  } catch(e) {
    document.getElementById('monthlyReportData').innerHTML = `<div class="daily-report-empty">Error loading monthly summary.</div>`;
  }


  // --- 3. Department-wise Performance (Converted to Table) ---
  try {
    const res = await fetch(`${API_BASE}/api/attendance/summary/department`, { headers: { 'Content-Type': 'application/json', ...authHeaders() }});
    const data = await res.json();
    // Assuming data is an array of objects like: [{ department: 'HR', total: 10, presentAvg: 90.5, absentAvg: 9.5, ... }]
    const columns = [
        { header: 'Department', key: 'department' },
        { header: 'Total Employees', key: 'total' },
        { header: 'Present Avg.', key: 'presentAvg' }, 
        { header: 'Absent Avg.', key: 'absentAvg' }
    ];
    renderListReportTable('departmentReportData', 'Department Performance', data, columns, 'fas fa-chart-pie');
  } catch(e) {
    document.getElementById('departmentReportData').innerHTML = `<div class="daily-report-empty">Error loading department performance.</div>`;
  }

  // --- 4. Late Members Statistics (Converted to Table) ---
  try {
    const res = await fetch(`${API_BASE}/api/attendance/late/today`, { headers: { 'Content-Type': 'application/json', ...authHeaders() }});
    const data = await res.json();
    // Assuming data is an array of objects like: [{ name: 'A. Smith', department: 'IT', checkIn: '2025-12-08T09:30:00.000Z' }]
    const columns = [
        { header: 'Employee Name', key: 'name' },
        { header: 'Department', key: 'department' },
        { header: 'Check-in Time', key: 'checkIn' }
    ];
    renderListReportTable('lateReportData', 'Late Check-ins Today', data, columns, 'fas fa-clock');
  } catch(e) {
    document.getElementById('lateReportData').innerHTML = `<div class="daily-report-empty">Error loading late members report.</div>`;
  }
  
  // Export buttons (Excel/PDF) - placeholder logic

  // Helper to download file from backend

  // Show confirmation banner in center of page (report section only)
  function showReportConfirmation(msg, success = true) {
    // Remove any existing confirmation
    const old = document.getElementById('adminReportConfirmationModal');
    if (old) old.remove();
    const modal = document.createElement('div');
    modal.id = 'adminReportConfirmationModal';
    modal.className = 'leave-confirmation-modal';
    modal.innerHTML = `
      <div class="leave-confirmation-content">
        <div class="leave-illus">
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="56" fill="#e0f7fa"/><path d="M40 65l15 15 25-35" stroke="${success ? '#10b981' : '#e53e3e'}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="60" cy="60" r="56" stroke="${success ? '#10b981' : '#e53e3e'}" stroke-width="4" stroke-dasharray="8 8"/></svg>
        </div>
        <div class="leave-confirmation-text" style="color:${success ? 'var(--success-color,#10b981)' : 'var(--danger-color,#e53e3e)'}">${msg}</div>
      </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => {
      modal.classList.add('hide');
      setTimeout(() => modal.remove(), 700);
    }, 1800);
  }

  async function downloadReport(url, filename) {
    try {
      const res = await fetch(url, { headers: { ...authHeaders() } });
      if (!res.ok) throw new Error('Failed to export');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(link.href); }, 100);
      showReportConfirmation('Export successful!', true);
    } catch (err) {
      showReportConfirmation('Export failed: ' + (err.message || 'Unknown error'), false);
    }
  }

  document.getElementById('exportDailyExcel').onclick = () => downloadReport(`${API_BASE}/api/attendance/export/daily/excel`, 'DailyAttendance.xlsx');
  document.getElementById('exportDailyPDF').onclick = () => downloadReport(`${API_BASE}/api/attendance/export/daily/pdf`, 'DailyAttendance.pdf');
  document.getElementById('exportMonthlyExcel').onclick = () => downloadReport(`${API_BASE}/api/attendance/export/monthly/excel`, 'MonthlyAttendance.xlsx');
  document.getElementById('exportMonthlyPDF').onclick = () => downloadReport(`${API_BASE}/api/attendance/export/monthly/pdf`, 'MonthlyAttendance.pdf');
  document.getElementById('exportDeptExcel').onclick = () => downloadReport(`${API_BASE}/api/attendance/export/department/excel`, 'DepartmentPerformance.xlsx');
  document.getElementById('exportDeptPDF').onclick = () => downloadReport(`${API_BASE}/api/attendance/export/department/pdf`, 'DepartmentPerformance.pdf');
  document.getElementById('exportLateExcel').onclick = () => downloadReport(`${API_BASE}/api/attendance/export/late/excel`, 'LateMembers.xlsx');
  document.getElementById('exportLatePDF').onclick = () => downloadReport(`${API_BASE}/api/attendance/export/late/pdf`, 'LateMembers.pdf');

  // Hide the red dot when reports are viewed
  const redDot = document.getElementById('reportsRedDot');
  const redDotMobile = document.getElementById('reportsRedDotMobile');
  if (redDot) redDot.style.display = 'none';
  if (redDotMobile) redDotMobile.style.display = 'none';
  // Mark messages as read (simulate)
  localStorage.setItem('admin_reports_read', '1');
}

/* QUICK ACTIONS placeholder */
function loadQuickActions() {
  const sec = document.getElementById('quick-actions');
  if (!sec) return;
	sec.innerHTML = `
      <div class="dashboard-content">
        <h1 style="margin-bottom:1.5rem;"><i class='fas fa-bolt' style='color:var(--primary-color);margin-right:0.5rem;'></i>Quick Actions</h1>
        <div class="quick-actions-grid">
          <button class="quick-action-btn" id="addEmployeeBtn"><i class="fas fa-user-plus"></i> <span>New Employee Add</span></button>
          <button class="quick-action-btn" id="addAdminBtn"><i class="fas fa-user-shield"></i> <span>Add New Admin</span></button>
          <button class="quick-action-btn" id="updateEmployeeBtn"><i class="fas fa-user-edit"></i> <span>Update Employee Profile</span></button>
          <button class="quick-action-btn" id="showEmployeesBtn"><i class="fas fa-users"></i> <span>Employees Details Show</span></button>
          <button class="quick-action-btn" id="removeEmployeeBtn"><i class="fas fa-user-minus"></i> <span>Employee Remove</span></button>
        </div>
      </div>
    `;
  // Add Admin button logic
  document.getElementById('addAdminBtn').onclick = () => showAddAdminModal();

  // Button actions (for demonstration, navigate to relevant sections)
  document.getElementById('addEmployeeBtn').onclick = () => showAddEmployeeModal();

  // Modal for adding new employee
  function showAddEmployeeModal() {
    // Remove any existing modal
    const old = document.getElementById('addEmployeeModal');
    if (old) old.remove();
    const modal = document.createElement('div');
    modal.id = 'addEmployeeModal';
    modal.className = 'employee-modal-overlay';
    modal.innerHTML = `
      <div class="employee-modal-content">
        <button class="employee-modal-close" id="closeAddEmployeeModal"><i class="fas fa-times"></i></button>
        <h2><i class="fas fa-user-plus"></i> Add New Employee</h2>
        <form id="addEmployeeForm" class="employee-form">
          <div class="employee-form-group">
            <label for="empId">Login ID</label>
            <input type="text" id="empId" name="empId" required autocomplete="off" placeholder="e.g. EMP003">
          </div>
          <div class="employee-form-group">
            <label for="empPassword">Password</label>
            <input type="password" id="empPassword" name="empPassword" required autocomplete="off" placeholder="Set a password">
          </div>
          <div class="employee-form-group">
            <label for="empFirstName">First Name</label>
            <input type="text" id="empFirstName" name="empFirstName" required autocomplete="off">
          </div>
          <div class="employee-form-group">
            <label for="empLastName">Last Name</label>
            <input type="text" id="empLastName" name="empLastName" required autocomplete="off">
          </div>
          <div class="employee-form-group">
            <label for="empEmail">Email ID</label>
            <input type="email" id="empEmail" name="empEmail" required autocomplete="off">
          </div>
          <div class="employee-form-group">
            <label for="empPhone">Phone Number</label>
            <input type="tel" id="empPhone" name="empPhone" required autocomplete="off">
          </div>
          <div class="employee-form-group">
            <label for="empDepartment">Department Name</label>
            <input type="text" id="empDepartment" name="empDepartment" required autocomplete="off">
          </div>
          <div class="employee-form-group">
            <label for="empPosition">Position</label>
            <input type="text" id="empPosition" name="empPosition" required autocomplete="off">
          </div>
          <button type="submit" class="submit-btn">Add Employee</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('closeAddEmployeeModal').onclick = () => modal.remove();
    document.getElementById('addEmployeeForm').onsubmit = async function(e) {
      e.preventDefault();
      const form = e.target;
      const empId = form.empId.value.trim();
      const password = form.empPassword.value.trim();
      const firstName = form.empFirstName.value.trim();
      const lastName = form.empLastName.value.trim();
      const email = form.empEmail.value.trim();
      const phone = form.empPhone.value.trim();
      const departmentName = form.empDepartment.value.trim();
      const positionTitle = form.empPosition.value.trim();
      // Fetch/create department and position
      let departmentId = null, positionId = null;
      try {
        // Try to find department
        let depRes = await fetch(`${API_BASE}/api/departments`, { headers: { 'Content-Type':'application/json', ...authHeaders() }});
        let depList = depRes.ok ? await depRes.json() : [];
        let dep = depList.find(d => d.name.toLowerCase() === departmentName.toLowerCase());
        if (!dep) {
          // Create department
          let newDepRes = await fetch(`${API_BASE}/api/departments`, { method: 'POST', headers: { 'Content-Type':'application/json', ...authHeaders() }, body: JSON.stringify({ name: departmentName }) });
          dep = newDepRes.ok ? await newDepRes.json() : null;
        }
        departmentId = dep?._id;
      } catch {}
      try {
        let posRes = await fetch(`${API_BASE}/api/positions`, { headers: { 'Content-Type':'application/json', ...authHeaders() }});
        let posList = posRes.ok ? await posRes.json() : [];
        let pos = posList.find(p => p.title.toLowerCase() === positionTitle.toLowerCase());
        if (!pos) {
          let newPosRes = await fetch(`${API_BASE}/api/positions`, { method: 'POST', headers: { 'Content-Type':'application/json', ...authHeaders() }, body: JSON.stringify({ title: positionTitle }) });
          pos = newPosRes.ok ? await newPosRes.json() : null;
        }
        positionId = pos?._id;
      } catch {}
      // Determine role based on department or position
      let role = 'employee';
      const adminKeywords = ['admin', 'administrator', 'hr', 'human resources'];
      if (
        adminKeywords.some(k => departmentName.toLowerCase().includes(k)) ||
        adminKeywords.some(k => positionTitle.toLowerCase().includes(k))
      ) {
        role = 'admin';
      }
      // Create employee with backend API call
      try {
        const newEmpRes = await fetch(`${API_BASE}/api/employees`, {
          method: 'POST',
          headers: { 'Content-Type':'application/json', ...authHeaders() },
          body: JSON.stringify({
            empId,
            password,
            firstName,
            lastName,
            email,
            phone,
            department: departmentId,
            position: positionId,
            role
          })
        });
        if (newEmpRes.ok) {
          modal.remove();
          showAdminLeaveConfirmation('Employee added successfully!', true);
          loadEmployeesList();
        } else {
          alert('Failed to add employee');
        }
      } catch (err) {
        console.error('Add employee error', err);
        alert('Server error');
      }
    };
  }

  document.getElementById('updateEmployeeBtn').onclick = () => {
    alert('Update employee functionality coming soon!');
  };
  document.getElementById('showEmployeesBtn').onclick = () => showAllEmployeeDetails();

  // Show all employee details in a modal/grid
  async function showAllEmployeeDetails() {
    // Remove any existing modal
    const old = document.getElementById('allEmployeesModal');
    if (old) old.remove();
    // Fetch employees
    let employees = [];
    try {
      const res = await fetch(`${API_BASE}/api/employees`, { headers: { 'Content-Type':'application/json', ...authHeaders() }});
      if (res.ok) employees = await res.json();
    } catch (err) { /* ignore */ }
    const modal = document.createElement('div');
    modal.id = 'allEmployeesModal';
    modal.className = 'employee-modal-overlay';
    modal.innerHTML = `
      <div class="employee-modal-content" style="max-width:900px;">
        <button class="employee-modal-close" id="closeAllEmployeesModal"><i class="fas fa-times"></i></button>
        <h2><i class="fas fa-users"></i> All Employees</h2>
        <div class="employee-cards-grid">
          ${employees.map(emp => `
            <div class="employee-card">
              <div class="employee-photo">
                <img src="${emp.photoUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp.firstName + ' ' + emp.lastName)}" alt="${emp.firstName || ''} ${emp.lastName || ''}">
              </div>
              <div class="employee-info">
                <div class="employee-name">${emp.firstName || ''} ${emp.lastName || ''}</div>
                <div class="employee-department"><i class="fas fa-building"></i> ${emp.department?.name || ''}</div>
                <div class="employee-mobile"><i class="fas fa-phone"></i> ${emp.phone || '-'}</div>
                <div class="employee-email"><i class="fas fa-envelope"></i> ${emp.email || '-'}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    // Close on button click
    document.getElementById('closeAllEmployeesModal').onclick = () => modal.remove();
    // Close on overlay click (but not when clicking inside modal content)
    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.remove();
    });
  }
  document.getElementById('removeEmployeeBtn').onclick = () => showRemoveEmployeeModal();

  // Modal for removing employees
  async function showRemoveEmployeeModal() {
      // Remove any existing modal
      const old = document.getElementById('removeEmployeeModal');
      if (old) old.remove();
      // Fetch employees
      let employees = [];
      try {
        const res = await fetch(`${API_BASE}/api/employees`, { headers: { 'Content-Type':'application/json', ...authHeaders() }});
        if (res.ok) employees = await res.json();
      } catch (err) { /* ignore */ }
      const modal = document.createElement('div');
      modal.id = 'removeEmployeeModal';
      modal.className = 'employee-modal-overlay';
      modal.innerHTML = `
        <div class="employee-modal-content" style="max-width:700px;">
          <button class="employee-modal-close" id="closeRemoveEmployeeModal"><i class="fas fa-times"></i></button>
          <h2><i class="fas fa-user-minus"></i> Remove Employee</h2>
          <div class="employee-remove-search-bar">
            <input type="text" id="removeEmployeeSearch" placeholder="Search by name, email, or department...">
          </div>
          <div class="employee-remove-list" id="removeEmployeeList">
            ${employees.map(emp => `
              <div class="employee-remove-item" data-id="${emp._id}">
                <div class="employee-remove-photo"><img src="${emp.photoUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp.firstName + ' ' + emp.lastName)}" alt="${emp.firstName || ''} ${emp.lastName || ''}"></div>
                <div class="employee-remove-info">
                  <div class="employee-remove-name">${emp.firstName || ''} ${emp.lastName || ''}</div>
                  <div class="employee-remove-department">${emp.department?.name || ''}</div>
                  <div class="employee-remove-email">${emp.email || ''}</div>
                  <div class="employee-remove-phone">${emp.phone || ''}</div>
                </div>
                <button class="employee-remove-btn" data-id="${emp._id}"><i class="fas fa-trash"></i> Delete</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      // Close handlers
      document.getElementById('closeRemoveEmployeeModal').onclick = () => modal.remove();
      modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
      // Search filter
      document.getElementById('removeEmployeeSearch').oninput = function(e) {
        const val = e.target.value.toLowerCase();
        document.querySelectorAll('.employee-remove-item').forEach(item => {
          const text = item.innerText.toLowerCase();
          item.style.display = text.includes(val) ? '' : 'none';
        });
      };
      // Delete handler (demo only)
      document.querySelectorAll('.employee-remove-btn').forEach(btn => {
        btn.onclick = async function() {
          const id = btn.getAttribute('data-id');
          if (!confirm('Are you sure you want to delete this employee?')) return;
          try {
            const res = await fetch(`${API_BASE}/api/employees/${id}`, {
              method: 'DELETE',
              headers: { 'Content-Type':'application/json', ...authHeaders() }
            });
            if (res.ok) {
              btn.closest('.employee-remove-item').remove();
              showAdminLeaveConfirmation('Employee removed!', true);
            } else {
              alert('Failed to delete employee');
            }
          } catch (err) {
            alert('Server error');
          }
        };
      });
  }
}

// Show Add Admin Modal (moved outside loadQuickActions for clarity and to fix block structure)
function showAddAdminModal() {
  // Remove any existing modal
  const old = document.getElementById('addAdminModal');
  if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'addAdminModal';
  modal.className = 'employee-modal-overlay';
  modal.innerHTML = `
    <div class="employee-modal-content">
      <button class="employee-modal-close" id="closeAddAdminModal"><i class="fas fa-times"></i></button>
      <h2><i class="fas fa-user-shield"></i> Add New Admin</h2>
      <form id="addAdminForm" class="employee-form">
        <div class="employee-form-group">
          <label for="adminName">Full Name</label>
          <input type="text" id="adminName" name="adminName" required autocomplete="off">
        </div>
        <div class="employee-form-group">
          <label for="adminEmail">Email</label>
          <input type="email" id="adminEmail" name="adminEmail" required autocomplete="off">
        </div>
        <div class="employee-form-group">
          <label for="adminId">Login ID</label>
          <input type="text" id="adminId" name="adminId" required autocomplete="off">
        </div>
        <div class="employee-form-group">
          <label for="adminPassword">Password</label>
          <input type="password" id="adminPassword" name="adminPassword" required autocomplete="off">
        </div>
        <div class="employee-form-group">
          <label for="adminMobile">Mobile</label>
          <input type="tel" id="adminMobile" name="adminMobile" required autocomplete="off">
        </div>
        <button type="submit" class="submit-btn">Add Admin</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('closeAddAdminModal').onclick = () => modal.remove();
  document.getElementById('addAdminForm').onsubmit = async function(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.adminName.value.trim();
    const email = form.adminEmail.value.trim();
    const empId = form.adminId.value.trim();
    const password = form.adminPassword.value.trim();
    const phone = form.adminMobile.value.trim();
    if (!name || !email || !empId || !password || !phone) {
      alert('Please fill all fields');
      return;
    }
    // Split name into first and last (simple split)
    let firstName = name, lastName = '';
    if (name.includes(' ')) {
      const parts = name.split(' ');
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    }
    try {
      const res = await fetch(`${API_BASE}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', ...authHeaders() },
        body: JSON.stringify({
          empId,
          password,
          firstName,
          lastName,
          email,
          phone,
          role: 'admin'
        })
      });
      if (res.ok) {
        modal.remove();
        showAdminLeaveConfirmation('Admin added successfully!', true);
        // Optionally reload admin list or UI
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to add admin');
      }
    } catch (err) {
      console.error('Add admin error', err);
      alert('Server error');
    }
  };
}

/* SETTINGS placeholder */
function loadSettings() {
  const sec = document.getElementById('settings');
  if (!sec) return;
  sec.innerHTML = `
    <div class="dashboard-content settings-section">
      <h1><i class="fas fa-cog"></i> Settings</h1>
      <div class="settings-options-grid">
        <div class="settings-option-card">
          <div class="settings-option-icon"><i class="fas fa-key"></i></div>
          <div class="settings-option-title">Change Password</div>
          <div class="settings-option-desc">Update your account password securely.</div>
          <button class="settings-action-btn" id="changePasswordBtn"><i class="fas fa-key"></i> Change Password</button>
        </div>
        <div class="settings-option-card">
          <div class="settings-option-icon"><i class="fas fa-sign-out-alt"></i></div>
          <div class="settings-option-title">Logout</div>
          <div class="settings-option-desc">Sign out of your admin account securely.</div>
          <button class="settings-action-btn logout-btn" id="settingsLogoutBtn"><i class="fas fa-sign-out-alt"></i> Logout</button>
        </div>
        <div class="settings-option-card">
          <div class="settings-option-icon"><i class="fas fa-cogs"></i></div>
          <div class="settings-option-title">Other Settings</div>
          <div class="settings-option-desc">More options coming soon.</div>
          <button class="settings-action-btn" disabled><i class="fas fa-cogs"></i> Coming Soon</button>
        </div>
      </div>
    </div>
    <div id="logoutModal" class="settings-modal-overlay" style="display:none;">
      <div class="settings-modal-content">
        <button class="settings-modal-close" id="closeLogoutModal">&times;</button>
        <div class="settings-modal-icon"><i class="fas fa-sign-out-alt"></i></div>
        <h2>Confirm Logout</h2>
        <p>Are you sure you want to logout?</p>
        <div class="settings-modal-actions">
          <button class="settings-action-btn" id="confirmLogoutBtn"><i class="fas fa-check"></i> Yes, Logout</button>
          <button class="settings-action-btn" id="cancelLogoutBtn"><i class="fas fa-times"></i> Cancel</button>
        </div>
      </div>
    </div>
    <div id="changePasswordModal" class="settings-modal-overlay" style="display:none;">
      <div class="settings-modal-content">
        <button class="settings-modal-close" id="closeChangePasswordModal">&times;</button>
        <div class="settings-modal-icon"><i class="fas fa-key"></i></div>
        <h2>Change Password</h2>
        <form id="changePasswordForm" class="settings-form">
          <div class="settings-form-group">
            <label for="currentPassword">Current Password</label>
            <input type="password" id="currentPassword" name="currentPassword" required autocomplete="off">
          </div>
          <div class="settings-form-group">
            <label for="newPassword">New Password</label>
            <input type="password" id="newPassword" name="newPassword" required autocomplete="off">
          </div>
          <div class="settings-form-group">
            <label for="confirmPassword">Confirm New Password</label>
            <input type="password" id="confirmPassword" name="confirmPassword" required autocomplete="off">
          </div>
          <button type="submit" class="settings-action-btn"><i class="fas fa-save"></i> Update Password</button>
        </form>
      </div>
    </div>
  `;

  // Logout modal logic
  const logoutBtn = document.getElementById('settingsLogoutBtn');
  const logoutModal = document.getElementById('logoutModal');
  const closeLogoutModal = document.getElementById('closeLogoutModal');
  const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
  const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
  if (logoutBtn && logoutModal) {
    logoutBtn.onclick = () => { logoutModal.style.display = 'flex'; };
  }
  if (closeLogoutModal) closeLogoutModal.onclick = () => { logoutModal.style.display = 'none'; };
  if (cancelLogoutBtn) cancelLogoutBtn.onclick = () => { logoutModal.style.display = 'none'; };
  if (confirmLogoutBtn) confirmLogoutBtn.onclick = () => {
    localStorage.removeItem('nxt_token');
    localStorage.removeItem('nxt_user');
    window.location = './index.html';
  };

  // Change password modal logic
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  const changePasswordModal = document.getElementById('changePasswordModal');
  const closeChangePasswordModal = document.getElementById('closeChangePasswordModal');
  if (changePasswordBtn && changePasswordModal) {
    changePasswordBtn.onclick = () => { changePasswordModal.style.display = 'flex'; };
  }
  if (closeChangePasswordModal) closeChangePasswordModal.onclick = () => { changePasswordModal.style.display = 'none'; };
  const changePasswordForm = document.getElementById('changePasswordForm');

  if (changePasswordForm) {
    changePasswordForm.onsubmit = function(e) {
      e.preventDefault();
      // TODO: Implement backend API call for password change
      changePasswordModal.style.display = 'none';
      alert('Password change functionality coming soon!');
    };
  }
}
