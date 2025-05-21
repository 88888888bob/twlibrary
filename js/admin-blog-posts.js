// js/admin-blog-posts.js
// Depends on: admin-utils.js (apiCall, showLoading, escapeHtml, contentArea)
//             admin-modals.js (showAlert, showConfirm)
//             quill-manager.js (initializeQuillEditor, syncAllQuillEditorsToHiddenInputs)
//             admin-main.js (dispatchAction - for navigation)

let quillPostEditorInstance = null; // To hold the Quill instance for the post editor
let availableTopicsCache = []; // Cache for topics to select from
let currentEditingPostId = null; // To store the ID of the post being edited
let allFetchedAdminPosts = []; // <--- 新增：缓存从 API 获取的所有文章
let currentAdminPostPage = 1;
let currentAdminPostFilters = { status: '', search: '' }; // status 用于标签筛选，search 用于搜索框

// --- Navigation Entry Points ---
function showBlogPostsList(params = {}) {
    // params.filters.status 是从导航链接直接设置的初始状态筛选
    currentAdminPostFilters.status = params.filters?.status || ''; 
    currentAdminPostFilters.search = ''; // 清除搜索词
    currentAdminPostPage = 1;
    fetchAllAdminPostsAndRender(); // <--- 修改为调用新的主函数
}

// 新的主函数：获取所有文章（或一大批），然后渲染
async function fetchAllAdminPostsAndRender() {
    if (typeof showLoading === 'function') showLoading();
    else if (contentArea) contentArea.innerHTML = "<p>加载中...</p>";

    // API 调用：现在不直接传递状态筛选给 API，除非 API 强制要求
    // 我们获取所有状态的文章（或者由管理员权限决定）
    // 如果文章数量非常大，这里仍然可能需要后端分页，但前端缓存的是当前批次
    // 为了实现前端筛选，一个简单的做法是请求一个较大的 limit，或者多次请求直到获取完（不推荐）
    // 更好的方式是，后端 API 仍然支持按 status 筛选，但前端可以缓存不同 status 下的结果，或者在“全部”时获取所有。
    // 让我们先假设管理员可以获取所有状态的文章，如果数量太大，后续再优化 API 分页策略。
    
    // 清空之前的缓存
    allFetchedAdminPosts = [];

    try {
        // 考虑获取所有状态的文章，后端 API 可能需要一个特殊的参数或根据管理员角色判断
        // 例如：/api/blog/posts?admin_view=true&limit=1000 (获取前 1000 条所有状态)
        // 或者，如果后端 /api/blog/posts 已经支持管理员获取所有，则不需要特殊参数
        // 但为了避免一次加载过多，还是保留后端分页，前端筛选的是当前已加载的页面数据
        // 或者，如果希望完全前端筛选，那就要一次性加载所有。我们先按一次性加载少量（例如 100 条）来演示：
        
        const response = await apiCall(`/api/blog/posts?limit=200`); // 获取较多数据，但仍需考虑性能
                                                                    // 或者，如果后端支持，获取所有 status 的文章，
                                                                    // /api/blog/posts?status=all_for_admin

        if (response.success && response.data) {
            allFetchedAdminPosts = response.data; // 缓存所有获取到的文章
            renderAdminBlogView(); // <--- 新的渲染函数，它会处理筛选和分页
        } else {
            contentArea.innerHTML = `<div class="content-section"><h2>博客文章管理</h2><p>无法加载文章列表：${response.message || '未知错误'}</p></div>`;
            showAlert(response.message || '加载文章列表失败', '错误', 'error');
        }
    } catch (error) {
        console.error("Error fetching all admin blog posts:", error);
        contentArea.innerHTML = `<div class="content-section"><h2>博客文章管理</h2><p>加载文章列表时出错：${error.message}</p></div>`;
        showAlert(`加载文章列表出错：${error.message}`, '网络错误', 'error');
    }
}

