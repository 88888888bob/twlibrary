// js/admin-books.js
// Assumes API_BASE_URL, contentArea, showAlert, showConfirm, showLoading, apiCall are globally available
// or passed/imported if using modules.

// --- Globals for this module ---\
// let currentBookListData = []; // 不再需要缓存所有数据
let currentBookPage = 1;
const BOOKS_PER_PAGE = 15; // 与后端分页匹配或自定义
let currentBookFilters = { search: '' }; // 可以扩展更多筛选条件

const bookCategories = [ // Should ideally be fetched from API or a shared config
    { id: 1, name: '小说 (Fiction)' }, { id: 2, name: '文学 (Literature)' }, { id: 3, name: '历史 (History)' },
    { id: 4, name: '科学 (Science)' }, { id: 5, name: '技术 (Technology)' }, { id: 6, name: '艺术 (Art)' },
    { id: 7, name: '哲学 (Philosophy)' }, { id: 8, name: '传记 (Biography)' }, { id: 9, name: '儿童读物 (Children\'s Books)' },
    { id: 10, name: '其他 (Other)' }
];



// --- Navigation entry points ---
function showBookList() { 
    currentBookPage = 1; // 重置页码
    currentBookFilters = { search: '' }; // 重置筛选条件
    loadBookListFrameworkAndFetchData(); 
}

function showAddBookForm() { renderAddBookForm(); }
function showCategoryManagement() {
    contentArea.innerHTML = `<div class="content-section"><h2><i class="fas fa-tags"></i>Book Data Management 图书分类管理</h2><p>Work in progess! 此功能待实现。</p></div>`;
}

// --- Book List Logic ---
async function loadBookListLogic() {
    showLoading();
    contentArea.innerHTML = `
        <div class="content-section">
            <h2><i class="fas fa-list"></i>Book List 图书列表</h2>
            <div class="book-list-header list-header">
                <button class="btn-add" onclick="dispatchAction('showAddBookForm')"><i class="fas fa-plus"></i>Add Books 添加图书</button>
                <div class="search-container">
                    <input type="text" id="bookSearchInput" placeholder="搜索书名、作者、ISBN... Search for Name, Author, ISBN..." onkeyup="handleBookSearchInput(event)">
                    <button class="btn-search" onclick="performBookClientSearch()"><i class="fas fa-search"></i>Search 搜索</button>
                </div>
            </div>
            <div id="bookListContainer"></div>
        </div>`;
    try {
        const data = await apiCall('/searchbooks');
        const container = document.getElementById('bookListContainer');
        if (data.success && data.results) {
            currentBookListData = data.results;
            renderBookListTable(currentBookListData);
        } else { 
            if(container) container.innerHTML = '<p>Cannot load book list or book list is empty.无法加载图书列表或列表为空。</p>'; 
            showAlert(data.message || 'Book Load error加载图书失败', '错误', 'error');
        }
    } catch (error) { 
        console.error('Error fetching book list:', error); 
        const c = document.getElementById('bookListContainer'); 
        if(c) c.innerHTML = `<p>Error when loading book list. 加载图书列表时出错：${error.message}</p>`;
        showAlert(`加载图书列表出错：${error.message}`, 'Network error 网络错误', 'error');
    }
}

function handleBookSearchInput(event) { if (event.key === "Enter") performBookClientSearch(); }

function performBookClientSearch() {
    const searchTerm = document.getElementById('bookSearchInput').value.toLowerCase().trim();
    if (!searchTerm) { renderBookListTable(currentBookListData); return; }
    const filteredBooks = currentBookListData.filter(book => 
        (book.title && String(book.title).toLowerCase().includes(searchTerm)) || // Ensure it's a string
        (book.author && String(book.author).toLowerCase().includes(searchTerm)) ||
        (book.isbn && String(book.isbn).toLowerCase().includes(searchTerm))
    );
    renderBookListTable(filteredBooks);
}

