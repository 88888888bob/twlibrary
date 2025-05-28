// js/blog-main-list.js
// Depends on: blog-common.js (blogApiCall, renderBlogPagination, escapeHTML, checkUserLoginStatus, updateUserNav, updateCopyrightYear, ITEMS_PER_PAGE)

let currentPage = 1;
let currentFilters = {}; // { search: '', topic_id: '', book_isbn: '', user_id: '' }

document.addEventListener('DOMContentLoaded', async () => { // 改为 async 以便 await
    // currentUserForBlogList = await checkUserLoginStatus(); // 在 initializeBlogListPage 中处理
    // updateUserNav(currentUserForBlogList); // 在 initializeBlogListPage 中处理
    initializeBlogListPage(); // 已包含用户检查和导航更新
    setupEventListeners();
    updateCopyrightYear(); 
});

async function initializeBlogListPage() { // 改为 async
    const user = await checkUserLoginStatus(); 
    // currentUserForBlogList = user; // 如果其他地方需要这个变量，可以取消注释
    updateUserNav(user); 
    
    loadBlogPosts(); 
    loadTopicsSidebar(); 
}

function setupEventListeners() {
    const searchForm = document.getElementById('blogSearchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchInput = document.getElementById('blogSearchInput');
            currentFilters.search = searchInput.value.trim();
            currentPage = 1; // Reset to first page on new search
            loadBlogPosts();
        });
    }
    // Add listeners for topic clicks in sidebar later when topics are loaded
}

async function loadBlogPosts() {
    const listContainer = document.getElementById('blogPostsListContainer');
    const paginationContainer = document.getElementById('blogPaginationContainer');
    if (!listContainer || !paginationContainer) return;

    listContainer.innerHTML = '<div class="loading-placeholder"><p>正在加载文章...</p></div>';
    paginationContainer.innerHTML = '';

    const queryParams = new URLSearchParams({ 
        page: currentPage, 
        limit: ITEMS_PER_PAGE 
    });

    if (currentFilters.search) queryParams.append('search', currentFilters.search);
    if (currentFilters.topic_id) queryParams.append('topic_id', currentFilters.topic_id);
    if (currentFilters.book_isbn) queryParams.append('book_isbn', currentFilters.book_isbn);

    // --- 新增：如果用户已登录，则请求内容预览 ---
    // 需要先在 initializeBlogListPage 中获取 currentUserForBlogList
    // 或者再次调用 checkUserLoginStatus()，但前者更好（避免重复调用）
    // 为了简单，我们再次检查（理想情况是模块级变量）
    const userForPreviewCheck = await checkUserLoginStatus(); // 或者使用 currentUserForBlogList
    if (userForPreviewCheck) { // 只有登录用户才请求预览
        queryParams.append('preview_length', 150); // 例如请求 150 字符的预览
        console.log("[BlogMainList] Logged in user detected, requesting content preview.");
    } else {
        console.log("[BlogMainList] User not logged in, full content will be fetched (or restricted by backend).");
    }
    // --- 内容预览参数添加结束 ---

    try {
        const response = await blogApiCall(`/blog/posts?${queryParams.toString()}`);
        if (response.success && response.data) {
            renderBlogPosts(response.data, !!userForPreviewCheck); // 传递一个标志指示是否为预览
            renderBlogPagination(response.pagination, paginationContainer, (newPage) => {
                currentPage = newPage;
                loadBlogPosts();
            });
        } else {
            listContainer.innerHTML = `<p class="error-message">无法加载文章：${response.message || '未知错误'}</p>`;
        }
    } catch (error) {
        console.error("Error loading blog posts:", error);
        listContainer.innerHTML = `<p class="error-message">加载文章时发生网络错误。</p>`;
    }
}

