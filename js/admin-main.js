// js/admin-main.js

// Ensure API_BASE_URL and LOGIN_PAGE_URL are available (e.g., from admin-utils.js or defined here)
// Ensure contentArea is available
// Ensure showAlert and showConfirm are available (from admin-modals.js)

document.addEventListener('DOMContentLoaded', function() {
    setupSidebarListeners();
    checkAdminLoginAndLoadDashboard();
});

function setupSidebarListeners() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) {
        console.error("Sidebar element not found!");
        return;
    }
    sidebar.addEventListener('click', function(event) {
        let targetLink = event.target.closest('a[data-action]');

        if (targetLink && targetLink.dataset.action) {
            event.preventDefault();
            const action = targetLink.dataset.action;
            
            sidebar.querySelectorAll('a.active').forEach(el => el.classList.remove('active'));
            targetLink.classList.add('active');
            
            const parentLi = targetLink.closest('ul.sub-menu')?.closest('li');
            if(parentLi) parentLi.querySelector('a')?.classList.add('active');

            // Instead of window[action], use a more controlled dispatch
            dispatchAction(action);
        }
    });
}

function dispatchAction(actionName, params = null) {
    // This is a simple dispatcher. For more complex apps, consider a router.
    // Ensure the target functions are globally available or exposed by their modules.
    if (typeof window[actionName] === 'function') {
        if (params) window[actionName](params); // Pass params if any (e.g., for editing an item)
        else window[actionName]();
    } else {
        console.warn(`Action function ${actionName} not found.`);
        if (contentArea) contentArea.innerHTML = `<div class="content-section"><h2>错误</h2><p>请求的功能 '${actionName}' 未定义。</p></div>`;
    }
}


async function checkAdminLoginAndLoadDashboard() {
    console.log("Verifying admin status...");
    showLoading(); // Assumes showLoading is defined in admin-utils.js or globally
    try {
        // Using apiCall utility if available
        const data = await apiCall('/api/user', 'GET'); // apiCall from admin-utils.js

        if (data && data.success && data.user && data.user.role === 'admin') {
            console.log('Admin login verified.');
            dispatchAction('showDashboard'); 
        } else {
            showAlert('访问被拒绝，您不是管理员或会话已过期。', '权限错误', 'error');
            setTimeout(() => window.location.href = LOGIN_PAGE_URL, 2000);
        }
    } catch (error) {
        console.error('Error during admin check:', error);
        showAlert(`验证管理员状态时发生错误：${error.message}`, '网络错误', 'error');
        setTimeout(() => window.location.href = LOGIN_PAGE_URL, 2000);
    }
}

// Logout function (belongs in main control logic)
async function logoutUser() { // Renamed from 'logout' to avoid conflict with potential window.logout
    showConfirm('确定要退出登录吗？', (confirmed) => {
        if(confirmed) {
            showAlert('您已安全退出。', '已登出');
            // Optional: Call a backend logout endpoint if you implement one to invalidate session/cookie
            // await apiCall('/api/logout', 'POST'); 
            setTimeout(() => window.location.href = LOGIN_PAGE_URL, 1500);
        }
    }, '退出确认');
}