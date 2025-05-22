// js/blog-post-detail.js
// Depends on: blog-common.js (blogApiCall, escapeHTML, checkUserLoginStatus, updateUserNav, updateCopyrightYear)

let currentPostId = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const postIdFromUrl = urlParams.get('id') || urlParams.get('postId') || urlParams.get('slug'); // 支持多种参数名

    if (!postIdFromUrl) {
        displayError("未提供文章 ID 或标识。");
        return;
    }
    const userFromStatus = await checkUserLoginStatus();
    currentUser = userFromStatus; // 赋值给模块级变量
    currentPostId = postIdFromUrl; // slug 也可作为 postId

    currentUser = await checkUserLoginStatus();
    updateUserNav(currentUser); // 更新导航栏登录状态 (navLoginLinkDetail)
    updateCopyrightYearLocal(); // 更新页脚年份 (currentYearDetail)

    loadPostDetail();
});

function updateCopyrightYearLocal() {
    const yearSpan = document.getElementById('currentYearDetail');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
}

async function loadPostDetail() {
    const container = document.getElementById('postDetailContainer');
    if (!container) return;
    container.innerHTML = '<div class="loading-placeholder"><p>正在加载文章内容...</p></div>';

    try {
        const response = await blogApiCall(`/blog/posts/${currentPostId}`, 'GET', null, !!currentUser); // 如果用户登录，可能发送凭证
        if (response.success && response.post) {
            renderPostDetail(response.post);
            // 如果文章内容包含公式，需要 KaTeX 渲染
            if (typeof renderMathInElement === 'function' && response.post.content.includes('katex')) { // renderMathInElement 是 KaTeX 提供的函数
                renderMathInElement(document.getElementById('postContentActual'), {
                    delimiters: [
                        {left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false},
                        {left: "\\(", right: "\\)", display: false}, {left: "\\[", right: "\\]", display: true}
                    ]
                });
            }
            // 如果文章内容包含代码块，需要 highlight.js 渲染
            if (typeof hljs !== 'undefined' && response.post.content.includes('<pre>')) {
                document.querySelectorAll('#postContentActual pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
                // 或者如果 Quill 用特定 class 标记了：hljs.highlightAll();
            }

            // (未来) 加载评论
            // loadCommentsForPost(response.post.id);
            // (未来) 检查用户是否已点赞
            // checkIfUserLiked(response.post.id);
        } else {
            displayError(response.message || "无法加载文章详情。");
        }
    } catch (error) {
        console.error("Error loading post detail:", error);
        displayError("加载文章时发生网络错误。");
    }
}

function renderPostDetail(post) {
    const container = document.getElementById('postDetailContainer');
    if (!container) {
        console.error("[BlogPostDetail] Container not found for rendering post detail.");
        return;
    }
    const esc = typeof escapeHTML === 'function' ? escapeHTML : (text) => text;
    
    document.title = `${esc(post.title)} - 同文学校图书馆`;

    const publishedDate = post.published_at ? formatUtcToLocalDateCommon(post.published_at, false, { year: 'numeric', month: 'long', day: 'numeric' }) : '未发布';
    const updatedDate = post.updated_at ? formatUtcToLocalDateCommon(post.updated_at, false, { day: 'numeric', month: 'short', year: 'numeric' }) : null;

    let topicsHtml = '<span>无</span>';
    if (post.topics && post.topics.length > 0) {
        topicsHtml = post.topics.map(topic => 
            `<a href="blog.html?topic_id=${topic.id}" class="tag-link">${esc(topic.name)}</a>`
        ).join(' ');
    }

    let bookHtml = '';
    if (post.book_isbn && post.book_title) {
        bookHtml = `<a href="blog.html?book_isbn=${esc(post.book_isbn)}" class="book-link">《${esc(post.book_title)}》 (ISBN: ${esc(post.book_isbn)})</a>`;
    }

    let editButtonHtml = '';
    if (currentUser && (currentUser.id === post.user_id || currentUser.role === 'admin')) {
        editButtonHtml = `<a href="blog-submit.html?postId=${post.id}" class="edit-post-link btn btn-sm btn-outline-secondary"><i class="fas fa-edit"></i> 编辑</a>`;
    }
    
    let likeButtonHtml = `<button class="like-button" id="likeBtn" data-post-id="${post.id}">...</button>`; // 保持不变

    // 星标显示
    const featuredStarDetail = post.is_featured ? '<span class="featured-star-public" title="推荐文章" style="margin-left: 10px; font-size: 0.8em;"><i class="fas fa-star"></i></span>' : '';

    const postHtml = `
        <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
            <a href="blog.html" class="btn btn-sm btn-outline-secondary"><i class="fas fa-arrow-left"></i> 返回博客列表</a>
            ${editButtonHtml}
        </div>
        <header class="post-detail-header">
            <h1>${esc(post.title)}${featuredStarDetail}</h1> {/* <--- 星标加在标题旁边 --- */}
            <div class="post-detail-meta">
                <span class="meta-item author"><i class="fas fa-user"></i> ${esc(post.author_username || '匿名作者')}</span>
                <span class="meta-item published-date"><i class="fas fa-calendar-alt"></i> 发布于：${publishedDate}</span>
                ${updatedDate && (new Date(post.updated_at) > new Date(post.created_at)) ? `<span class="meta-item updated-date"><i class="fas fa-history"></i> 更新于：${updatedDate}</span>` : ''}
                <span class="meta-item views"><i class="fas fa-eye"></i> ${post.view_count || 0} 次阅读</span>
            </div>
        </header>
        <div class="post-content-area" id="postContentActual">
            ${post.content}
        </div>
        <div class="post-associations">
            ${bookHtml ? `<h4><i class="fas fa-book"></i> 关联书籍</h4><p>${bookHtml}</p>` : ''}
            <h4><i class="fas fa-tags"></i> 相关话题</h4>
            <div class="tag-cloud">${topicsHtml}</div>
        </div>
        <div class="post-actions-footer">
            ${likeButtonHtml}
            {/* 编辑按钮也可以考虑放在这里 */}
        </div>
    `;
    container.innerHTML = postHtml;

    const likeBtn = document.getElementById('likeBtn');
    if (likeBtn) {
        likeBtn.addEventListener('click', toggleLikePost);
        checkIfUserLiked(post.id);
    }
}
function displayError(message) {
    const container = document.getElementById('postDetailContainer');
    if (container) {
        container.innerHTML = `<p class="error-message" style="text-align:center; color:red; padding:30px;">${escapeHTML(message)}</p>`;
    }
    document.title = "错误 - 文章未找到";
}


// --- 点赞相关功能 (未来) ---
let userLikedThisPost = false; // 假设初始未点赞

async function checkIfUserLiked(postId) {
    if (!currentUser) return; // 未登录用户不能检查点赞状态
    const likeBtn = document.getElementById('likeBtn');
    const likeIcon = likeBtn ? likeBtn.querySelector('i') : null;
    // 你需要一个 API 端点来检查用户是否已点赞某文章
    // 例如 GET /api/blog/posts/{postId}/is-liked (返回 { liked: true/false })
    try {
        // const response = await blogApiCall(`/blog/posts/${postId}/is-liked`, 'GET', null, true);
        // if (response.success && response.liked) {
        //     userLikedThisPost = true;
        //     if(likeBtn) likeBtn.classList.add('liked');
        //     if(likeIcon) { likeIcon.classList.remove('far'); likeIcon.classList.add('fas'); }
        // } else {
        //     userLikedThisPost = false;
        //     if(likeBtn) likeBtn.classList.remove('liked');
        //     if(likeIcon) { likeIcon.classList.remove('fas'); likeIcon.classList.add('far'); }
        // }
        console.warn("checkIfUserLiked API endpoint not implemented yet.");
    } catch (error) {
        console.error("Error checking if user liked post:", error);
    }
}

async function toggleLikePost(event) {
    if (!currentUser) {
        alert("请先登录再点赞！"); // 或者跳转到登录页
        // window.location.href = 'sign_up_login_page.html';
        return;
    }
    const postId = event.currentTarget.dataset.postId;
    const likeCountSpan = document.getElementById('likeCount');
    const likeBtn = event.currentTarget;
    const likeIcon = likeBtn.querySelector('i');

    const method = userLikedThisPost ? 'DELETE' : 'POST';
    const endpoint = `/blog/posts/${postId}/like`;

    try {
        const response = await blogApiCall(endpoint, method, null, true);
        if (response.success) {
            userLikedThisPost = !userLikedThisPost; // 切换状态
            if (likeCountSpan) likeCountSpan.textContent = response.like_count;
            if (userLikedThisPost) {
                likeBtn.classList.add('liked');
                if(likeIcon) { likeIcon.classList.remove('far'); likeIcon.classList.add('fas'); }
            } else {
                likeBtn.classList.remove('liked');
                if(likeIcon) { likeIcon.classList.remove('fas'); likeIcon.classList.add('far'); }
            }
        } else {
            alert(`操作失败：${response.message}`);
        }
    } catch (error) {
        alert(`点赞/取消点赞时发生错误：${error.message}`);
    }
}