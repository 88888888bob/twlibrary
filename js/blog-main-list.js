// js/blog-main-list.js
// Depends on: blog-common.js (blogApiCall, renderBlogPagination, escapeHTML, checkUserLoginStatus, updateUserNav, updateCopyrightYear, ITEMS_PER_PAGE)

let currentPage = 1;
let currentFilters = {}; // { search: '', topic_id: '', book_isbn: '', user_id: '' }

document.addEventListener('DOMContentLoaded', () => {
    initializeBlogListPage();
    setupEventListeners();
    updateCopyrightYear(); // From blog-common.js
});

async function initializeBlogListPage() {
    const user = await checkUserLoginStatus(); // From blog-common.js
    updateUserNav(user); // From blog-common.js
    
    loadBlogPosts(); // Load initial posts
    loadTopicsSidebar(); // Load topics for sidebar
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
    // Add other filters like user_id if needed for public view

    try {
        const response = await blogApiCall(`/blog/posts?${queryParams.toString()}`);
        if (response.success && response.data) {
            renderBlogPosts(response.data);
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

function renderBlogPosts(posts) {
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

    posts.forEach(post => {
        const authorName = esc(post.author_username || '匿名作者');
        const topicsHtml = post.topics && post.topics.length > 0 
            ? post.topics.map(topic => `<a href="blog.html?topic_id=${topic.id}" class="topic-tag">${esc(topic.name)}</a>`).join(' ')
            : ''; // 如果没有话题，则不显示“未分类”
        const publishedDate = post.published_date || (post.published_at_formatted ? post.published_at_formatted.split(' ')[0] : '未知日期');
        
        // 为推荐文章的卡片添加 'featured-post-card' 类
        // 在标题旁边添加星标
        const featuredClass = post.is_featured ? 'featured-post-card' : '';
        const featuredStar = post.is_featured ? '<span class="featured-star-public" title="推荐文章"><i class="fas fa-star"></i></span>' : '';

        postsHtml += `
            <article class="post-card-item ${featuredClass}">
                ${post.featured_image_url ? `<a href="blog-post.html?id=${post.id}" class="post-thumbnail-link"><img src="${esc(post.featured_image_url)}" alt="${esc(post.title)}" class="post-thumbnail"></a>` : ''}
                <div class="post-card-content">
                    <div class="post-meta-info">
                        <span class="meta-item post-author"><i class="fas fa-user"></i> ${authorName}</span>
                        <span class="meta-item post-date"><i class="fas fa-calendar-alt"></i> ${publishedDate}</span>
                        ${topicsHtml ? `<span class="meta-item post-topics-meta"><i class="fas fa-tags"></i> ${topicsHtml}</span>` : ''}
                    </div>
                    <h2 class="post-title">
                        <a href="blog-post.html?id=${post.id}" class="post-title-link">${esc(post.title)}</a>
                        ${featuredStar}
                    </h2>
                    ${post.excerpt ? `<p class="post-excerpt-text">${esc(post.excerpt)}</p>` : ''}
                    ${post.book_title ? `<p class="post-book-association"><i class="fas fa-book-open"></i> 评《<a href="blog.html?book_isbn=${esc(post.book_isbn)}">${esc(post.book_title)}</a>》</p>` : ''}
                </div>
                <div class="post-card-footer">
                    <a href="blog-post.html?id=${post.id}" class="read-more-link">阅读全文 →</a>
                    <div class="post-stats">
                        <span class="stat-item"><i class="fas fa-eye"></i> ${post.view_count || 0}</span>
                        <span class="stat-item"><i class="fas fa-thumbs-up"></i> ${post.like_count || 0}</span>
                        <span class="stat-item"><i class="fas fa-comments"></i> ${post.comment_count || 0}</span>
                    </div>
                </div>
            </article>
        `;
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