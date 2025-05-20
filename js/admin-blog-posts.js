// js/admin-blog-posts.js
// Depends on: admin-utils.js (apiCall, showLoading, escapeHtml, contentArea)
//             admin-modals.js (showAlert, showConfirm)
//             quill-manager.js (initializeQuillEditor, syncAllQuillEditorsToHiddenInputs)
//             admin-main.js (dispatchAction - for navigation)

let quillPostEditorInstance = null; // To hold the Quill instance for the post editor
let availableTopicsCache = []; // Cache for topics to select from
let currentEditingPostId = null; // To store the ID of the post being edited

// --- Navigation Entry Points ---
function showBlogPostsList(filters = {}) { // Default to empty filters
    loadAndRenderBlogPosts(1, filters); // Load first page with optional filters
}

function showBlogPostForm(params = {}) { // params might contain postId
    currentEditingPostId = params.postId || null;
    renderBlogPostForm(currentEditingPostId);
}


// --- Blog Posts List View ---
// loadAndRenderBlogPosts 现在接收一个 filters 对象
async function loadAndRenderBlogPosts(page = 1, currentFilters = {}) {
    if (typeof showLoading === 'function') showLoading();
    else if (contentArea) contentArea.innerHTML = "<p>加载中...</p>";

    // 构建 queryParams，确保 currentFilters 中的值被正确使用
    let queryParams = new URLSearchParams({ 
        page: page, 
        limit: 10, // Or your preferred default
        // Add other default sort orders if needed
    });
    for (const key in currentFilters) {
        if (currentFilters[key] !== undefined && currentFilters[key] !== null && currentFilters[key] !== '') {
            queryParams.append(key, currentFilters[key]);
        }
    }

    // 更新筛选器 UI 以反映当前筛选状态
    // 确保 HTML 结构在调用此函数时已准备好
    const renderFiltersUI = () => {
        const searchInput = document.getElementById('postSearchInput');
        const statusSelect = document.getElementById('postStatusFilter');
        if (searchInput) searchInput.value = currentFilters.search || '';
        if (statusSelect) statusSelect.value = currentFilters.status || '';
    };
    
    let sectionTitle = "博客文章列表";
    if (currentFilters.status === 'pending_review') {
        sectionTitle = "待审核文章列表";
    } // 可根据其他筛选条件扩展标题

    contentArea.innerHTML = `
        <div class="content-section">
            <h2><i class="fas fa-list-alt"></i> ${sectionTitle}</h2>
            <div class="list-header">
                <button class="btn-add" onclick="navigateToBlogPostForm()"><i class="fas fa-plus"></i> 写新文章</button>
                <div id="blogPostsFilters">
                    <input type="text" id="postSearchInput" placeholder="搜索标题/摘要...">
                    <select id="postStatusFilter">
                        <option value="">所有状态</option>
                        <option value="published">已发布</option>
                        <option value="draft">草稿</option>
                        <option value="pending_review">待审核</option>
                        <option value="archived">已归档</option>
                    </select>
                    <button class="btn-search" onclick="applyAdminPostFilters()"><i class="fas fa-filter"></i> 筛选</button>
                    <button class="btn-cancel" onclick="clearAdminPostFilters()" title="清除筛选"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div id="blogPostsTableContainer"></div>
            <div id="blogPostsPaginationContainer"></div>
        </div>
    `;
    renderFiltersUI(); // 设置筛选 UI 的初始值
    
    document.getElementById('postSearchInput')?.addEventListener('keyup', event => {
        if (event.key === "Enter") applyAdminPostFilters();
    });

    try {
        // 后端 /api/blog/posts 需要能根据管理员身份返回所有状态的文章
        // 或者有一个专门的 /api/admin/blog/posts 接口
        // 假设 GET /api/blog/posts 如果是管理员调用，会忽略 status='published' 的默认限制，
        // 而是根据传入的 status 参数筛选。
        const response = await apiCall(`/api/blog/posts?${queryParams.toString()}`);
        // ... (渲染表格和分页的逻辑保持不变，但 onPageClickCallback 要传递 currentFilters)
        if (response.success && response.data) {
            renderBlogPostsTable(response.data, document.getElementById('blogPostsTableContainer'));
            renderPagination(response.pagination, document.getElementById('blogPostsPaginationContainer'), (newPage) => loadAndRenderBlogPosts(newPage, currentFilters));
        }else {
            tableContainer.innerHTML = "<p>无法加载文章列表或列表为空。</p>";
            showAlert(response.message || '加载文章列表失败', '错误', 'error');
        }
    } catch (error) {
        console.error("Error fetching blog posts:", error);
        document.getElementById('blogPostsTableContainer').innerHTML = `<p>加载文章列表时出错：${error.message}</p>`;
        showAlert(`加载文章列表出错：${error.message}`, '网络错误', 'error');
    }
}

