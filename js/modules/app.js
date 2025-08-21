/*────────────────────────────────────────────
  js/modules/app.js
  Main application file (entry point).
  Responsible for initializing the application.
─────────────────────────────────────────────*/

import { state } from './state.js';
import { initSocketConnection } from './socket.js';
import { initEventListeners, handleAction, handleTabSwitch } from './handlers.js';
import { showNotification } from './utils.js';
import { initSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', () => {
  try {
    if (!initAuth()) return;
    initTheme();
    initSidebar();
    initSocketConnection();
    initEventListeners();

    // Determine the initial tab
    const savedTabId = localStorage.getItem('vipauto_active_tab') || 'home';
    const tabToActivate = document.querySelector(`.nav-link[data-tab="${savedTabId}"]`);

    if (tabToActivate && getComputedStyle(tabToActivate).display !== 'none') {
      state.activeTab = savedTabId;
    } else {
      state.activeTab = 'home';
    }
    // Manually trigger the first tab switch to render content
    handleTabSwitch(document.querySelector(`.nav-link[data-tab="${state.activeTab}"]`));


    // Global click handler for data-action and data-tab
    document.body.addEventListener('click', (e) => {
      const actionTarget = e.target.closest('[data-action]');
      const tabTarget = e.target.closest('.nav-link[data-tab]');

      if (tabTarget) {
        e.preventDefault(); // Prevent default anchor behavior
        handleTabSwitch(tabTarget);
      }
      if (actionTarget) {
        handleAction(actionTarget);
      }
    });

  } catch (error) {
    console.error("CRITICAL ERROR:", error);
    logout();
  }
});

function initAuth() {
  state.token = localStorage.getItem('vipauto_token') || sessionStorage.getItem('vipauto_token');
  const userDataString = localStorage.getItem('vipauto_user') || sessionStorage.getItem('vipauto_user');

  if (!state.token || !userDataString) {
    logout();
    return false;
  }

  try {
    state.user = JSON.parse(userDataString);
    const user = state.user;
    // Populate sidebar user info
    document.getElementById('user-name-display').textContent = user.name;
    const roleDisplay = document.getElementById('user-role-display');
    if(roleDisplay) roleDisplay.textContent = user.role;

    const userAvatar = document.getElementById('user-avatar');
    if(userAvatar) userAvatar.textContent = user.name.charAt(0);

    document.body.classList.toggle('is-privileged', user.role === 'DIRECTOR' || user.role === 'SENIOR_MASTER');
  } catch(e) {
    logout();
    return false;
  }
  return true;
}

function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('vipauto_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (themeToggle) {
    themeToggle.checked = savedTheme === 'light';
    themeToggle.addEventListener('change', (e) => {
      const newTheme = e.target.checked ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('vipauto_theme', newTheme);
    });
  }
}

export function logout() {
  localStorage.clear();
  sessionStorage.clear();
  if (state.socket) state.socket.disconnect();
  window.location.replace('login.html');
}
