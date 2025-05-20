// js/blog-submit-form.js
// Depends on: blog-common.js, quill-manager.js

let userQuillEditor = null;
let currentSubmitPostId = null;
let availableTopicsSubmitCache = [];
let siteSettingsCache = {}; // To store blog_post_requires_review

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkUserLoginStatus();
    updateUserNavSubmit(user); // Update nav for this page (navLoginLinkSubmit)
    updateCopyrightYearSubmit(); // Update footer year (currentYearSubmit)

    if (!user) {
        // If not logged in, redirect to login page or show message
        alert("请先登录才能撰写或编辑文章。");
        window.location.href = 'sign_up_login_page.html'; // Adjust if login page name is different
        return;
    }

    fetchSiteSettings(); // Fetch site settings like review requirement
    loadAvailableTopics(); // Load topics for selection

    const urlParams = new URLSearchParams(window.location.search);
    currentSubmitPostId = urlParams.get('postId');

    if (currentSubmitPostId) {
        document.getElementById('formPageTitle').innerHTML = '<i class="fas fa-edit"></i> 编辑文章';
        document.getElementById('userPostIdInput').value = currentSubmitPostId;
        loadPostDataForEditing(currentSubmitPostId);
    } else {
        document.getElementById('formPageTitle').innerHTML = '<i class="fas fa-feather-alt"></i> 撰写新文章';
        // Initialize Quill for new post
        initializeUserQuillEditor('');
        updateSubmitButtonText();
    }
});

function updateUserNavSubmit(user) { /* Similar to updateUserNav in blog-common.js, but uses navLoginLinkSubmit */ }
function updateCopyrightYearSubmit() { /* Similar to updateCopyrightYear in blog-common.js, but uses currentYearSubmit */ }

async function fetchSiteSettings() {
    try {
        // Assuming a general settings endpoint or a specific one for blog settings
        const response = await blogApiCall(`/settings/blog_post_requires_review`); // Use public settings API
        if (response.success) {
            siteSettingsCache['blog_post_requires_review'] = (response.value === 'true');
        } else {
            siteSettingsCache['blog_post_requires_review'] = true; // Default to true if setting not found
        }
    } catch (error) {
        console.error("Failed to fetch site settings for blog:", error);
        siteSettingsCache['blog_post_requires_review'] = true; // Default on error
    }
    updateSubmitButtonText();
}

function updateSubmitButtonText() {
    const submitBtnText = document.getElementById('submitBtnText');
    if (!submitBtnText) return;

    if (currentSubmitPostId) { // Editing mode
        submitBtnText.textContent = '更新文章';
        document.getElementById('saveDraftBtn').style.display = 'inline-block'; // Show save draft for editing
    } else { // New post mode
        const requiresReview = siteSettingsCache['blog_post_requires_review'];
        if (requiresReview) {
            submitBtnText.textContent = '提交审核';
            document.getElementById('userPostStatusInput').value = 'pending_review';
        } else {
            submitBtnText.textContent = '直接发布';
            document.getElementById('userPostStatusInput').value = 'published';
        }
        // User can always save as draft when creating new post
        document.getElementById('saveDraftBtn').style.display = 'inline-block';
    }
}


async function loadAvailableTopics() {
    const topicsContainer = document.getElementById('userTopicSelection');
    if (!topicsContainer) return;
    try {
        const response = await blogApiCall('/blog/topics?limit=1000'); // Get all topics
        if (response.success && response.data) {
            availableTopicsSubmitCache = response.data;
            renderTopicCheckboxes(availableTopicsSubmitCache, []); // Initially no topics selected for new post
        } else {
            topicsContainer.innerHTML = '<p>无法加载话题选项。</p>';
        }
    } catch (error) {
        console.error("Failed to fetch topics for submit form:", error);
        topicsContainer.innerHTML = '<p>加载话题时出错。</p>';
    }
}