// 修改 applyPostFilters 以适应 Admin 后台
function applyAdminPostFilters() {
    const search = document.getElementById('postSearchInput').value;
    const status = document.getElementById('postStatusFilter').value;
    const filters = {};
    if (search.trim()) filters.search = search.trim();
    if (status) filters.status = status;
    loadAndRenderBlogPosts(1, filters); // 重新加载，从第一页开始，带新筛选
}

function clearAdminPostFilters() {
    document.getElementById('postSearchInput').value = '';
    document.getElementById('postStatusFilter').value = '';
    loadAndRenderBlogPosts(1, {}); // 重新加载，从第一页开始，无筛选
}

function applyPostFilters() {
    const search = document.getElementById('postSearchInput').value;
    const status = document.getElementById('postStatusFilter').value;
    const filters = {};
    if (search) filters.search = search;
    if (status) filters.status = status;
    // Add other filters like author, topic, book
    showBlogPostsList(filters); // Reloads with page 1 and new filters
}

function renderBlogPostsTable(posts, container) {
    if (!posts || posts.length === 0) {
        container.innerHTML = "<p>没有找到符合条件的文章。</p>";
        return;
    }
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;

    let tableHtml = `
        <table class="data-table blog-posts-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>标题</th>
                    <th>作者</th>
                    <th>关联书籍</th>
                    <th>话题</th>
                    <th>状态</th>
                    <th>发布日期</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>`;
    posts.forEach(post => {
        tableHtml += `
            <tr>
                <td>${post.id}</td>
                <td>${esc(post.title)} ${post.is_featured ? '<i class="fas fa-star" title="推荐" style="color:orange;"></i>':''}</td>
                <td>${esc(post.author_username || post.post_author_username_on_post_table || 'N/A')}</td>
                <td>${post.book_isbn ? `${esc(post.book_title || '未知书名')} (${esc(post.book_isbn)})` : '-'}</td>
                <td>${(post.topics && post.topics.length > 0) ? post.topics.map(t => esc(t.name || t)).join(', ') : '-'}</td>
                <td><span class="status-badge status-${esc(post.status)}">${esc(post.status)}</span></td>
                <td>${post.published_date ? esc(post.published_date) : (post.status === 'published' && post.published_at_formatted ? esc(post.published_at_formatted.split(' ')[0]) : '-')}</td>
                <td>
                    <button class="btn-edit btn-sm" onclick="navigateToBlogPostForm(${post.id})"><i class="fas fa-edit"></i> 编辑</button>
                    <button class="btn-info btn-sm" onclick="promptChangePostStatus(${post.id}, '${esc(post.status)}')"><i class="fas fa-sync-alt"></i> 改状态</button>
                    <button class="btn-delete btn-sm" onclick="confirmDeleteBlogPost(${post.id})"><i class="fas fa-trash"></i> 删除</button>
                </td>
            </tr>`;
    });
    tableHtml += `</tbody></table>`;
    container.innerHTML = tableHtml;
}

