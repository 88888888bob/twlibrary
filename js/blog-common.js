// js/blog-common.js

const BLOG_API_BASE_URL = 'https://twapi.bob666.eu.org/api'; // 或者你的 API 地址
const ITEMS_PER_PAGE = 10; // 默认每页文章数

// 简单的 API 调用函数 (可以从 admin-utils.js 复制或改进)
async function blogApiCall(endpoint, method = 'GET', body = null, requiresAuth = false) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };
    if (requiresAuth) { // 检查是否需要发送凭证
        options.credentials = 'include'; // 用于发送 Cookie
    }
    if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${BLOG_API_BASE_URL}${endpoint}`, options);
        if (!response.ok) {
            let errorData;
            try { errorData = await response.json(); } catch (e) { errorData = { message: `HTTP error! Status: ${response.status}` }; }
            console.error(`API call to ${endpoint} failed:`, response.status, errorData);
            throw new Error(errorData.message || `Request failed with status ${response.status}`);
        }
        if (response.status === 204) return { success: true }; // No content
        return await response.json();
    } catch (error) {
        console.error(`Network or parsing error for ${endpoint}:`, error);
        throw error; // Re-throw for a_page_specific_handler to catch
    }
}

// 渲染分页控件 (与 admin 端类似，可复用或微调)
function renderBlogPagination(paginationData, containerElement, onPageChangeCallback) {
    if (!paginationData || paginationData.totalPages <= 1) {
        containerElement.innerHTML = "";
        return;
    }
    let html = '<ul>';
    // Prev button
    html += `<li class="page-item ${paginationData.hasPrevPage ? '' : 'disabled'}">
               <a class="page-link" href="#" data-page="${paginationData.currentPage - 1}" aria-label="Previous">
                 <span aria-hidden="true">«</span>
               </a>
             </li>`;

    // Page numbers
    const maxPagesToShow = 5;
    let startPage = Math.max(1, paginationData.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(paginationData.totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage + 1 < maxPagesToShow && paginationData.totalPages >= maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    if (startPage > 1) {
        html += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
        if (startPage > 2) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<li class="page-item ${i === paginationData.currentPage ? 'active' : ''}">
                   <a class="page-link" href="#" data-page="${i}">${i}</a>
                 </li>`;
    }

    if (endPage < paginationData.totalPages) {
        if (endPage < paginationData.totalPages - 1) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        html += `<li class="page-item"><a class="page-link" href="#" data-page="${paginationData.totalPages}">${paginationData.totalPages}</a></li>`;
    }

    // Next button
    html += `<li class="page-item ${paginationData.hasNextPage ? '' : 'disabled'}">
               <a class="page-link" href="#" data-page="${paginationData.currentPage + 1}" aria-label="Next">
                 <span aria-hidden="true">»</span>
               </a>
             </li>`;
    html += '</ul>';
    containerElement.innerHTML = html;

    containerElement.querySelectorAll('a[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            if (e.currentTarget.parentElement.classList.contains('disabled')) return;
            const page = parseInt(e.currentTarget.dataset.page);
            if (page) onPageChangeCallback(page);
        });
    });
}

// 简单的 HTML 转义函数 (可以从 admin-utils.js 复制)
function escapeHTML(unsafe) {
    if (typeof unsafe !== 'string') {
        if (unsafe === null || unsafe === undefined) {
            return ''; // Return empty string for null or undefined
        }
        try {
            // Attempt to convert other types to string
            unsafe = String(unsafe);
        } catch (e) {
            console.warn("escapeHTML: Failed to convert value to string", unsafe, e);
            return ''; // Fallback to empty string if conversion fails
        }
    }
    return unsafe.replace(/[&<>"']/g, function (match) {
        switch (match) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case "'":
                return '&#039;'; // or &apos; but &#039; is more widely compatible
            default:
                return match; // Should not happen with the regex given
        }
    });
}

// 检查用户登录状态 (简化版，实际可能更复杂，例如从 localStorage 读 token 或调用/api/user)
async function checkUserLoginStatus() {
    try {
        const response = await blogApiCall('/user', 'GET', null, true); // Assumes /user endpoint exists and requires auth
        return response.success ? response.user : null;
    } catch (error) {
        // If 401 or other error, assume not logged in for public pages
        console.info("User not logged in or session expired for public view enhancements.");
        return null;
    }
}

// 更新导航栏登录链接和“写新文章”按钮的可见性
function updateUserNav(user) {
    const loginLink = document.getElementById('navLoginLink');
    const writePostBtn = document.getElementById('writeNewPostBtn');

    if (user && loginLink) {
        loginLink.textContent = `${escapeHTML(user.username)} (登出)`;
        loginLink.href = "#logout"; // Placeholder, actual logout needs JS
        loginLink.onclick = (e) => { 
            e.preventDefault(); 
            // Implement actual logout (e.g., call API, clear local session, redirect)
            alert('登出功能待实现'); 
            // localStorage.removeItem('authToken'); window.location.reload();
        };
        if (writePostBtn) writePostBtn.style.display = 'inline-block';
    } else {
        if (loginLink) {
            loginLink.textContent = '登录/注册';
            loginLink.href = 'sign_up_login_page.html';
            loginLink.onclick = null; // Remove any previous onclick
        }
        if (writePostBtn) writePostBtn.style.display = 'none';
    }
}

// 更新当前年份
function updateCopyrightYear() {
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
}

async function checkUserLoginStatus() {
    try {
        // 假设 /api/user 返回 { success: true, user: { id, username, role } } 或错误
        const response = await blogApiCall('/user', 'GET', null, true); // API 路径可能是 /api/user
        if (response.success && response.user) {
            console.log("User logged in:", response.user);
            return response.user;
        }
        console.log("User not logged in or session invalid:", response.message);
        return null;
    } catch (error) {
        // apiCall 应该已经 console.error 了
        console.info("checkUserLoginStatus: Error during API call, assuming user not logged in.");
        return null;
    }
}


function formatUtcToLocalDateCommon(utcDateTimeString, dateOnly = false, options = null) {
    // ... (与 admin-utils.js 中的实现相同或类似)
    if (!utcDateTimeString) return '-';
    try {
        let isoString = String(utcDateTimeString).replace(' ', 'T');
        if (!isoString.endsWith('Z') && !isoString.includes('+') && !isoString.includes('-')) isoString += 'Z';
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return utcDateTimeString;
        if (dateOnly) return date.toLocaleDateString(navigator.language || 'zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
        return date.toLocaleString(navigator.language || 'zh-CN', options || { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return utcDateTimeString; }
}