function renderBookListTable(books) { // books 参数现在是当前页的数据
    const bookListDiv = document.getElementById('bookListContainer');
    if (!bookListDiv) { console.error("bookListContainer element not found!"); return; }
    if (!books || books.length === 0) { 
        bookListDiv.innerHTML = '<p>没有找到匹配的图书。</p>'; 
        return; 
    }
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text; 

    // 获取 category_name (如果 books 对象中没有，需要从 bookCategories 查找)
    const getCategoryName = (categoryId) => {
        const category = bookCategories.find(cat => cat.id === categoryId);
        return category ? esc(category.name) : '未知分类';
    };

    bookListDiv.innerHTML = `
        <table class="data-table book-table">
            <thead>
                <tr>
                    <th>ISBN</th>
                    <th>书名</th>
                    <th>作者</th>
                    <th>分类</th> 
                    <th>出版社</th>
                    <th>馆藏 (可用/总)</th>
                    <th>状态</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${books.map(book => `
                    <tr>
                        <td>${esc(book.isbn)}</td>
                        <td>${esc(book.title)}</td>
                        <td>${esc(book.author) || '-'}</td>
                        <td>${book.category_name || getCategoryName(book.category_id)}</td> 
                        <td>${esc(book.publisher) || '-'}</td>
                        <td>${esc(book.available_copies)} / ${esc(book.total_copies)}</td>
                        <td>${esc(book.status)}</td>
                        <td>
                            <button class="btn-edit btn-sm" onclick="renderEditBookForm('${esc(book.isbn)}')"><i class="fas fa-edit"></i> 编辑</button>
                            <button class="btn-delete btn-sm" onclick="deleteBook('${esc(book.isbn)}')"><i class="fas fa-trash"></i> 删除</button>
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}


// --- Add Book Form (Moved from original position for logical flow, no functional change) ---
function renderAddBookForm() {
    const categoryOptions = bookCategories.map(cat => `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`).join('');
    contentArea.innerHTML = `
        <div class="content-section">
            <div class="form-container">
                <h2><i class="fas fa-plus-circle"></i> 添加新书</h2>
                <form id="addBookForm" onsubmit="submitAddBookForm(event)">
                    <div class="form-group"><label for="isbn">ISBN<span class="required-star">*</span>:</label><input type="text" id="isbn" name="isbn" required></div>
                    <div class="form-group"><label for="title">书名<span class="required-star">*</span>:</label><input type="text" id="title" name="title" required></div>
                    <div class="form-group"><label for="author">作者：</label><input type="text" id="author" name="author"></div>
                    <div class="form-group"><label for="publisher">出版社：</label><input type="text" id="publisher" name="publisher"></div>
                    <div class="form-group"><label for="publication_date">出版日期：</label><input type="date" id="publication_date" name="publication_date"></div>
                    <div class="form-group"><label for="category_id">图书分类<span class="required-star">*</span>:</label><select id="category_id" name="category_id" required><option value="">请选择分类...</option>${categoryOptions}</select></div>
                    <div class="form-group"><label for="total_copies">总馆藏量：</label><input type="number" id="total_copies" name="total_copies" value="1" min="1"></div>
                    <div class="form-group"><label for="status">状态：</label><select id="status" name="status"><option value="在馆">在馆</option><option value="遗失">遗失</option><option value="维护中">维护中</option></select></div>
                    <div class="form-actions">
                        <button type="submit" class="btn-submit"><i class="fas fa-check"></i> 提交</button>
                        <button type="button" class="btn-cancel" onclick="dispatchAction('showBookList')"><i class="fas fa-times"></i> 取消</button>
                    </div>
                    <p style="margin-top:15px; font-size:0.9em; color: #666;"><span class="required-star">*</span> 表示必填项。</p>
                </form>
            </div>
        </div>`;
}


async function submitAddBookForm(event) {
    event.preventDefault(); 
    const form = event.target;
    const bookData = { 
        isbn: form.isbn.value, title: form.title.value, author: form.author.value, 
        publisher: form.publisher.value, publication_date: form.publication_date.value || null, 
        category_id: parseInt(form.category_id.value), 
        total_copies: parseInt(form.total_copies.value) || 1, 
        status: form.status.value || '在馆' 
    };
    try {
        const result = await apiCall('/addbooks', 'POST', bookData);
        if (result.success) { 
            showAlert('图书添加成功！', '成功', 'success'); 
            dispatchAction('showBookList'); // 返回并刷新列表
        } else { 
            showAlert('添加失败：' + (result.message || '未知错误'), '操作失败', 'error'); 
        }
    } catch (error) { 
        console.error('Error submitting book form:', error); 
        showAlert(`提交图书时发生错误：${error.message}`, '网络错误', 'error'); 
    }
}