// Generic pagination renderer (can be moved to admin-utils.js if used elsewhere)
function renderPagination(pagination, container, onPageClickCallback) {
    if (!pagination || pagination.totalPages <= 1) {
        container.innerHTML = "";
        return;
    }
    let paginationHtml = '<nav class="pagination"><ul>';
    if (pagination.hasPrevPage) {
        paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-page="${pagination.currentPage - 1}">«</a></li>`;
    } else {
        paginationHtml += `<li class="page-item disabled"><span class="page-link">«</span></li>`;
    }

    // Simplified: Show a few pages around current, plus first and last
    const maxPagesToShow = 5;
    let startPage = Math.max(1, pagination.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(pagination.totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage + 1 < maxPagesToShow) { // Adjust startPage if endPage is at max
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    if (startPage > 1) {
        paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
        if (startPage > 2) paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHtml += `<li class="page-item ${i === pagination.currentPage ? 'active' : ''}">
                               <a class="page-link" href="#" data-page="${i}">${i}</a>
                           </li>`;
    }

    if (endPage < pagination.totalPages) {
        if (endPage < pagination.totalPages - 1) paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-page="${pagination.totalPages}">${pagination.totalPages}</a></li>`;
    }

    if (pagination.hasNextPage) {
        paginationHtml += `<li class="page-item"><a class="page-link" href="#" data-page="${pagination.currentPage + 1}">»</a></li>`;
    } else {
        paginationHtml += `<li class="page-item disabled"><span class="page-link">»</span></li>`;
    }
    paginationHtml += '</ul></nav>';
    container.innerHTML = paginationHtml;

    container.querySelectorAll('.page-link[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            onPageClickCallback(parseInt(e.target.dataset.page));
        });
    });
}