// 新的渲染函数，包含 UI 和筛选逻辑
function renderAdminBlogView() {
    let sectionTitle = "博客文章列表";
    if (currentAdminPostFilters.status) {
        const statusMap = { /* ... */ };
        sectionTitle = statusMap[currentAdminPostFilters.status] || sectionTitle;
    }
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;

    contentArea.innerHTML = `
        <div class="content-section">
            <h2><i class="fas fa-list-alt"></i> ${esc(sectionTitle)}</h2>
            <div class="list-filter-pills">
                <button class="btn-filter-pill ${currentAdminPostFilters.status === '' ? 'active' : ''}" onclick="filterAdminPostsByStatus('')">全部 (${allFetchedAdminPosts.length})</button>
                <button class="btn-filter-pill ${currentAdminPostFilters.status === 'published' ? 'active' : ''}" onclick="filterAdminPostsByStatus('published')">已发布 (${allFetchedAdminPosts.filter(p=>p.status==='published').length})</button>
                <button class="btn-filter-pill ${currentAdminPostFilters.status === 'draft' ? 'active' : ''}" onclick="filterAdminPostsByStatus('draft')">草稿 (${allFetchedAdminPosts.filter(p=>p.status==='draft').length})</button>
                <button class="btn-filter-pill ${currentAdminPostFilters.status === 'pending_review' ? 'active' : ''}" onclick="filterAdminPostsByStatus('pending_review')">待审核 (${allFetchedAdminPosts.filter(p=>p.status==='pending_review').length})</button>
                <button class="btn-filter-pill ${currentAdminPostFilters.status === 'archived' ? 'active' : ''}" onclick="filterAdminPostsByStatus('archived')">已归档 (${allFetchedAdminPosts.filter(p=>p.status==='archived').length})</button>
            </div>
            <div class="list-header" style="margin-top:15px;">
                <button class="btn-add" onclick="navigateToBlogPostForm()"><i class="fas fa-plus"></i> 写新文章</button>
                <div id="blogPostsFilters" class="search-container">
                    <input type="text" id="postSearchInputAdmin" placeholder="在当前列表搜索..." value="${esc(currentAdminPostFilters.search || '')}">
                    <button class="btn-search" onclick="applyAdminPostSearchFilter(true)"><i class="fas fa-search"></i> 搜索</button>
                    <button class="btn-cancel" onclick="clearAdminPostSearchFilter(true)" title="清除搜索"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div id="blogPostsTableContainer"></div>
            <div id="blogPostsPaginationContainer"></div>
        </div>
    `;

    document.getElementById('postSearchInputAdmin')?.addEventListener('keyup', event => {
        if (event.key === "Enter") applyAdminPostSearchFilter(true); // true to indicate client-side search
    });

    // 初始渲染或筛选后渲染
    renderFilteredAndPaginatedPosts();
}


function filterAdminPostsByStatus(status) {
    currentAdminPostFilters.status = status;
    currentAdminPostFilters.search = ''; // 清除搜索条件
    const searchInput = document.getElementById('postSearchInputAdmin');
    if(searchInput) searchInput.value = '';
    currentAdminPostPage = 1;
    renderAdminBlogView(); // 重新渲染整个视图以更新按钮激活状态和计数
}

function applyAdminPostSearchFilter(isClientSide = false) {
    const searchInput = document.getElementById('postSearchInputAdmin');
    currentAdminPostFilters.search = searchInput ? searchInput.value.trim().toLowerCase() : '';
    currentAdminPostPage = 1;
    if (isClientSide) {
        renderFilteredAndPaginatedPosts(); // 只重新渲染表格和分页
    } else {
        fetchAllAdminPostsAndRender(); // 如果需要从服务器重新获取（例如，如果搜索不在当前缓存中）
    }
}

function clearAdminPostSearchFilter(isClientSide = false) {
    currentAdminPostFilters.search = '';
    const searchInput = document.getElementById('postSearchInputAdmin');
    if (searchInput) searchInput.value = '';
    currentAdminPostPage = 1;
    if (isClientSide) {
        renderFilteredAndPaginatedPosts();
    } else {
        fetchAllAdminPostsAndRender();
    }
}

