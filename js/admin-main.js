// js/admin-main.js

let currentUserRole = null; // <--- 新增全局变量存储用户角色

// Ensure necessary globals from admin-utils.js and admin-modals.js are loaded first.
// For example: API_BASE_URL, LOGIN_PAGE_URL, contentArea, showLoading, apiCall, showAlert, showConfirm

document.addEventListener('DOMContentLoaded', function() {
    // Check if essential elements and globals are present
    if (typeof contentArea === 'undefined' || !contentArea) {
        console.error("CRITICAL: contentArea element is not defined or not found. Aborting admin panel initialization.");
        document.body.innerHTML = "<p style='color:red; font-size:1.5em; text-align:center; padding:50px;'>管理后台初始化失败：关键 DOM 元素丢失。</p>";
        return;
    }
    if (typeof API_BASE_URL === 'undefined' || typeof LOGIN_PAGE_URL === 'undefined') {
        console.error("CRITICAL: API_BASE_URL or LOGIN_PAGE_URL is not defined. Aborting.");
        showAlert("管理后台配置错误，无法连接到服务器。", "配置错误", "error");
        return;
    }

    setupSidebarListeners();
    checkAdminLoginAndLoadInitialView();
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
            
            // Manage active class for sidebar links
            sidebar.querySelectorAll('a.active').forEach(el => el.classList.remove('active'));
            targetLink.classList.add('active');
            
            // If it's a sub-menu item, also keep its parent menu item active
            const parentLi = targetLink.closest('ul.sub-menu')?.closest('li');
            if (parentLi) {
                const parentAnchor = parentLi.querySelector('a');
                if (parentAnchor) parentAnchor.classList.add('active');
            }

            dispatchAction(action);
        }
    });
}

async function checkAdminLoginAndLoadInitialView() {
    console.log("Verifying admin status...");
    if (typeof showLoading === 'function') showLoading(); // showLoading from admin-utils.js
    else if (contentArea) contentArea.innerHTML = '<p>正在加载...</p>';


    try {
        // apiCall is assumed to be defined in admin-utils.js
        const data = await apiCall('/api/user', 'GET'); 

        if (data && data.success && data.user && data.user.role === 'admin') {
            console.log('Admin login verified.');
            currentUserRole = data.user.role; // <--- 存储角色
            dispatchAction('showDashboard'); 
        } else if (data && data.success && data.user) { // 用户已登录但不是管理员
             currentUserRole = data.user.role;
             showAlert('您已登录，但没有管理员权限访问此后台。', '权限不足', 'error');
             // 可以选择重定向到用户首页或只显示一个错误信息
             contentArea.innerHTML = `<div class="content-section"><h2>权限不足</h2><p>您没有权限访问此管理后台。</p></div>`;
             // 如果有用户可以访问的有限功能，可以在这里处理
        } else {
            let errorMessage = '访问被拒绝。';
            if (data && data.message) {
                errorMessage += ` ${data.message}`;
            } else if (!data?.success) {
                errorMessage += ' 会话无效或已过期。';
            } else if (data?.user?.role !== 'admin') {
                errorMessage += ' 您不是管理员。';
            }
            showAlert(errorMessage, '权限错误', 'error');
            setTimeout(() => {
                if (typeof LOGIN_PAGE_URL !== 'undefined') window.location.href = LOGIN_PAGE_URL;
            }, 2500);
        }
    } catch (error) {
        console.error('Error during admin check or initial load:', error);
        showAlert(`验证管理员状态时发生错误：${error.message || '未知网络错误'}`, '网络错误', 'error');
        setTimeout(() => {
             if (typeof LOGIN_PAGE_URL !== 'undefined') window.location.href = LOGIN_PAGE_URL;
        }, 2500);
    }
}