// --- Blog Post Form (Create/Edit) ---
async function renderBlogPostForm(postId = null) {
    if (typeof showLoading === 'function') showLoading();
    currentEditingPostId = postId; // Store for submission
    let postData = { title: '', content: '', excerpt: '', book_isbn: '', book_title: '', topic_ids: [], status: 'draft', visibility: 'public', allow_comments: true, featured_image_url: '' };
    let pageTitle = "写新文章";

    if (postId) {
        pageTitle = "编辑文章";
        try {
            // Admin might need a different endpoint or param to fetch non-published posts
            const response = await apiCall(`/api/blog/posts/${postId}`); 
            if (response.success && response.post) {
                postData = { 
                    ...postData, // Keep defaults for fields not in response
                    ...response.post,
                    topic_ids: response.post.topics ? response.post.topics.map(t => t.id) : [] // Extract topic IDs
                }; 
            } else {
                showAlert(`加载文章数据失败：${response.message || '未知错误'}`, '错误', 'error');
                navigateToBlogPostsList(); // Go back to list
                return;
            }
        } catch (error) {
            showAlert(`加载文章数据时出错：${error.message}`, '网络错误', 'error');
            navigateToBlogPostsList();
            return;
        }
    }

    // Fetch available topics for selection
    if (availableTopicsCache.length === 0) { // Simple cache
        try {
            const topicsResponse = await apiCall('/api/blog/topics?limit=1000'); // Get all topics
            if (topicsResponse.success && topicsResponse.data) {
                availableTopicsCache = topicsResponse.data;
            }
        } catch (e) { console.error("Failed to fetch topics for form", e); }
    }
    
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;

    let topicOptionsHtml = availableTopicsCache.map(topic => 
        `<label class="topic-checkbox">
            <input type="checkbox" name="topic_ids" value="${topic.id}" ${postData.topic_ids.includes(topic.id) ? 'checked' : ''}> 
            ${esc(topic.name)}
         </label>`
    ).join('');


    // Admin can set status directly, user's choice might be overridden by review setting
    const statusOptions = [
        { value: 'draft', text: '草稿' },
        { value: 'pending_review', text: '提交审核' },
        { value: 'published', text: '发布' } // Admin can see this, user might not if review is on
    ];
    // TODO: Get current user role to conditionally show 'published' for admin
    let statusSelectHtml = statusOptions.map(opt => 
        `<option value="${opt.value}" ${postData.status === opt.value ? 'selected' : ''}>${esc(opt.text)}</option>`
    ).join('');


    contentArea.innerHTML = `
        <div class="content-section">
            <h2><i class="fas fa-edit"></i> ${pageTitle} ${postId ? `(ID: ${postId})` : ''}</h2>
            <form id="blogPostForm" onsubmit="submitBlogPostForm(event)">
                <input type="hidden" name="postId" value="${postId || ''}">
                
                <div class="form-group">
                    <label for="postTitle">标题<span class="required-star">*</span>:</label>
                    <input type="text" id="postTitle" name="title" value="${esc(postData.title)}" required>
                </div>

                <div class="form-group">
                    <label for="postQuillEditor">内容<span class="required-star">*</span>:</label>
                    <div id="postQuillEditor" class="quill-editor-instance" style="min-height: 250px; border: 1px solid #ccc;"></div>
                    <input type="hidden" id="postContentHidden" name="content">
                </div>

                <div class="form-group">
                    <label for="postExcerpt">摘要 (可选):</label>
                    <textarea id="postExcerpt" name="excerpt" rows="3">${esc(postData.excerpt || '')}</textarea>
                </div>

                <div class="form-row">
                    <div class="form-group half-width">
                        <label for="postBookIsbn">关联书籍 ISBN (可选):</label>
                        <div style="display:flex;">
                            <input type="text" id="postBookIsbn" name="book_isbn" value="${esc(postData.book_isbn || '')}" placeholder="输入 ISBN 或书名搜索">
                            <button type="button" class="btn btn-search btn-sm" onclick="searchBookForPost()" style="margin-left:5px;"><i class="fas fa-search"></i></button>
                        </div>
                        <div id="bookSearchResult" style="margin-top:5px; font-size:0.9em; color: green;">${postData.book_isbn ? `已关联: ${esc(postData.book_title || postData.book_isbn)}` : ''}</div>
                    </div>
                    <div class="form-group half-width">
                        <label for="postFeaturedImageUrl">封面图片 URL (可选):</label>
                        <input type="url" id="postFeaturedImageUrl" name="featured_image_url" value="${esc(postData.featured_image_url || '')}" placeholder="https://example.com/image.jpg">
                    </div>
                </div>

                <div class="form-group">
                    <label>选择话题 (可选):</label>
                    <div class="topic-checkbox-group">
                        ${topicOptionsHtml || '<p>暂无可用话题。 <a href="#" onclick="navigateToBlogTopicsAdmin(); return false;">创建话题</a></p>'}
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group third-width">
                        <label for="postStatus">状态:</label>
                        <select id="postStatus" name="status">${statusSelectHtml}</select>
                    </div>
                    <div class="form-group third-width">
                        <label for="postVisibility">可见性:</label>
                        <select id="postVisibility" name="visibility">
                            <option value="public" ${postData.visibility === 'public' ? 'selected' : ''}>公开</option>
                            <option value="members_only" ${postData.visibility === 'members_only' ? 'selected' : ''}>仅会员</option>
                            <option value="unlisted" ${postData.visibility === 'unlisted' ? 'selected' : ''}>不公开列出</option>
                        </select>
                    </div>
                    <div class="form-group third-width">
                        <label for="postAllowComments">允许评论:</label>
                        <select id="postAllowComments" name="allow_comments">
                            <option value="true" ${postData.allow_comments ? 'selected' : ''}>是</option>
                            <option value="false" ${!postData.allow_comments ? 'selected' : ''}>否</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn-submit"><i class="fas fa-save"></i> ${postId ? '更新文章' : '发布文章'}</button>
                    <button type="button" class="btn-cancel" onclick="navigateToBlogPostsList()"><i class="fas fa-times"></i> 取消</button>
                </div>
            </form>
        </div>
    `;

    // Initialize Quill for the post content
    if (typeof initializeQuillEditor === 'function') {
        quillPostEditorInstance = initializeQuillEditor(
            '#postQuillEditor',          // Editor container selector
            '#postContentHidden',        // Hidden input selector
            postData.content,            // Initial HTML content
            'default',                   // Toolbar configuration key (use 'default' or a 'news_editor' config)
            '在此撰写你的文章...'
        );
    } else {
        console.error("initializeQuillEditor function is not available!");
        document.getElementById('postQuillEditor').innerHTML = '<p style="color:red;">富文本编辑器加载失败，请确保 quill-manager.js 已正确加载。</p>';
    }
}

