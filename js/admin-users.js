// js/admin-users.js
// Assumes API_BASE_URL, contentArea, showAlert, showConfirm, showLoading, dispatchAction, apiCall, escapeHtml, renderPagination are globally available

// --- Globals for this module ---\
// let currentUserListData = []; // No longer needed for all data
let currentUserPage = 1;
const USERS_PER_PAGE = 15;
let currentUserFilters = { search: '', role: '' };

// --- Navigation entry point for this module ---\
function showUserList() { 
    currentUserPage = 1;
    currentUserFilters = { search: '', role: '' };
    loadUserListFrameworkAndFetchData();
}

// --- User List Logic ---\
function loadUserListFrameworkAndFetchData() {
    console.log("[AdminUsers] Initializing user list framework.");
    showLoading();
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;
    contentArea.innerHTML = `
        <div class="content-section">
            <h2><i class="fas fa-users-cog"></i> 用户管理</h2>
            <div class="user-list-header list-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;">
                <button class="btn-add" onclick="renderAddUserForm()"><i class="fas fa-user-plus"></i> 添加用户</button>
                <div style="display:flex; gap:10px; align-items:center;">
                    <div class="search-container">
                        <input type="text" id="userSearchInputAdmin" placeholder="搜索用户名或邮箱..." value="${esc(currentUserFilters.search || '')}" onkeyup="handleUserAdminSearchInput(event)">
                        <button class="btn-search" onclick="applyUserAdminSearchFilter()"><i class="fas fa-search"></i> 搜索</button>
                        <button class="btn-cancel" onclick="clearUserAdminSearchFilter()" title="清除搜索"><i class="fas fa-times"></i></button>
                    </div>
                    <select id="userRoleFilter" class="form-control" style="padding:8px 12px; width:auto;" onchange="applyUserAdminRoleFilter()">
                        <option value="">所有角色</option>
                        <option value="student" ${currentUserFilters.role === 'student' ? 'selected' : ''}>学生 (Student)</option>
                        <option value="teacher" ${currentUserFilters.role === 'teacher' ? 'selected' : ''}>教师 (Teacher)</option>
                        <option value="admin" ${currentUserFilters.role === 'admin' ? 'selected' : ''}>管理员 (Admin)</option>
                    </select>
                </div>
            </div>
            <div id="userListContainer"><div class="loading-placeholder"><p>正在准备列表...</p></div></div>
            <div id="userPaginationContainer"></div>
        </div>`;

    document.getElementById('userSearchInputAdmin')?.addEventListener('keyup', event => {
        if (event.key === "Enter") applyUserAdminSearchFilter();
    });

    fetchAndRenderUsers();
}

function handleUserAdminSearchInput(event) {
    if (event.key === "Enter") applyUserAdminSearchFilter();
}

function applyUserAdminSearchFilter() {
    const searchInput = document.getElementById('userSearchInputAdmin');
    currentUserFilters.search = searchInput ? searchInput.value.trim() : '';
    currentUserPage = 1;
    console.log(`[AdminUsers] Applying search filter: '${currentUserFilters.search}'`);
    fetchAndRenderUsers();
}

function clearUserAdminSearchFilter() {
    currentUserFilters.search = '';
    const searchInput = document.getElementById('userSearchInputAdmin');
    if (searchInput) searchInput.value = '';
    currentUserPage = 1;
    console.log("[AdminUsers] Search filter cleared.");
    fetchAndRenderUsers();
}

function applyUserAdminRoleFilter() {
    const roleFilterSelect = document.getElementById('userRoleFilter');
    currentUserFilters.role = roleFilterSelect ? roleFilterSelect.value : '';
    currentUserPage = 1;
    console.log(`[AdminUsers] Applying role filter: '${currentUserFilters.role}'`);
    fetchAndRenderUsers();
}