// 新函数：根据当前筛选和分页渲染文章
function renderFilteredAndPaginatedPosts() {
    let filteredPosts = allFetchedAdminPosts;

    // 1. 按状态筛选
    if (currentAdminPostFilters.status) {
        filteredPosts = filteredPosts.filter(post => post.status === currentAdminPostFilters.status);
    }

    // 2. 按搜索词筛选 (客户端简单搜索标题和摘要)
    if (currentAdminPostFilters.search) {
        const searchTerm = currentAdminPostFilters.search;
        filteredPosts = filteredPosts.filter(post =>
            (post.title && post.title.toLowerCase().includes(searchTerm)) ||
            (post.excerpt && post.excerpt.toLowerCase().includes(searchTerm))
        );
    }

    // 3. 客户端分页
    const limit = 10; // 每页数量
    const offset = (currentAdminPostPage - 1) * limit;
    const paginatedPosts = filteredPosts.slice(offset, offset + limit);
    const totalFilteredItems = filteredPosts.length;

    const tableContainer = document.getElementById('blogPostsTableContainer');
    const paginationContainer = document.getElementById('blogPostsPaginationContainer');

    renderBlogPostsTable(paginatedPosts, tableContainer); // 使用现有的表格渲染函数
    
    const paginationData = {
        currentPage: currentAdminPostPage,
        itemsPerPage: limit,
        totalItems: totalFilteredItems,
        totalPages: Math.ceil(totalFilteredItems / limit),
        hasNextPage: currentAdminPostPage < Math.ceil(totalFilteredItems / limit),
        hasPrevPage: currentAdminPostPage > 1,
    };
    renderPagination(paginationData, paginationContainer, (newPage) => {
        currentAdminPostPage = newPage;
        renderFilteredAndPaginatedPosts(); // 点击分页时只重新渲染表格和分页
    });

    // 更新筛选按钮的 active 状态 (在 renderAdminBlogView 中已经处理了初始状态)
    document.querySelectorAll('.list-filter-pills .btn-filter-pill').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().includes('全部') && currentAdminPostFilters.status === '') {
            btn.classList.add('active');
        } else if (currentAdminPostFilters.status && btn.textContent.toLowerCase().includes(currentAdminPostFilters.status.toLowerCase())) {
            btn.classList.add('active');
        }
        // 更新按钮上的计数 (如果按钮文本中包含计数的话)
        // 例如："已发布 (count)"
    });
}

function showBlogPostForm(params = {}) { // params might contain postId
    currentEditingPostId = params.postId || null;
    renderBlogPostForm(currentEditingPostId);
}


// --- Blog Posts List View ---
// loadAndRenderBlogPosts 现在接收一个 filters 对象
async function loadAndRenderBlogPosts() { // 不再直接接收 page 和 filters 参数，使用全局的
    if (typeof showLoading === 'function') showLoading();
    else if (contentArea) contentArea.innerHTML = "<p>加载中...</p>";

    let queryParams = new URLSearchParams({ 
        page: currentAdminPostPage, 
        limit: 10 
    });
    if (currentAdminPostFilters.status) queryParams.append('status', currentAdminPostFilters.status);
    if (currentAdminPostFilters.search) queryParams.append('search', currentAdminPostFilters.search);

    let sectionTitle = "博客文章列表";
    if (currentAdminPostFilters.status) {
        const statusMap = {
            'published': '已发布文章', 'draft': '草稿箱', 
            'pending_review': '待审核文章', 'archived': '已归档文章'
        };
        sectionTitle = statusMap[currentAdminPostFilters.status] || sectionTitle;
    }
    
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;

    contentArea.innerHTML = `
        <div class="content-section">
            <h2><i class="fas fa-list-alt"></i> ${esc(sectionTitle)}</h2>
            
            <div class="list-filter-pills">
                <button class="btn-filter-pill ${!currentAdminPostFilters.status ? 'active' : ''}" onclick="setAdminPostStatusFilter('')">全部</button>
                <button class="btn-filter-pill ${currentAdminPostFilters.status === 'published' ? 'active' : ''}" onclick="setAdminPostStatusFilter('published')">已发布</button>
                <button class="btn-filter-pill ${currentAdminPostFilters.status === 'draft' ? 'active' : ''}" onclick="setAdminPostStatusFilter('draft')">草稿</button>
                <button class="btn-filter-pill ${currentAdminPostFilters.status === 'pending_review' ? 'active' : ''}" onclick="setAdminPostStatusFilter('pending_review')">待审核</button>
                <button class="btn-filter-pill ${currentAdminPostFilters.status === 'archived' ? 'active' : ''}" onclick="setAdminPostStatusFilter('archived')">已归档</button>
            </div>

            <div class="list-header" style="margin-top:15px;">
                <button class="btn-add" onclick="navigateToBlogPostForm()"><i class="fas fa-plus"></i> 写新文章</button>
                <div id="blogPostsFilters" class="search-container">
                    <input type="text" id="postSearchInput" placeholder="搜索标题/摘要..." value="${esc(currentAdminPostFilters.search || '')}">
                    <button class="btn-search" onclick="applyAdminPostSearchFilter()"><i class="fas fa-search"></i> 搜索</button>
                    <button class="btn-cancel" onclick="clearAdminPostSearchFilter()" title="清除搜索"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div id="blogPostsTableContainer"></div>
            <div id="blogPostsPaginationContainer"></div>
        </div>
    `;
    
    document.getElementById('postSearchInput')?.addEventListener('keyup', event => {
        if (event.key === "Enter") applyAdminPostSearchFilter();
    });

    try {
        const response = await apiCall(`/api/blog/posts?${queryParams.toString()}`);
        const tableContainer = document.getElementById('blogPostsTableContainer');
        const paginationContainer = document.getElementById('blogPostsPaginationContainer');

        if (response.success && response.data) {
            renderBlogPostsTable(response.data, tableContainer);
            renderPagination(response.pagination, paginationContainer, (newPage) => {
                currentAdminPostPage = newPage;
                loadAndRenderBlogPosts();
            });
        } else {
            tableContainer.innerHTML = "<p>无法加载文章列表或列表为空。</p>";
            showAlert(response.message || '加载文章列表失败', '错误', 'error');
        }
    } catch (error) {
        console.error("Error fetching blog posts:", error);
        document.getElementById('blogPostsTableContainer').innerHTML = `<p>加载文章列表时出错：${error.message}</p>`;
        showAlert(`加载文章列表出错：${error.message}`, '网络错误', 'error');
    }
}