function dispatchAction(actionName, params = null) {
    console.log(`Dispatching action: ${actionName}`, params || '');
    
    // 前置权限检查 (可选，因为 API 后端会再次校验，但可以改善前端体验)
    // 例如，某些 action 只允许管理员执行
    const adminOnlyActions = ['showBlogPostsList', 'showBlogPostForm', 'showBlogTopicsAdmin', /* ...其他管理员专属 action */ ];
    if (adminOnlyActions.includes(actionName) && currentUserRole !== 'admin') {
        showAlert('您没有权限执行此操作。', '权限不足', 'error');
        if (contentArea && !contentArea.querySelector('h2')?.textContent.includes('权限不足')) { // 避免重复渲染权限不足消息
            contentArea.innerHTML = `<div class="content-section"><h2>权限不足</h2><p>您没有权限访问此功能。</p></div>`;
        }
        return; // 阻止进一步操作
    }
    
    if (typeof window[actionName] === 'function') {
        // Clear previous content and show loading (optional, module functions can also do this)
        // if (typeof showLoading === 'function') showLoading();
        // else if (contentArea) contentArea.innerHTML = ''; // Basic clear

        if (params) {
            window[actionName](params);
        } else {
            window[actionName]();
        }
    } else {
        console.warn(`Action function "${actionName}" not found.`);
        if (contentArea) {
            contentArea.innerHTML = `
                <div class="content-section">
                    <h2><i class="fas fa-exclamation-triangle"></i> 功能未找到</h2>
                    <p>请求的后台功能 (<code>${actionName}</code>) 当前不可用或未定义。</p>
                    <p>请检查脚本是否正确加载，或联系管理员。</p>
                </div>`;
        }
        if (typeof showAlert === 'function') {
            showAlert(`请求的功能 "${actionName}" 未找到。`, '功能错误', 'error');
        }
    }
}

// Logout function
async function logoutUser() {
    showConfirm('确定要退出登录吗？', (confirmed) => {
        if(confirmed) {
            // Optional: Call a backend /api/logout endpoint if you have one
            // This endpoint would ideally clear the HttpOnly session cookie by setting its expiry to the past.
            // Example:
            // apiCall('/api/logout', 'POST').then(() => {
            //     showAlert('您已安全退出。', '已登出');
            //     setTimeout(() => window.location.href = LOGIN_PAGE_URL, 1500);
            // }).catch(err => {
            //     console.error("Logout API call failed:", err);
            //     showAlert('退出时发生错误，但仍会尝试跳转到登录页。', '退出错误', 'error');
            //     setTimeout(() => window.location.href = LOGIN_PAGE_URL, 1500);
            // });

            // For now, simple frontend redirect after confirmation
            showAlert('您已安全退出。', '已登出');
            setTimeout(() => {
                if (typeof LOGIN_PAGE_URL !== 'undefined') window.location.href = LOGIN_PAGE_URL;
            }, 1500);
        }
    }, '退出确认');
}


// --- Navigation Helper Functions (called by data-action in HTML via dispatchAction) ---
// These now primarily act as aliases or direct calls if the module functions are global.
// The main purpose is to have clear, named actions in data-action attributes.

// Dashboard
function navigateToDashboard() { dispatchAction('showDashboard'); }

// Book Management
function navigateToBookManagement() { dispatchAction('showBookList'); } // Default to book list
function navigateToAddBookForm() { dispatchAction('showAddBookForm'); }
function navigateToBookList() { dispatchAction('showBookList'); }
function navigateToCategoryManagement() { dispatchAction('showCategoryManagement'); }

// Borrow Circulation
function navigateToBorrowCirculation() { dispatchAction('showBorrowedRecords'); } // Default to records
function navigateToBorrowBookForm() { dispatchAction('showBorrowBookForm'); }
function navigateToReturnBookForm() { dispatchAction('showReturnBookForm'); }
function navigateToBorrowedRecords() { dispatchAction('showBorrowedRecords'); }
function navigateToOverdueBooks() { dispatchAction('showOverdueBooks'); }

// User Management
function navigateToUserManagement() { dispatchAction('showUserList'); }
// Note: Add/Edit user forms are typically shown from within the user list view,
// so they might not need direct data-action navigation from the sidebar.
// If they do, you'd add:
// function navigateToAddUserForm() { dispatchAction('renderAddUserForm'); } // Assuming renderAddUserForm is global

// Site Settings
function navigateToSiteSettings() { dispatchAction('showSiteSettingsPage'); } // Assuming showSiteSettingsPage is global


// Blog Management Navigation
function navigateToBlogPostsList() { dispatchAction('showBlogPostsList'); }
function navigateToBlogPostForm(postId = null) { // postId 为 null 表示新建，否则为编辑
    dispatchAction('showBlogPostForm', { postId: postId }); 
}
function navigateToBlogTopicsAdmin() { dispatchAction('showBlogTopicsAdmin'); }

function navigateToBlogPostsListDefault() { dispatchAction('showBlogPostsList', { filters: {} }); } // 所有文章
function navigateToPendingReviewPosts() { dispatchAction('showBlogPostsList', { filters: { status: 'pending_review' } }); } // 待审核

// function navigateToBlogCommentsAdmin() { dispatchAction('showBlogCommentsAdmin'); } // 未来