async function fetchAndRenderUsers() {
    console.log(`[AdminUsers] Fetching users. Page: ${currentUserPage}, Filters:`, JSON.stringify(currentUserFilters)); // 使用 JSON.stringify
    const userListContainer = document.getElementById('userListContainer');
    const paginationContainer = document.getElementById('userPaginationContainer');

    if (!userListContainer || !paginationContainer) {
        console.error("[AdminUsers] Table or pagination container not found.");
        // 如果 showAlert 可用且合适，可以在这里提示用户界面错误
        // if (typeof showAlert === 'function') showAlert("用户列表界面组件丢失，无法加载数据。", "界面错误", "error");
        return;
    }
    showLoading(userListContainer);
    paginationContainer.innerHTML = '';

    // 直接使用 currentUserPage 和 USERS_PER_PAGE 构建查询参数
    const queryParams = new URLSearchParams({
        page: currentUserPage, // 使用模块内维护的当前页码
        limit: USERS_PER_PAGE  // 使用模块内定义的每页数量
    });

    if (currentUserFilters.search) {
        queryParams.append('search', currentUserFilters.search);
    }
    if (currentUserFilters.role) {
        queryParams.append('role', currentUserFilters.role);
    }

    const finalApiUrl = `/api/admin/users?${queryParams.toString()}`;
    console.log("[AdminUsers] Calling API with URL:", finalApiUrl);

    try {
        const response = await apiCall(finalApiUrl); // API 调用
        console.log("[AdminUsers] API Response RAW for users:", JSON.stringify(response));

        if (response && response.success && Array.isArray(response.data) && response.pagination) {
            console.log("[AdminUsers] Users data fetched successfully. Data length:", response.data.length);
            renderUserListTable(response.data);
            renderPagination(response.pagination, paginationContainer, (newPage) => {
                currentUserPage = newPage;
                fetchAndRenderUsers();
            });
        } else {
            let errorMessage = '无法加载用户列表';
            if (response && response.message) {
                errorMessage += `：${response.message}`;
            } else if (response && !response.success){
                 errorMessage += ' (API 调用未成功)';
            } else if (response && !Array.isArray(response.data)) {
                errorMessage += ' (API 返回数据格式不正确，缺少 data 数组)';
                console.error("[AdminUsers] API response.data is not an array:", response.data);
            } else if (response && !response.pagination) {
                 errorMessage += ' (API 返回数据格式不正确，缺少 pagination 对象)';
                 console.error("[AdminUsers] API response.pagination is missing:", response.pagination);
            } else {
                 errorMessage += ' (未知错误或数据为空)';
            }
            console.error("[AdminUsers] Error or invalid data from API:", errorMessage, "Full response:", response);
            if (userListContainer) userListContainer.innerHTML = `<p>${errorMessage}</p>`;
            if (typeof showAlert === 'function') showAlert(errorMessage, '错误', 'error');
        }
    } catch (error) {
        console.error("[AdminUsers] Error fetching user list (catch block):", error);
        if (userListContainer) userListContainer.innerHTML = `<p>加载用户列表时出错：${error.message}</p>`;
        if (typeof showAlert === 'function') showAlert(`加载用户列表出错：${error.message}`, '网络错误', 'error');
    }
}


// --- User List Logic ---
async function loadUserListLogic() {
    showLoading();
    contentArea.innerHTML = `
        <div class="content-section">
            <h2><i class="fas fa-users-cog"></i> 用户管理</h2>
            <div class="user-list-header list-header">
                <button class="btn-add" onclick="renderAddUserForm()"><i class="fas fa-user-plus"></i> 添加用户</button>
                <div class="search-container">
                    <input type="text" id="userSearchInput" placeholder="搜索用户名或邮箱..." onkeyup="handleUserSearchInput(event)">
                    <button class="btn-search" onclick="performUserClientSearch()"><i class="fas fa-search"></i> 搜索</button>
                </div>
            </div>
            <div id="userListContainer"></div>
        </div>`;
    try {
        const data = await apiCall('/api/admin/users');
        const container = document.getElementById('userListContainer');
        if (data.success && data.users) {
            currentUserListData = data.users;
            renderUserListTable(currentUserListData);
        } else { 
            if(container) container.innerHTML = '<p>无法加载用户列表或列表为空。</p>';
            showAlert(data.message || '加载用户列表失败', '错误', 'error');
        }
    } catch (error) { 
        console.error('Error fetching user list:', error); 
        const c = document.getElementById('userListContainer'); 
        if(c) c.innerHTML = `<p>加载用户列表时出错：${error.message}</p>`;
        showAlert(`加载用户列表出错：${error.message}`, '网络错误', 'error');
    }
}

