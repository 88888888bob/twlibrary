// js/admin-blog-topics.js
// Depends on: admin-utils.js (apiCall, showLoading, escapeHtml, contentArea)
//             admin-modals.js (showAlert, showConfirm)
//             admin-main.js (dispatchAction - for navigation)

let currentEditingTopicId = null;

// --- Navigation Entry Point ---
function showBlogTopicsAdmin() {
    loadAndRenderTopicsAdmin();
}

// --- Topics Admin List & Form ---
async function loadAndRenderTopicsAdmin(page = 1) {
    if (typeof showLoading === 'function') showLoading();
    contentArea.innerHTML = `
        <div class="content-section">
            <h2><i class="fas fa-tags"></i> 博客话题管理</h2>
            <div class="topics-admin-layout">
                <div id="topicsListContainer" class="topics-list-column">
                    <p>加载话题列表中...</p>
                </div>
                <div id="topicFormContainer" class="topic-form-column">
                    ${renderTopicForm()} <!-- Initial empty form -->
                </div>
            </div>
            <div id="topicsPaginationContainer" style="margin-top: 20px;"></div>
        </div>
    `;

    // Fetch and render topics list
    try {
        const queryParams = new URLSearchParams({ page: page, limit: 15 }); // Limit for topics list
        const response = await apiCall(`/api/blog/topics?${queryParams.toString()}`);
        
        const listContainer = document.getElementById('topicsListContainer');
        const paginationContainer = document.getElementById('topicsPaginationContainer');

        if (response.success && response.data) {
            renderTopicsTable(response.data, listContainer);
            renderPagination(response.pagination, paginationContainer, (newPage) => loadAndRenderTopicsAdmin(newPage));
        } else {
            listContainer.innerHTML = "<p>无法加载话题列表或列表为空。</p>";
            showAlert(response.message || '加载话题列表失败', '错误', 'error');
        }
    } catch (error) {
        console.error("Error fetching topics for admin:", error);
        document.getElementById('topicsListContainer').innerHTML = `<p>加载话题列表时出错：${error.message}</p>`;
        showAlert(`加载话题列表出错：${error.message}`, '网络错误', 'error');
    }
}