function renderTopicCheckboxes(topics, selectedTopicIds = []) {
    const topicsContainer = document.getElementById('userTopicSelection');
    if (!topicsContainer) return;
    const esc = typeof escapeHTML === 'function' ? escapeHTML : (text) => text;

    if (!topics || topics.length === 0) {
        topicsContainer.innerHTML = '<p>暂无可用话题。</p>';
        return;
    }
    let topicOptionsHtml = topics.map(topic => 
        `<span class="topic-checkbox">
            <label>
                <input type="checkbox" name="topic_ids" value="${topic.id}" ${selectedTopicIds.includes(topic.id) ? 'checked' : ''}> 
                ${esc(topic.name)}
            </label>
         </span>`
    ).join('');
    topicsContainer.innerHTML = topicOptionsHtml;
}

function initializeUserQuillEditor(initialContent = '') {
    if (typeof initializeQuillEditor === 'function') { // From quill-manager.js
        userQuillEditor = initializeQuillEditor(
            '#userPostQuillEditor',
            '#userPostContentHidden',
            initialContent,
            'default', // Use 'default' or a more comprehensive toolbar for writing posts
            '在此撰写你的文章...'
        );
    } else {
        console.error("initializeQuillEditor function from quill-manager.js is not available!");
        const editorDiv = document.getElementById('userPostQuillEditor');
        if(editorDiv) editorDiv.innerHTML = "<p style='color:red;'>富文本编辑器加载失败。</p>";
    }
}

async function loadPostDataForEditing(postId) {
    const form = document.getElementById('blogPostUserForm');
    try {
        // User should only be able to fetch their own posts or posts they can admin for editing via a secure endpoint.
        // Using the public GET /api/blog/posts/:postId and then checking ownership is one way.
        // Or have a dedicated GET /api/me/blog/posts/:postId
        const response = await blogApiCall(`/blog/posts/${postId}`, 'GET', null, true); // Send credentials
        if (response.success && response.post) {
            const post = response.post;
            // Security check: ensure current user is the author or admin
            // This should ideally be re-verified on the server on submit, but good for UI too.
            if (currentUser && (currentUser.id === post.user_id || currentUser.role === 'admin')) {
                form.elements['title'].value = post.title || '';
                form.elements['excerpt'].value = post.excerpt || '';
                form.elements['book_isbn'].value = post.book_isbn || '';
                if (post.book_isbn && post.book_title) {
                    document.getElementById('userBookSearchResult').innerHTML = `已关联：${escapeHTML(post.book_title)} (${escapeHTML(post.book_isbn)})`;
                }
                form.elements['featured_image_url'].value = post.featured_image_url || '';
                form.elements['visibility'].value = post.visibility || 'public';
                form.elements['allow_comments'].value = post.allow_comments ? 'true' : 'false';
                form.elements['status'].value = post.status || 'draft'; // Hidden input for status

                initializeUserQuillEditor(post.content || '');
                const selectedTopicIds = post.topics ? post.topics.map(t => t.id) : [];
                renderTopicCheckboxes(availableTopicsSubmitCache, selectedTopicIds); // Re-render checkboxes with selections
                updateSubmitButtonText(); // Update button based on edit mode
            } else {
                alert("您没有权限编辑此文章。");
                window.location.href = 'blog.html';
            }
        } else {
            alert(`加载文章数据失败：${response.message || '未知错误'}`);
            window.location.href = 'blog.html';
        }
    } catch (error) {
        alert(`加载编辑文章时出错：${error.message}`);
        window.location.href = 'blog.html';
    }
}