function handleUserSearchInput(event) { 
    if (event.key === "Enter") performUserClientSearch(); 
}

function performUserClientSearch() {
    const searchTerm = document.getElementById('userSearchInput').value.toLowerCase().trim();
    if (!searchTerm) { renderUserListTable(currentUserListData); return; }
    const filteredUsers = currentUserListData.filter(user => 
        (user.username && user.username.toLowerCase().includes(searchTerm)) || 
        (user.email && user.email.toLowerCase().includes(searchTerm))
    );
    renderUserListTable(filteredUsers);
}

function renderUserListTable(users) { // users is now current page data
    const userListContainer = document.getElementById('userListContainer');
    if (!userListContainer) return;
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;
    if (!users || users.length === 0) { 
        userListContainer.innerHTML = '<p>没有找到匹配的用户。</p>'; 
        return; 
    }
    userListContainer.innerHTML = `
        <table class="data-table user-table">
            <thead><tr><th>ID</th><th>用户名</th><th>邮箱</th><th>角色</th><th>创建时间</th><th>操作</th></tr></thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${user.id}</td>
                        <td>${esc(user.username)}</td>
                        <td>${esc(user.email)}</td>
                        <td><span class="role-badge role-${esc(user.role.toLowerCase())}">${esc(user.role)}</span></td>
                        <td>${formatUtcToLocalDateCommon(user.created_at, true)}</td>
                        <td>
                            <button class="btn-edit btn-sm" onclick="renderEditUserForm('${user.id}')"><i class="fas fa-edit"></i> 编辑</button>
                            <button class="btn-delete btn-sm" onclick="deleteUser('${user.id}', '${esc(user.username.replace(/'/g, "\\\\'"))}')"><i class="fas fa-trash"></i> 删除</button>
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

// --- Add User Form (Moved from original position for logical flow, no functional change) ---
function renderAddUserForm() {
    contentArea.innerHTML = `
        <div class="content-section">
            <div class="form-container">
                <h2><i class="fas fa-user-plus"></i> 添加新用户</h2>
                <form id="addUserForm" onsubmit="submitAddUserForm(event)">
                    <div class="form-group"><label for="add_username">用户名<span class="required-star">*</span>:</label><input type="text" id="add_username" name="username" required></div>
                    <div class="form-group"><label for="add_email">邮箱<span class="required-star">*</span>:</label><input type="email" id="add_email" name="email" required></div>
                    <div class="form-group"><label for="add_password">密码<span class="required-star">*</span>:</label><input type="password" id="add_password" name="password" required></div>
                    <div class="form-group">
                        <label for="add_role">角色<span class="required-star">*</span>:</label>
                        <select id="add_role" name="role" required>
                            <option value="student">学生 (Student)</option>
                            <option value="teacher">教师 (Teacher)</option>
                            <option value="admin">管理员 (Admin)</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-submit"><i class="fas fa-check"></i> 添加</button>
                        <button type="button" class="btn-cancel" onclick="dispatchAction('showUserList')"><i class="fas fa-times"></i> 取消</button>
                    </div>
                    <p style="margin-top:15px; font-size:0.9em; color: #666;"><span class="required-star">*</span> 表示必填项。</p>
                </form>
            </div>
        </div>`;
}

async function submitAddUserForm(event) {
    event.preventDefault(); 
    const form = event.target;
    const userData = { 
        username: form.username.value, email: form.email.value, 
        password: form.password.value, role: form.role.value 
    };
    try {
        const result = await apiCall('/api/admin/users', 'POST', userData);
        if (result.success) { 
            showAlert('用户添加成功！', '成功', 'success'); 
            dispatchAction('showUserList'); 
        } else { 
            showAlert('添加用户失败：' + (result.message || '未知错误'), '错误', 'error'); 
        }
    } catch (error) { 
        console.error('Error adding user:', error); 
        showAlert(`添加用户时发生错误：${error.message}`, '网络错误', 'error'); 
    }
}

// --- Edit User Logic (renderEditUserForm, submitEditUserForm) ---
async function renderEditUserForm(userId) { 
    showLoading();
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;
    try {
        // API /api/admin/users/:userId already exists for fetching single user
        const data = await apiCall(`/api/admin/users/${userId}`);
        if (!data.success || !data.user) throw new Error(data.message || '获取用户信息失败');
        
        const user = data.user;
        contentArea.innerHTML = `
            <div class="content-section">
                <div class="form-container">
                    <h2><i class="fas fa-user-edit"></i> 编辑用户 - ${esc(user.username)} (ID: ${user.id})</h2>
                    <form id="editUserForm" onsubmit="submitEditUserForm(event, '${user.id}')">
                        <div class="form-group"><label for="edit_username">用户名：</label><input type="text" id="edit_username" name="username" value="${esc(user.username)}" required></div>
                        <div class="form-group"><label for="edit_email">邮箱：</label><input type="email" id="edit_email" name="email" value="${esc(user.email)}" required></div>
                        <div class="form-group"><label for="edit_role">角色：</label>
                            <select id="edit_role" name="role" required>
                                <option value="student" ${user.role === 'student' ? 'selected' : ''}>学生 (Student)</option>
                                <option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>教师 (Teacher)</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>管理员 (Admin)</option>
                            </select>
                        </div>
                        <div class="form-group"><label for="edit_newPassword">新密码 (可选):</label><input type="password" id="edit_newPassword" name="newPassword" placeholder="留空则不修改密码"></div>
                        <div class="form-actions">
                            <button type="submit" class="btn-submit"><i class="fas fa-save"></i> 保存</button>
                            <button type="button" class="btn-cancel" onclick="dispatchAction('showUserList')"><i class="fas fa-times"></i> 取消</button>
                        </div>
                    </form>
                </div>
            </div>`;
    } catch (error) { 
        showAlert(`加载用户信息失败：${error.message}`, '错误', 'error'); 
        dispatchAction('showUserList'); 
    }
}

async function submitEditUserForm(event, userId) {
    event.preventDefault(); 
    const form = event.target;
    const userData = { 
        username: form.username.value, email: form.email.value, role: form.role.value 
    };
    if (form.newPassword.value) { userData.newPassword = form.newPassword.value; }

    try {
        const result = await apiCall(`/api/admin/users/${userId}`, 'PUT', userData);
        if (result.success) { 
            showAlert('用户信息更新成功！', '成功', 'success'); 
            dispatchAction('showUserList'); 
        } else { 
            showAlert('更新用户信息失败：' + (result.message || '未知错误'), '错误', 'error'); 
        }
    } catch (error) { 
        console.error('Error updating user:', error); 
        showAlert(`更新用户信息时发生错误：${error.message}`, '网络错误', 'error'); 
    }
}


async function deleteUser(userId, username) {
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;
    showConfirm(`确定要删除用户 "${esc(username)}" (ID: ${userId}) 吗？<br><strong style='color:red;'>此操作不可恢复！</strong>`, async (confirmed) => {
        if (confirmed) {
            try {
                const result = await apiCall(`/api/admin/users/${userId}`, 'DELETE');
                if (result.success) { 
                    showAlert('用户删除成功！', '成功', 'success'); 
                    fetchAndRenderUsers(); // Reload current page with filters
                } else { 
                    showAlert('删除用户失败：' + (result.message || '未知错误'), '错误', 'error'); 
                }
            } catch (error) { 
                console.error('Error deleting user:', error); 
                showAlert(`删除用户时发生错误：${error.message}`, '网络错误', 'error'); 
            }
        }
    }, `删除用户 ${esc(username)}`);
}