// --- Edit Book Logic (renderEditBookForm, submitEditBookForm) ---
async function renderEditBookForm(isbn) { // 注意：这里获取的是单个图书，不是列表
    showLoading();
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;
    try {
        // 后端 /searchbooks?isbn=xxx 返回的是数组，即使只有一个结果
        const searchResult = await apiCall(`/searchbooks?isbn=${encodeURIComponent(isbn)}`);
        if (!searchResult.success || !searchResult.data || searchResult.data.length === 0) { // 检查 data 字段
            throw new Error('找不到该图书或加载详情失败。');
        }
        const book = searchResult.data[0]; // 第一个结果

        const categoryOptions = bookCategories.map(cat => 
            `<option value="${cat.id}" ${book.category_id == cat.id ? 'selected' : ''}>${esc(cat.name)}</option>`
        ).join('');

        contentArea.innerHTML = `
            <div class="content-section">
                <div class="form-container">
                    <h2><i class="fas fa-edit"></i> 修改图书 - ISBN: ${esc(book.isbn)}</h2>
                    <form id="editBookForm" onsubmit="submitEditBookForm(event, '${esc(book.isbn)}')">
                        <div class="form-group">
                            <label for="edit_title">书名<span class="required-star">*</span>:</label>
                            <input type="text" id="edit_title" name="title" value="${esc(book.title || '')}" required>
                        </div>
                        <div class="form-group">
                            <label for="edit_author">作者：</label>
                            <input type="text" id="edit_author" name="author" value="${esc(book.author || '')}">
                        </div>
                        <div class="form-group">
                            <label for="edit_publisher">出版社：</label>
                            <input type="text" id="edit_publisher" name="publisher" value="${esc(book.publisher || '')}">
                        </div>
                        <div class="form-group">
                            <label for="edit_publication_date">出版日期：</label>
                            <input type="date" id="edit_publication_date" name="publication_date" value="${book.publication_date ? String(book.publication_date).split('T')[0] : ''}">
                        </div>
                        <div class="form-group">
                            <label for="edit_category_id">图书分类<span class="required-star">*</span>:</label>
                            <select id="edit_category_id" name="category_id" required>
                                <option value="">请选择分类...</option>
                                ${categoryOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="edit_total_copies">总馆藏量：</label>
                            <input type="number" id="edit_total_copies" name="total_copies" value="${book.total_copies !==undefined ? book.total_copies : 1}" min="0">
                        </div>
                         <div class="form-group">
                            <label for="edit_available_copies">可用馆藏：</label>
                            <input type="number" id="edit_available_copies" name="available_copies" value="${book.available_copies !== undefined ? book.available_copies : 0}" min="0">
                        </div>
                        <div class="form-group">
                            <label for="edit_status">状态：</label>
                            <select id="edit_status" name="status">
                                <option value="在馆" ${book.status === '在馆' ? 'selected' : ''}>在馆 (In Library)</option>
                                <option value="借出" ${book.status === '借出' ? 'selected' : ''}>借出 (Borrowed)</option>
                                <option value="遗失" ${book.status === '遗失' ? 'selected' : ''}>遗失 (Lost)</option>
                                <option value="维护中" ${book.status === '维护中' ? 'selected' : ''}>维护中 (In Maintenance)</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn-submit"><i class="fas fa-save"></i> 保存更改</button>
                            <button type="button" class="btn-cancel" onclick="dispatchAction('showBookList')"><i class="fas fa-times"></i> 取消</button>
                        </div>
                        <p style="margin-top:15px; font-size:0.9em; color: #666;"><span class="required-star">*</span> 表示必填项。</p>
                    </form>
                </div>
            </div>`;
    } catch (error) {
        showAlert(`加载图书信息失败：${error.message}`, '错误', 'error');
        dispatchAction('showBookList');
    }
}

async function submitEditBookForm(event, isbn) {
    event.preventDefault();
    const form = event.target;
    const bookData = {
        title: form.title.value,
        author: form.author.value || null,
        publisher: form.publisher.value || null,
        publication_date: form.publication_date.value || null,
        category_id: form.category_id.value ? parseInt(form.category_id.value) : null,
        total_copies: form.total_copies.value !== '' ? parseInt(form.total_copies.value) : undefined,
        available_copies: form.available_copies.value !== '' ? parseInt(form.available_copies.value) : undefined,
        status: form.status.value
    };

    try {
        const result = await apiCall(`/editbook/${isbn}`, 'PUT', bookData); 
        if (result.success) {
            showAlert('图书信息更新成功！', '成功', 'success');
            dispatchAction('showBookList'); // 返回并刷新列表
        } else {
            showAlert('更新图书失败：' + (result.message || '未知错误'), '操作失败', 'error');
        }
    } catch (error) {
        console.error('Error updating book:', error);
        showAlert(`更新图书时发生错误：${error.message}`, '网络错误', 'error');
    }
}

// --- Delete Book Logic ---
async function deleteBook(isbn) {
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;
    showConfirm(`确定要删除 ISBN 为 <strong>${esc(isbn)}</strong> 的图书吗？`, async (confirmed) => {
        if (confirmed) {
            try {
                const result = await apiCall(`/deletebooks`, 'DELETE', { isbn });
                if (result.success) { 
                    showAlert('图书删除成功！', '成功', 'success'); 
                    fetchAndRenderBooks(); // 只刷新当前页和筛选条件下的数据
                } else { 
                    showAlert('删除失败：' + (result.message || '未知错误'), '操作失败', 'error'); 
                }
            } catch (error) { 
                console.error('Error deleting book:', error); 
                showAlert(`删除图书时发生错误：${error.message}`, '网络错误', 'error'); 
            }
        }
    }, '删除确认');
}


