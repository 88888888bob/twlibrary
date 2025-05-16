// js/admin-users.js
// Assumes API_BASE_URL, contentArea, showAlert, showConfirm, showLoading, dispatchAction, apiCall are globally available

// --- Globals for this module ---
let currentUserListData = [];

// --- Navigation entry point for this module ---
function showUserList() { // Called by data-action (main view for this section)
    loadUserListLogic();
}
// add and edit forms will be rendered by specific functions

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

function renderUserListTable(users) {
    const userListContainer = document.getElementById('userListContainer');
    if (!userListContainer) return;
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
                        <td>${user.id}</td><td>${user.username}</td><td>${user.email}</td>
                        <td><span class="role-badge role-${user.role.toLowerCase()}">${user.role}</span></td>
                        <td>${new Date(user.created_at).toLocaleDateString()}</td>
                        <td>
                            <button class="btn-edit btn-sm" onclick="renderEditUserForm('${user.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete btn-sm" onclick="deleteUser('${user.id}', '${user.username.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

// --- Add User Logic ---
function renderAddUserForm() {
    contentArea.innerHTML = `
        <div class="content-section">
            <div class="form-container">
                <h2><i class="fas fa-user-plus"></i> 添加新用户</h2>
                <form id="addUserForm" onsubmit="submitAddUserForm(event)">
                    <div class="form-group"><label for="add_username">用户名<span class="required-star">*</span>:</label><input type="text" id="add_username" name="username" required></div>
                    <div class="form-group"><label for="add_email">邮箱<span class="required-star">*</span>:</label><input type="email" id="add_email" name="email" required></div>
                    <div class="form-group"><label for="add_password">密码<span class="required-star">*</span>:</label><input type="password" id="add_password" name="password" required></div>
                    <div class="form-group"><label for="add_role">角色<span class="required-star">*</span>:</label><select id="add_role" name="role" required><option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option></select></div>
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
        showAlert(`添加用户时发生错误: ${error.message}`, '网络错误', 'error'); 
    }
}

// --- Edit User Logic ---
async function renderEditUserForm(userId) { // Renamed from showEditUserForm
    showLoading();
    try {
        const data = await apiCall(`/api/admin/users/${userId}`);
        if (!data.success || !data.user) throw new Error(data.message || '获取用户信息失败');
        
        const user = data.user;
        contentArea.innerHTML = `
            <div class="content-section">
                <div class="form-container">
                    <h2><i class="fas fa-user-edit"></i> 编辑用户 - ${user.username} (ID: ${user.id})</h2>
                    <form id="editUserForm" onsubmit="submitEditUserForm(event, '${user.id}')">
                        <div class="form-group"><label for="edit_username">用户名：</label><input type="text" id="edit_username" name="username" value="${user.username}" required></div>
                        <div class="form-group"><label for="edit_email">邮箱：</label><input type="email" id="edit_email" name="email" value="${user.email}" required></div>
                        <div class="form-group"><label for="edit_role">角色：</label><select id="edit_role" name="role" required><option value="student" ${user.role === 'student' ? 'selected' : ''}>Student</option><option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>Teacher</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option></select></div>
                        <div class="form-group"><label for="edit_newPassword">新密码 (可选):</label><input type="password" id="edit_newPassword" name="newPassword" placeholder="留空则不修改密码"></div>
                        <div class="form-actions"><button type="submit" class="btn-submit"><i class="fas fa-save"></i> 保存</button><button type="button" class="btn-cancel" onclick="dispatchAction('showUserList')"><i class="fas fa-times"></i> 取消</button></div>
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
        showAlert(`更新用户信息时发生错误: ${error.message}`, '网络错误', 'error'); 
    }
}

// --- Delete User Logic ---
async function deleteUser(userId, username) {
    showConfirm(`确定要删除用户 "${username}" (ID: ${userId}) 吗？<br><strong style='color:red;'>此操作不可恢复！</strong>`, async (confirmed) => {
        if (confirmed) {
            try {
                const result = await apiCall(`/api/admin/users/${userId}`, 'DELETE');
                if (result.success) { 
                    showAlert('用户删除成功！', '成功', 'success'); 
                    loadUserListLogic(); // Reload user list
                } else { 
                    showAlert('删除用户失败：' + (result.message || '未知错误'), '错误', 'error'); 
                }
            } catch (error) { 
                console.error('Error deleting user:', error); 
                showAlert(`删除用户时发生错误: ${error.message}`, '网络错误', 'error'); 
            }
        }
    }, `删除用户 ${username}`);
}