function renderTopicsTable(topics, container) {
    if (!topics || topics.length === 0) {
        container.innerHTML = "<h4>话题列表</h4><p>暂无话题。</p>";
        return;
    }
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;
    let tableHtml = `
        <h4>话题列表</h4>
        <table class="data-table topics-table">
            <thead><tr><th>ID</th><th>名称 (Slug)</th><th>描述</th><th>文章数</th><th>操作</th></tr></thead>
            <tbody>`;
    topics.forEach(topic => {
        tableHtml += `
            <tr>
                <td>${topic.id}</td>
                <td>${esc(topic.name)} <small>(${esc(topic.slug || 'N/A')})</small></td>
                <td>${esc(topic.description || '-')}</td>
                <td>${topic.post_count || 0}</td>
                <td>
                    <button class="btn-edit btn-sm" onclick="loadTopicForEdit(${topic.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-delete btn-sm" onclick="confirmDeleteTopic(${topic.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
    });
    tableHtml += `</tbody></table>`;
    container.innerHTML = tableHtml;
}

function renderTopicForm(topic = null) {
    currentEditingTopicId = topic ? topic.id : null;
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;
    const formTitle = topic ? `编辑话题 (ID: ${topic.id})` : "创建新话题";

    return `
        <h4>${formTitle}</h4>
        <form id="topicForm" onsubmit="submitTopicForm(event)">
            <input type="hidden" name="topicId" value="${topic ? topic.id : ''}">
            <div class="form-group">
                <label for="topicName">话题名称<span class="required-star">*</span>:</label>
                <input type="text" id="topicName" name="name" value="${topic ? esc(topic.name) : ''}" required>
            </div>
            <div class="form-group">
                <label for="topicSlug">Slug (可选，留空则自动生成):</label>
                <input type="text" id="topicSlug" name="slug" value="${topic ? esc(topic.slug || '') : ''}" placeholder="example-topic-slug">
            </div>
            <div class="form-group">
                <label for="topicDescription">描述 (可选):</label>
                <textarea id="topicDescription" name="description" rows="3">${topic ? esc(topic.description || '') : ''}</textarea>
            </div>
            <div class="form-actions">
                <button type="submit" class="btn-submit"><i class="fas fa-save"></i> ${topic ? '更新话题' : '创建话题'}</button>
                ${topic ? `<button type="button" class="btn-cancel" onclick="clearTopicForm()"><i class="fas fa-plus"></i> 新建</button>` : ''}
            </div>
        </form>
    `;
}

function clearTopicForm() {
    document.getElementById('topicFormContainer').innerHTML = renderTopicForm();
}

async function loadTopicForEdit(topicId) {
    // In a real app, you might fetch the single topic details if not all info is in the list
    // For now, we assume the list has enough, or we find it in the cached list (if we had one)
    // This is a simplified approach: find in current page's data or re-render form with new fetch
    showLoading('topicFormContainer');
    try {
        // Ideally, have a GET /api/admin/blog/topics/:topicId endpoint
        // For now, we'll just re-render an edit form. We need to find the topic data.
        // This is a placeholder - you'd typically fetch the specific topic.
        // Let's assume we re-fetch all and find it for simplicity here, or better, have a cache.
        const tempTopicsResponse = await apiCall('/api/blog/topics?limit=1000'); // Inefficient
        let topicToEdit = null;
        if (tempTopicsResponse.success && tempTopicsResponse.data) {
            topicToEdit = tempTopicsResponse.data.find(t => t.id === topicId);
        }

        if (topicToEdit) {
            document.getElementById('topicFormContainer').innerHTML = renderTopicForm(topicToEdit);
        } else {
            showAlert(`无法加载话题 ID: ${topicId} 进行编辑。`, '错误', 'error');
            clearTopicForm();
        }
    } catch (e) {
        showAlert(`加载编辑话题时出错：${e.message}`, '错误', 'error');
        clearTopicForm();
    }
}

async function submitTopicForm(event) {
    event.preventDefault();
    const form = document.getElementById('topicForm');
    const formData = new FormData(form);
    const topicData = {};
    formData.forEach((value, key) => {
        if (value.trim() !== '' || key === 'description') { // Allow empty description, but not other key fields if empty
             topicData[key] = value.trim() === '' && key !== 'description' ? null : value; // send null if non-description field is empty
        }
    });
    
    const topicId = currentEditingTopicId;
    const endpoint = topicId ? `/api/admin/blog/topics/${topicId}` : '/api/admin/blog/topics';
    const method = topicId ? 'PUT' : 'POST';

    // Remove topicId from body if it's in the URL for PUT
    if (topicId && topicData.topicId) delete topicData.topicId;
    if (topicData.slug === null) delete topicData.slug; // Don't send empty slug, let backend generate

    try {
        const response = await apiCall(endpoint, method, topicData);
        if (response.success) {
            showAlert(`话题已成功${topicId ? '更新' : '创建'}！`, '成功', 'success');
            loadAndRenderTopicsAdmin(); // Refresh list and clear form
            clearTopicForm(); // Explicitly clear form
        } else {
            showAlert(`操作失败：${response.message || '未知错误'}`, '错误', 'error');
        }
    } catch (error) {
        showAlert(`提交话题时发生错误：${error.message}`, '网络错误', 'error');
    }
}

function confirmDeleteTopic(topicId) {
    showConfirm(`确定要删除话题 ID: ${topicId} 吗？其关联的文章将解除与此话题的关联。`, (confirmed) => {
        if (confirmed) {
            deleteTopic(topicId);
        }
    });
}

async function deleteTopic(topicId) {
    try {
        const response = await apiCall(`/api/admin/blog/topics/${topicId}`, 'DELETE');
        if (response.success) {
            showAlert('话题删除成功！', '成功', 'success');
            loadAndRenderTopicsAdmin(); // Refresh list
            clearTopicForm();
        } else {
            showAlert(`删除失败：${response.message}`, '错误', 'error');
        }
    } catch (error) {
        showAlert(`删除话题时出错：${error.message}`, '网络错误', 'error');
    }
}

// Need a pagination renderer like in admin-blog-posts.js, or move it to admin-utils.js
// For brevity, assuming renderPagination is available globally or imported.