function renderBlogPosts(posts, isPreviewRequested = false) {
    const listContainer = document.getElementById('blogPostsListContainer');
    if (!listContainer) {
        console.error("[BlogMainList] listContainer not found for rendering posts.");
        return;
    }

    if (!posts || posts.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; padding: 20px;">暂无符合条件的文章。</p>';
        return;
    }

    const esc = typeof escapeHTML === 'function' ? escapeHTML : (text) => text;
    let postsHtml = '';
    let isFirstPost = true; // 用于标记是否是第一个帖子 (潜在的焦点文章)

    posts.forEach(post => {
        const authorName = esc(post.author_username || '匿名作者');
        const topicsHtml = post.topics && post.topics.length > 0 
            ? post.topics.map(topic => `<a href="blog.html?topic_id=${topic.id}" class="topic-tag">${esc(topic.name)}</a>`).join(' ')
            : '';
        const publishedDate = post.published_date || (post.published_at_formatted ? post.published_at_formatted.split(' ')[0] : (post.published_at ? formatUtcToLocalDateCommon(post.published_at, true) : '未知日期'));
        
        const isFeaturedPostForLayout = isFirstPost && currentPage === 1 && !currentFilters.search && !currentFilters.topic_id && !currentFilters.book_isbn; // 只有在第一页且无筛选时，第一个帖子作为焦点
        const cardClass = isFeaturedPostForLayout ? 'post-card featured' : 'post-card';
        const imageClass = isFeaturedPostForLayout ? 'post-image' : 'post-image-small';
        
        const featuredStar = post.is_featured ? '<span class="featured-star-public" title="推荐文章"><i class="fas fa-star"></i></span>' : '';


        let contentToDisplay = '';
        if (isPreviewRequested && post.content && post.content.endsWith('...')) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = post.content; 
            contentToDisplay = esc(tempDiv.textContent || tempDiv.innerText || ""); 
            if (!contentToDisplay.endsWith('...')) contentToDisplay += '...';
            contentToDisplay = `<p class="post-excerpt">${contentToDisplay}</p>`; // 使用 prototype 中的 .post-excerpt 类
        } else if (post.excerpt) {
            contentToDisplay = `<p class="post-excerpt">${esc(post.excerpt)}</p>`;
        } else if (post.content) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = post.content;
            let shortContent = (tempDiv.textContent || tempDiv.innerText || "").substring(0, isFeaturedPostForLayout ? 250 : 120); // 焦点文章摘要更长
            if ((tempDiv.textContent || tempDiv.innerText || "").length > (isFeaturedPostForLayout ? 250 : 120)) shortContent += "...";
            contentToDisplay = `<p class="post-excerpt">${esc(shortContent)}</p>`;
        }

        postsHtml += `
            <article class="${cardClass} ${post.is_featured ? 'featured-post-card' : ''}"> 
                ${post.featured_image_url ? `<a href="blog-post.html?id=${post.id}" class="post-thumbnail-link"><img src="${esc(post.featured_image_url)}" alt="${esc(post.title)}" class="${imageClass}"></a>` : 
                    (isFeaturedPostForLayout ? `<a href="blog-post.html?id=${post.id}" class="post-thumbnail-link"><img src="https://via.placeholder.com/800x400?text=Featured+Article" alt="Featured Article" class="${imageClass}"></a>` : 
                                              `<a href="blog-post.html?id=${post.id}" class="post-thumbnail-link"><img src="https://via.placeholder.com/300x200?text=Article" alt="Article" class="${imageClass}"></a>`)}
                <div class="post-content">
                    <div class="post-meta">
                        ${topicsHtml ? `<span class="post-category">${topicsHtml}</span>` : ''}
                        <span class="post-date">${publishedDate}</span>
                        <span class="post-author">作者：${authorName}</span>
                    </div>
                    <h2 class="post-title">
                        <a href="blog-post.html?id=${post.id}">${esc(post.title)}</a>
                        ${featuredStar}
                    </h2>
                    ${contentToDisplay}
                    ${post.book_title ? `<p class="post-book-association" style="font-size:0.9em; color:#555;">评《<a href="blog.html?book_isbn=${esc(post.book_isbn)}">${esc(post.book_title)}</a>》</p>` : ''}
                    <div class="post-actions" style="margin-top:15px;"> ${/* 对应 prototype 中的 post-actions */''}
                        <a href="blog-post.html?id=${post.id}#commentsSection" class="action-link"><i class="fas fa-comments"></i> ${post.comment_count || 0} 条评论</a>
                        <span class="action-link"><i class="fas fa-eye"></i> ${post.view_count || 0} 次阅读</span>
                        <span class="action-link"><i class="fas fa-thumbs-up"></i> ${post.like_count || 0} 次点赞</span>
                    </div>
                    ${isFeaturedPostForLayout ? `<a href="blog-post.html?id=${post.id}" class="read-more">阅读全文 →</a>` : ''}
                </div>
            </article>
        `;
        if (isFeaturedPostForLayout) {
            postsHtml += `<h3 class="section-title" style="margin-top: 30px; font-size: 1.6em; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #eee;">最新发布</h3>`;
        }
        isFirstPost = false;
    });
    listContainer.innerHTML = postsHtml;
}

async function loadTopicsSidebar() {
    const topicsContainer = document.getElementById('topicsWidgetContainer');
    if (!topicsContainer) return;
    try {
        const response = await blogApiCall('/blog/topics?limit=10'); // Get top 10 topics for sidebar
        if (response.success && response.data) {
            renderTopicsWidget(response.data);
        } else {
            topicsContainer.innerHTML += '<p>无法加载话题。</p>';
        }
    } catch (error) {
        console.error("Error loading topics for sidebar:", error);
        topicsContainer.innerHTML += '<p>加载话题出错。</p>';
    }
}

function renderTopicsWidget(topics) {
    const topicsContainer = document.getElementById('topicsWidgetContainer');
    if (!topicsContainer) return;
    const esc = typeof escapeHTML === 'function' ? escapeHTML : (text) => text;

    if (!topics || topics.length === 0) {
        topicsContainer.innerHTML = '<h4 class="widget-title">热门话题</h4><p>暂无话题。</p>';
        return;
    }
    let topicsHtml = '<h4 class="widget-title">热门话题</h4><ul class="widget-list">';
    topics.forEach(topic => {
        topicsHtml += `<li><a href="#" data-topic-id="${topic.id}" class="sidebar-topic-link">${esc(topic.name)}</a> <span class="count">(${topic.post_count || 0})</span></li>`;
    });
    topicsHtml += '</ul>';
    topicsContainer.innerHTML = topicsHtml;

    // Add event listeners for topic links
    topicsContainer.querySelectorAll('.sidebar-topic-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            currentFilters.topic_id = e.target.dataset.topicId;
            currentFilters.search = ''; // Clear search when topic is clicked
            document.getElementById('blogSearchInput').value = '';
            currentPage = 1;
            loadBlogPosts();
        });
    });
}