async function searchBookForPost() {
    const query = document.getElementById('postBookIsbn').value;
    const resultDiv = document.getElementById('bookSearchResult');
    if (!query.trim()) {
        resultDiv.innerHTML = '<span style="color:orange;">请输入书名或 ISBN 进行搜索。</span>';
        return;
    }
    resultDiv.innerHTML = '<i>正在搜索...</i>';
    try {
        const response = await apiCall(`/api/blog/search-books?query=${encodeURIComponent(query)}&limit=5`);
        if (response.success && response.books && response.books.length > 0) {
            let html = '选择一本书籍:<ul>';
            response.books.forEach(book => {
                html += `<li style="cursor:pointer; padding:3px 0;" onclick="selectBookForPost('${escapeHtml(book.isbn)}', '${escapeHtml(book.title)}')">${escapeHtml(book.title)} (${escapeHtml(book.isbn)})</li>`;
            });
            html += '</ul>';
            resultDiv.innerHTML = html;
        } else {
            resultDiv.innerHTML = '<span style="color:red;">未找到匹配的书籍。</span>';
        }
    } catch (error) {
        resultDiv.innerHTML = `<span style="color:red;">搜索书籍时出错：${error.message}</span>`;
    }
}

function selectBookForPost(isbn, title) {
    document.getElementById('postBookIsbn').value = isbn;
    document.getElementById('bookSearchResult').innerHTML = `已关联：${escapeHtml(title)} (${escapeHtml(isbn)})`;
}


async function submitBlogPostForm(event) {
    event.preventDefault();
    if (typeof syncAllQuillEditorsToHiddenInputs === 'function') {
        syncAllQuillEditorsToHiddenInputs(); // Make sure #postContentHidden is updated
    } else if (quillPostEditorInstance) { // Fallback if global sync is not there, sync this specific one
         document.getElementById('postContentHidden').value = quillPostEditorInstance.root.innerHTML;
    }


    const form = document.getElementById('blogPostForm');
    const formData = new FormData(form);
    const postData = {};
    const selectedTopicIds = [];

    formData.forEach((value, key) => {
        if (key === 'topic_ids') {
            selectedTopicIds.push(parseInt(value));
        } else if (key === 'allow_comments') {
            postData[key] = (value === 'true');
        } 
         else if (key !== 'postId') { // Don't include postId directly in body if it's for URL
            postData[key] = value;
        }
    });
    if (selectedTopicIds.length > 0) {
        postData.topic_ids = selectedTopicIds;
    }


    const postId = currentEditingPostId; // Get from global var set in renderBlogPostForm
    const endpoint = postId ? `/api/blog/posts/${postId}` : '/api/blog/posts';
    const method = postId ? 'PUT' : 'POST';

    try {
        const response = await apiCall(endpoint, method, postData);
        if (response.success) {
            showAlert(`文章已成功${postId ? '更新' : '创建'}！`, '成功', 'success');
            navigateToBlogPostsList(); // Go back to the list view
        } else {
            showAlert(`操作失败：${response.message || '未知错误'}`, '错误', 'error');
        }
    } catch (error) {
        showAlert(`提交文章时发生错误：${error.message}`, '网络错误', 'error');
    }
}

// --- Admin Actions for Posts (from list view) ---
// js/admin-blog-posts.js