// --- Book List Logic ---\
function loadBookListFrameworkAndFetchData() {
    console.log("[AdminBooks] Initializing book list framework.");
    showLoading();
    contentArea.innerHTML = `
        <div class="content-section">
            <h2><i class="fas fa-list"></i> 图书列表</h2>
            <div class="book-list-header list-header">
                <button class="btn-add" onclick="dispatchAction('showAddBookForm')"><i class="fas fa-plus"></i> 添加图书</button>
                <div class="search-container">
                    <input type="text" id="bookSearchInput" placeholder="搜索书名、作者、ISBN..." value="${escapeHtml(currentBookFilters.search || '')}" onkeyup="handleBookSearchInput(event)">
                    <button class="btn-search" onclick="applyBookSearchFilter()"><i class="fas fa-search"></i> 搜索</button>
                    <button class="btn-cancel" onclick="clearBookSearchFilter()" title="清除搜索"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div id="bookListContainer"><div class="loading-placeholder"><p>正在准备列表...</p></div></div>
            <div id="bookPaginationContainer"></div>
        </div>`;
    
    document.getElementById('bookSearchInput')?.addEventListener('keyup', event => {
        if (event.key === "Enter") applyBookSearchFilter();
    });
    
    fetchAndRenderBooks(); // 初始加载第一页数据
}

function handleBookSearchInput(event) { 
    if (event.key === "Enter") applyBookSearchFilter(); 
}

function applyBookSearchFilter() {
    const searchInput = document.getElementById('bookSearchInput');
    currentBookFilters.search = searchInput ? searchInput.value.trim() : '';
    currentBookPage = 1; // 搜索时重置到第一页
    console.log(`[AdminBooks] Applying search filter: '${currentBookFilters.search}'`);
    fetchAndRenderBooks();
}

function clearBookSearchFilter() {
    currentBookFilters.search = '';
    const searchInput = document.getElementById('bookSearchInput');
    if (searchInput) searchInput.value = '';
    currentBookPage = 1;
    console.log("[AdminBooks] Search filter cleared.");
    fetchAndRenderBooks();
}

async function fetchAndRenderBooks() {
    console.log(`[AdminBooks] Fetching books for page: ${currentBookPage}, filters:`, currentBookFilters);
    const bookListContainer = document.getElementById('bookListContainer');
    const paginationContainer = document.getElementById('bookPaginationContainer');
    if (!bookListContainer || !paginationContainer) {
        console.error("[AdminBooks] Table or pagination container not found.");
        return;
    }

    showLoading(bookListContainer); // 在列表容器内显示加载动画
    paginationContainer.innerHTML = ''; // 清空旧的分页

    const queryParams = new URLSearchParams({
        page: currentBookPage,
        limit: BOOKS_PER_PAGE
    });
    if (currentBookFilters.search) {
        // 后端 /searchbooks API 预期的是具体字段的搜索，而不是一个通用的 'search' 参数
        // 这里我们假设用户输入的可能是 title, author, 或 isbn
        // 为了简单起见，如果后端支持一个通用 `search` 参数，则用它。
        // 否则，我们需要决定是只搜索标题，还是前端拆分，或修改后端。
        // 当前后端 /searchbooks 支持 title, author, isbn 等，但不支持一个统一的 'search'
        // 为了演示，我们先假设搜索的是 title
        queryParams.append('title', currentBookFilters.search); 
        // 如果需要更复杂的搜索（如同时搜作者和 ISBN），后端需要支持 OR 条件或者前端发送多个参数
    }
    // 可以添加其他筛选条件，如 queryParams.append('category_id', currentBookFilters.category);

    try {
        const response = await apiCall(`/searchbooks?${queryParams.toString()}`);
        if (response.success && response.data) { // 检查 data 字段，因为 formatPaginatedResponse 返回 data
            console.log("[AdminBooks] Books data fetched successfully:", response);
            renderBookListTable(response.data); // response.data 包含当前页的书籍数组
            renderPagination(response.pagination, paginationContainer, (newPage) => {
                currentBookPage = newPage;
                fetchAndRenderBooks(); // 点击分页按钮时重新获取数据
            });
        } else {
            bookListContainer.innerHTML = `<p>无法加载图书列表：${response.message || '未知错误'}</p>`;
            showAlert(response.message || '加载图书失败', '错误', 'error');
        }
    } catch (error) {
        console.error('Error fetching book list:', error);
        bookListContainer.innerHTML = `<p>加载图书列表时出错：${error.message}</p>`;
        showAlert(`加载图书列表出错：${error.message}`, '网络错误', 'error');
    }
}

