/* ---------------------------------- */
/* Sidebar Logic
/* ---------------------------------- */

const SIDEBAR_STATE_KEY = 'vipauto_sidebar_state';

function initSidebar() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (!sidebarToggle) {
        console.warn('Sidebar toggle button not found.');
        return;
    }

    // Set initial state from localStorage
    const savedState = localStorage.getItem(SIDEBAR_STATE_KEY) || 'expanded';
    document.documentElement.setAttribute('data-sidebar-state', savedState);

    sidebarToggle.addEventListener('click', () => {
        toggleSidebar();
    });
}

function toggleSidebar() {
    const currentState = document.documentElement.getAttribute('data-sidebar-state');
    const newState = currentState === 'collapsed' ? 'expanded' : 'collapsed';

    document.documentElement.setAttribute('data-sidebar-state', newState);
    localStorage.setItem(SIDEBAR_STATE_KEY, newState);
}

export { initSidebar };