// Search book function specific to this form's input/result IDs
async function userSearchBookForPost() {
    const query = document.getElementById('userPostBookIsbn').value;
    const resultDiv = document.getElementById('userBookSearchResult');
    // ... (Similar to searchBookForPost in admin-blog-posts.js, but uses 'userPostBookIsbn' and 'userBookSearchResult' IDs)
    // ... calls `userSelectBookForPost` on click
    if (!query.trim()) { resultDiv.innerHTML = '<span style="color:orange;">请输入书名或 ISBN。</span>'; return; }
    resultDiv.innerHTML = '<i>正在搜索...</i>';
    try {
        const response = await blogApiCall(`/blog/search-books?query=${encodeURIComponent(query)}&limit=5`, 'GET', null, true); // Requires login
        if (response.success && response.books && response.books.length > 0) {
            let html = '选择一本书籍:<ul>';
            response.books.forEach(book => {
                html += `<li onclick="userSelectBookForPost('${escapeHTML(book.isbn)}', '${escapeHTML(book.title)}')">${escapeHTML(book.title)} (${escapeHTML(book.isbn)})</li>`;
            });
            html += '</ul>';
            resultDiv.innerHTML = html;
        } else { resultDiv.innerHTML = '<span style="color:red;">未找到匹配的书籍。</span>'; }
    } catch (error) { resultDiv.innerHTML = `<span style="color:red;">搜索出错：${error.message}</span>`; }
}

function userSelectBookForPost(isbn, title) {
    document.getElementById('userPostBookIsbn').value = isbn;
    document.getElementById('userBookSearchResult').innerHTML = `已关联：${escapeHTML(title)} (${escapeHTML(isbn)})`;
}

async function saveDraft() {
    document.getElementById('userPostStatusInput').value = 'draft';
    // Manually trigger form submission logic but with status as 'draft'
    await submitUserBlogPostForm(new Event('submit'), true); // Pass a flag to indicate it's a draft save
}

async function submitUserBlogPostForm(event, isDraftSave = false) {
    event.preventDefault();
    if (typeof syncAllQuillEditorsToHiddenInputs === 'function') { // From quill-manager.js
        syncAllQuillEditorsToHiddenInputs();
    } else if (userQuillEditor) {
        document.getElementById('userPostContentHidden').value = userQuillEditor.root.innerHTML;
    }

    const form = document.getElementById('blogPostUserForm');
    const formData = new FormData(form);
    const postData = {};
    const selectedTopicIds = [];

    formData.forEach((value, key) => {
        if (key === 'topic_ids') {
            selectedTopicIds.push(parseInt(value));
        } else if (key === 'allow_comments') {
            postData[key] = (value === 'true');
        } else if (key !== 'postId') { // Don't include postId from hidden input in body for create
            postData[key] = value;
        }
    });
    if (selectedTopicIds.length > 0) {
        postData.topic_ids = selectedTopicIds;
    }
    
    // If it's a draft save, override status from form data
    if (isDraftSave) {
        postData.status = 'draft';
    }
    // If not a draft save and not editing, status is already set by updateSubmitButtonText
    // If editing, status comes from the form (unless admin has special logic)

    const postId = currentSubmitPostId;
    const endpoint = postId ? `/blog/posts/${postId}` : '/api/blog/posts';
    const method = postId ? 'PUT' : 'POST';

    try {
        const response = await blogApiCall(endpoint, method, postData, true); // Requires auth
        if (response.success) {
            alert(`文章已成功${isDraftSave ? '保存为草稿' : (postId ? '更新' : (siteSettingsCache['blog_post_requires_review'] ? '提交审核' : '发布'))}！`);
            window.location.href = 'blog.html'; // Redirect to blog list
        } else {
            alert(`操作失败：${response.message || '未知错误'}`);
        }
    } catch (error) {
        alert(`提交文章时发生错误：${error.message}`);
    }
}

// Helper functions for this page, similar to admin side but with different element IDs
// updateUserNavSubmit, updateCopyrightYearSubmit (can be simplified if IDs are same as blog-common)
function updateUserNavSubmit(user) {
    const loginLink = document.getElementById('navLoginLinkSubmit');
    // ... rest is same as updateUserNav in blog-common.js
    if (user && loginLink) {
        loginLink.textContent = `${escapeHTML(user.username)} (登出)`;
        loginLink.href = "#logout";
        loginLink.onclick = (e) => { e.preventDefault(); alert('登出功能待实现'); };
    } else if (loginLink) {
        loginLink.textContent = '登录/注册';
        loginLink.href = 'sign_up_login_page.html';
        loginLink.onclick = null;
    }
}
function updateCopyrightYearSubmit() {
    const yearSpan = document.getElementById('currentYearSubmit');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
}