async function promptChangePostStatus(postId, currentStatus) {
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;
    
    const statusOptions = [
        { value: 'draft', text: '草稿 (Draft)' },
        { value: 'pending_review', text: '待审核 (Pending Review)' },
        { value: 'published', text: '已发布 (Published)' },
        { value: 'archived', text: '已归档 (Archived)' }
    ];

    let optionsHtml = statusOptions.map(opt => 
        `<option value="${esc(opt.value)}" ${currentStatus === opt.value ? 'selected' : ''}>${esc(opt.text)}</option>`
    ).join('');

    const modalContentHtml = `
        <p>当前文章 (ID: ${postId}) 状态：<strong>${esc(currentStatus)}</strong></p>
        <p>请选择新的状态:</p>
        <select id="newPostStatusSelect" class="form-control" style="margin-top: 10px; margin-bottom: 20px; padding: 8px; width: 100%;">
            ${optionsHtml}
        </select>
    `;

    // showConfirm(message, callback, title)
    showConfirm(modalContentHtml, async (confirmed) => {
        if (confirmed) {
            const newStatusSelect = document.getElementById('newPostStatusSelect'); // 获取模态框内部的 select
            if (newStatusSelect) {
                const newStatus = newStatusSelect.value;
                if (newStatus && newStatus !== currentStatus) {
                    try {
                        // 调用管理员修改文章状态的 API
                        const response = await apiCall(`/api/admin/blog/posts/${postId}/status`, 'PUT', { status: newStatus });
                        if (response.success) {
                            showAlert('文章状态更新成功！', '成功', 'success');
                            // 刷新当前的文章列表 (需要知道当前的筛选条件和页码)
                            // 简单起见，先直接调用，但这会重置筛选和分页
                            const currentFilters = getCurrentAdminPostFilters(); // 你需要实现这个
                            const currentPageNum = getCurrentAdminPostPage(); // 你需要实现这个
                            loadAndRenderBlogPosts(currentPageNum, currentFilters); 
                        } else {
                            showAlert(`状态更新失败：${response.message}`, '错误', 'error');
                        }
                    } catch (error) {
                        showAlert(`状态更新时出错：${error.message}`, '网络错误', 'error');
                    }
                } else if (newStatus === currentStatus) {
                    // No change
                } else {
                    showAlert('未选择有效的新状态。', '提示', 'info');
                }
            } else {
                 console.error("Could not find newPostStatusSelect in modal.");
            }
        }
    }, '更改文章状态');
}

// Helper functions to get current filter/page state (你需要根据你的实现来填充)
function getCurrentAdminPostFilters() {
    const search = document.getElementById('postSearchInput')?.value || '';
    const status = document.getElementById('postStatusFilter')?.value || '';
    const filters = {};
    if (search.trim()) filters.search = search.trim();
    if (status) filters.status = status;
    return filters;
}
function getCurrentAdminPostPage() {
    // This is tricky. You might need to store currentPage globally in this module
    // or extract it from the pagination UI if possible.
    // For now, let's assume it defaults to 1 if not easily retrievable.
    const activePageElement = document.querySelector('#blogPostsPaginationContainer .page-item.active .page-link');
    return activePageElement ? parseInt(activePageElement.dataset.page) : 1;
}

function confirmDeleteBlogPost(postId) {
    showConfirm(`确定要删除文章 ID: ${postId} 吗？此操作不可恢复。`, (confirmed) => {
        if (confirmed) {
            deleteBlogPost(postId);
        }
    });
}

async function deleteBlogPost(postId) {
    try {
        const response = await apiCall(`/api/blog/posts/${postId}`, 'DELETE');
        if (response.success) {
            showAlert('文章删除成功！', '成功', 'success');
            showBlogPostsList(); // Refresh list
        } else {
            showAlert(`删除失败：${response.message}`, '错误', 'error');
        }
    } catch (error) {
        showAlert(`删除文章时出错：${error.message}`, '网络错误', 'error');
    }
}