// 新的筛选函数
function setAdminPostStatusFilter(status) {
    currentAdminPostFilters.status = status;
    currentAdminPostPage = 1; // 切换状态时重置到第一页
    loadAndRenderBlogPosts();
}

function applyAdminPostSearchFilter() {
    const searchInput = document.getElementById('postSearchInput');
    currentAdminPostFilters.search = searchInput ? searchInput.value.trim() : '';
    currentAdminPostPage = 1;
    loadAndRenderBlogPosts();
}

function clearAdminPostSearchFilter() {
    currentAdminPostFilters.search = '';
    const searchInput = document.getElementById('postSearchInput');
    if (searchInput) searchInput.value = '';
    currentAdminPostPage = 1;
    loadAndRenderBlogPosts();
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
                <td>${esc(post.title)} ${post.is_featured ? '<i class="fas fa-star" title="已推荐" style="color:orange;"></i>':''}</td>
                <td>${esc(post.author_username || 'N/A')}</td>
                <td>${post.book_isbn ? `${esc(post.book_title || '未知')} (${esc(post.book_isbn)})` : '-'}</td>
                <td>${(post.topics && post.topics.length > 0) ? post.topics.map(t => esc(t.name)).join(', ') : '-'}</td>
                <td><span class="status-badge status-${esc(post.status)}">${esc(post.status)}</span></td>
                <td>${post.published_date || '-'}</td>
                <td>
                    <button class="btn-edit btn-sm" onclick="navigateToBlogPostForm(${post.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-info btn-sm" onclick="promptChangePostStatus(${post.id}, '${esc(post.status)}')"><i class="fas fa-sync-alt"></i></button>
                    <button class="btn-warning btn-sm" onclick="togglePostFeature(${post.id}, ${post.is_featured})">
                        <i class="fas ${post.is_featured ? 'fa-star-slash' : 'fa-star'}"></i> ${post.is_featured ? '取消推荐' : '设为推荐'}
                    </button>
                    <button class="btn-delete btn-sm" onclick="confirmDeleteBlogPost(${post.id})"><i class="fas fa-trash"></i></button>
                    <button class="btn-secondary btn-sm" onclick="previewBlogPost(${post.id})" title="预览"><i class="fas fa-eye"></i></button> 
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
                    <button type="button" class="btn-secondary" onclick="previewCurrentBlogPostForm()" id="previewFormBtn"><i class="fas fa-eye"></i> 预览</button>
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

// 新增函数
async function togglePostFeature(postId, currentIsFeatured) {
    const actionText = currentIsFeatured ? "取消推荐" : "设为推荐";
    showConfirm(`确定要${actionText}文章 ID: ${postId} 吗？`, async (confirmed) => {
        if (confirmed) {
            try {
                // 后端需要一个 API 来切换 is_featured 状态
                // 例如：POST /api/admin/blog/posts/:postId/feature (toggle)
                // 或者 PUT /api/admin/blog/posts/:postId/feature-status { is_featured: true/false }
                // 我们这里假设一个切换 API
                const response = await apiCall(`/api/admin/blog/posts/${postId}/feature`, 'POST'); // POST 通常用于触发动作
                if (response.success) {
                    showAlert(`文章已成功${actionText}！`, '成功', 'success');
                    // 刷新当前视图以更新按钮和星标
                    const currentFilters = getCurrentAdminPostFilters();
                    const currentPageNum = getCurrentAdminPostPage();
                    // 如果是客户端筛选，直接更新 allFetchedAdminPosts 中的数据并重新渲染当前页
                    const postInCache = allFetchedAdminPosts.find(p => p.id === postId);
                    if (postInCache) {
                        postInCache.is_featured = response.is_featured; // 假设 API 返回新的状态
                        renderFilteredAndPaginatedPosts(); // 只重新渲染表格和分页
                    } else {
                        loadAndRenderBlogPosts(currentPageNum, currentFilters); // 完整刷新（如果数据不在缓存）
                    }
                } else {
                    showAlert(`${actionText}失败：${response.message}`, '错误', 'error');
                }
            } catch (error) {
                showAlert(`${actionText}时出错：${error.message}`, '网络错误', 'error');
            }
        }
    });
}
function previewBlogPost(postIdOrSlug) {
    // 假设你的博客文章详情页 URL 是 blog-post.html?id=<id> 或 blog-post.html?slug=<slug>
    // 最好是使用 slug，如果 slug 是唯一的且用于 URL
    // 如果没有 slug，就用 ID
    if (currentUserRole !== 'admin') { // 检查全局角色变量
        if (contentArea) contentArea.innerHTML = `<div class="content-section"><h2>权限不足</h2><p>您没有权限查看博客文章管理。</p></div>`;
        showAlert('您没有权限访问此功能。', '权限不足', 'error');
        return;
    }
    if (!postIdOrSlug) {
        showAlert("无法预览：文章 ID 或 Slug 缺失。", "错误", "error");
        return;
    }
    // 构建面向用户的文章详情页 URL。你需要知道这个 URL 的结构。
    // 例如，如果你的用户博客部署在与 admin 不同的地方，或者有特定路径。
    // 简单假设它在同一站点下，路径为 blog-post.html
    const previewUrl = `../blog-post.html?${/^\d+$/.test(postIdOrSlug) ? 'id' : 'slug'}=${encodeURIComponent(postIdOrSlug)}`;
    window.open(previewUrl, '_blank'); // 在新标签页中打开
}

// 新增函数
function previewCurrentBlogPostForm() {
    const form = document.getElementById('blogPostForm');
    if (!form) return;

    // 1. 同步 Quill 内容到隐藏字段 (如果还没有做)
    if (typeof syncAllQuillEditorsToHiddenInputs === 'function') {
        syncAllQuillEditorsToHiddenInputs();
    } else if (quillPostEditorInstance) {
        document.getElementById('postContentHidden').value = quillPostEditorInstance.root.innerHTML;
    }

    // 2. 收集表单数据 (特别是 title, content, slug 如果有的话)
    const title = form.elements['title'] ? form.elements['title'].value : '（无标题）';
    const content = form.elements['content'] ? form.elements['content'].value : '<p>（无内容）</p>';
    // 对于新文章，可能还没有 slug。对于已保存的文章，其 slug 应该在 postData 中。
    // 如果是编辑现有文章，currentEditingPostId 会有值，可以从那里获取 slug
    // 如果是新文章，预览时可能无法直接用 slug，除非你先保存草稿获取 slug。
    
    // 方案 A: 简单预览 (直接在新标签页打开一个包含当前表单内容的临时页面 - 复杂)
    // 方案 B: 如果是已保存的文章 (currentEditingPostId 存在)，则用其 ID/Slug 打开用户端详情页
    // 方案 C: 将当前表单的内容（特别是标题和 Quill 内容）传递给一个预览模态框或新页面进行渲染
    //         这需要一个专门的预览渲染逻辑，与 blog-post-detail.js 类似。

    // 我们先实现方案 B (如果是编辑状态)
    if (currentEditingPostId) {
        // 假设 postData (在 renderBlogPostForm 中加载的) 包含 slug
        // 或者我们需要重新获取一下最新的 slug
        let slugToUse = '';
        const postBeingEdited = allFetchedAdminPosts.find(p => p.id === currentEditingPostId); // 尝试从缓存获取
        if (postBeingEdited && postBeingEdited.slug) {
            slugToUse = postBeingEdited.slug;
        } else {
            // 如果缓存没有或没有 slug，就用 ID
            previewBlogPost(currentEditingPostId.toString()); // 调用之前的预览函数
            return;
        }
        previewBlogPost(slugToUse);
        return;
    }

    // 对于新文章的预览 (方案 C 的简化版：将内容存入 localStorage，由预览页读取)
    const previewData = {
        title: title,
        content: content,
        author_username: "当前管理员", // 或从当前登录信息获取
        published_at: new Date().toISOString(), // 示意
        topics: [], // 预览时可能不方便带上动态选择的话题
        book_title: form.elements['book_isbn']?.value ? '关联书籍预览' : null
    };
    localStorage.setItem('blogPostPreviewData', JSON.stringify(previewData));
    
    // 打开一个通用的预览页面，该页面会从 localStorage 读取 'blogPostPreviewData'
    const previewPageUrl = `../blog-post-preview.html`; // 你需要创建这个 HTML 文件
    window.open(previewPageUrl, '_blank');
}