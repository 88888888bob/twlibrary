// js/admin-dashboard.js
// Assumes API_BASE_URL, contentArea, (optionally showAlert for other errors), showLoading, apiCall are globally available

// --- Navigation entry point for this module (called by admin-main.js) ---
function showDashboard() { // This is the main function called by data-action
    renderDashboardUI();
    loadDashboardData();
}

// --- Dashboard UI Rendering ---
function renderDashboardUI() {
    if (!contentArea) {
        console.error("contentArea not found for dashboard");
        return;
    }
    contentArea.innerHTML = `
        <div class="content-section">
            <h2><i class="fas fa-tachometer-alt"></i> 仪表盘</h2>
            <div class="dashboard">
                <div class="dashboard-item"><h3>图书总数</h3><p id="totalBooksCount">--</p></div>
                <div class="dashboard-item"><h3>用户总数</h3><p id="totalUsersCount">--</p></div>
                <div class="dashboard-item"><h3>当前借出</h3><p id="currentBorrowsCount">--</p></div>
                <div class="dashboard-item"><h3>逾期数量</h3><p id="overdueBorrowsCount">--</p></div>
                <div class="dashboard-item"><h3>最近 7 天新增用户</h3><p id="newUsersLast7DaysCount">--</p></div>
                <div class="dashboard-item clickable" id="pendingPostsItem" onclick="navigateToPendingReviewPosts()">
                    <h3><i class="fas fa-user-clock"></i> 待审核文章</h3>
                    <p id="pendingReviewPostsCount">--</p>
                </div>
            </div>
        </div>`;
}

// --- Dashboard Data Loading ---
async function loadDashboardData() {
    const totalBooksElem = document.getElementById('totalBooksCount');
    const totalUsersElem = document.getElementById('totalUsersCount');
    const currentBorrowsElem = document.getElementById('currentBorrowsCount');
    const overdueBorrowsElem = document.getElementById('overdueBorrowsCount');
    const newUsersLast7DaysElem = document.getElementById('newUsersLast7DaysCount');
    const pendingReviewPostsElem = document.getElementById('pendingReviewPostsCount');

    // Set to loading or keep default '--'
    if(totalBooksElem) totalBooksElem.textContent = '...';
    if(totalUsersElem) totalUsersElem.textContent = '...';
    if(currentBorrowsElem) currentBorrowsElem.textContent = '...';
    if(overdueBorrowsElem) overdueBorrowsElem.textContent = '...';
    if(newUsersLast7DaysElem) newUsersLast7DaysElem.textContent = '...';
    if(pendingReviewPostsElem) pendingReviewPostsElem.textContent = '...';

    try {
        // Use a single API call to fetch all stats
        const data = await apiCall('/api/admin/stats'); // Assumes apiCall is defined in admin-utils.js

        if (data.success && data.stats) {
            const stats = data.stats;
            if (totalBooksElem) totalBooksElem.textContent = stats.totalBooks ?? '--';
            if (totalUsersElem) totalUsersElem.textContent = stats.totalUsers ?? '--';
            if (currentBorrowsElem) currentBorrowsElem.textContent = stats.currentBorrows ?? '--';
            if (overdueBorrowsElem) overdueBorrowsElem.textContent = stats.overdueBorrows ?? '--';
            if (newUsersLast7DaysElem) newUsersLast7DaysElem.textContent = stats.newUsersLast7Days ?? '--';
            if (pendingReviewPostsElem) pendingReviewPostsElem.textContent = stats.pendingReviewPosts ?? '--';
            // 如果数量大于 0，可以给待审核项加个醒目提示，例如改变父元素背景
            const pendingPostsItem = document.getElementById('pendingPostsItem');
            if (pendingPostsItem && stats.pendingReviewPosts > 0) {
                pendingPostsItem.classList.add('has-pending'); // CSS 可以定义 .has-pending 样式
            } else if (pendingPostsItem) {
                pendingPostsItem.classList.remove('has-pending');
            }
        } else {
            // If API call was successful but data.success is false, or stats object is missing
            console.warn("Failed to retrieve some or all dashboard stats:", data.message);
            // Set to '--' if specific stats are missing
            if (totalBooksElem) totalBooksElem.textContent = data.stats?.totalBooks ?? '--';
            if (totalUsersElem) totalUsersElem.textContent = data.stats?.totalUsers ?? '--';
            if (currentBorrowsElem) currentBorrowsElem.textContent = data.stats?.currentBorrows ?? '--';
            if (overdueBorrowsElem) overdueBorrowsElem.textContent = data.stats?.overdueBorrows ?? '--';
            if (newUsersLast7DaysElem) newUsersLast7DaysElem.textContent = data.stats?.newUsersLast7Days ?? '--';
        }
    } catch (error) {
        console.error("Error loading dashboard data:", error);
        // On network error or other exceptions, set all to '--'
        if (totalBooksElem) totalBooksElem.textContent = '--';
        if (totalUsersElem) totalUsersElem.textContent = '--';
        if (currentBorrowsElem) currentBorrowsElem.textContent = '--';
        if (overdueBorrowsElem) overdueBorrowsElem.textContent = '--';
        if (newUsersLast7DaysElem) newUsersLast7DaysElem.textContent = '--';
        // Optionally, log to console or a silent error reporting system, but don't showAlert
        // showAlert(`加载仪表盘数据时发生严重错误：${error.message}`, '错误', 'error');
    }
}