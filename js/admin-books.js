// js/admin-books.js
// Assumes API_BASE_URL, contentArea, showAlert, showConfirm, showLoading, apiCall are globally available
// or passed/imported if using modules.

// --- Globals for this module ---
let currentBookListData = [];
const bookCategories = [ // Should ideally be fetched from API
    { id: 1, name: '小说 (Fiction)' }, { id: 2, name: '文学 (Literature)' }, { id: 3, name: '历史 (History)' },
    { id: 4, name: '科学 (Science)' }, { id: 5, name: '技术 (Technology)' }, { id: 6, name: '艺术 (Art)' },
    { id: 7, name: '哲学 (Philosophy)' }, { id: 8, name: '传记 (Biography)' }, { id: 9, name: '儿童读物 (Children\'s Books)' },
    { id: 10, name: '其他 (Other)' }
];


// --- Navigation entry points for this module (called by admin-main.js) ---
function showBookList() { // Main entry for book list view
    loadBookListLogic();
}
function showAddBookForm() { // Main entry for add book form view
    renderAddBookForm();
}
// function showEditBookForm(isbn) is called directly with isbn

function showCategoryManagement() {
    contentArea.innerHTML = `<div class="content-section"><h2><i class="fas fa-tags"></i> 图书分类管理</h2><p>此功能待实现。</p></div>`;
}


// --- Book List Logic ---
async function loadBookListLogic() {
    showLoading();
    contentArea.innerHTML = `
        <div class="content-section">
            <h2><i class="fas fa-list"></i> 图书列表</h2>
            <div class="book-list-header list-header">
                <button class="btn-add" onclick="dispatchAction('showAddBookForm')"><i class="fas fa-plus"></i> 添加图书</button>
                <div class="search-container">
                    <input type="text" id="bookSearchInput" placeholder="搜索书名、作者、ISBN..." onkeyup="handleBookSearchInput(event)">
                    <button class="btn-search" onclick="performBookClientSearch()"><i class="fas fa-search"></i> 搜索</button>
                </div>
            </div>
            <div id="bookListContainer"></div>
        </div>`;
    try {
        const data = await apiCall('/searchbooks'); // Using apiCall utility
        const container = document.getElementById('bookListContainer');
        if (data.success && data.results) {
            currentBookListData = data.results;
            renderBookListTable(currentBookListData);
        } else { 
            if(container) container.innerHTML = '<p>无法加载图书列表或列表为空。</p>'; 
            showAlert(data.message || '加载图书失败', '错误', 'error');
        }
    } catch (error) { 
        console.error('Error fetching book list:', error); 
        const c = document.getElementById('bookListContainer'); 
        if(c) c.innerHTML = `<p>加载图书列表时出错：${error.message}</p>`;
        showAlert(`加载图书列表出错：${error.message}`, '网络错误', 'error');
    }
}

function handleBookSearchInput(event) { 
    if (event.key === "Enter") performBookClientSearch(); 
}

function performBookClientSearch() {
    const searchTerm = document.getElementById('bookSearchInput').value.toLowerCase().trim();
    if (!searchTerm) { renderBookListTable(currentBookListData); return; }
    const filteredBooks = currentBookListData.filter(book => 
        (book.title && book.title.toLowerCase().includes(searchTerm)) ||
        (book.author && book.author.toLowerCase().includes(searchTerm)) ||
        (book.isbn && book.isbn.toLowerCase().includes(searchTerm))
    );
    renderBookListTable(filteredBooks);
}

function renderBookListTable(books) {
    const bookListDiv = document.getElementById('bookListContainer');
    if (!bookListDiv) { console.error("bookListContainer element not found!"); return; }
    if (!books || books.length === 0) { bookListDiv.innerHTML = '<p>没有找到匹配的图书。</p>'; return; }
    bookListDiv.innerHTML = `
        <table class="data-table book-table">
            <thead><tr><th>ISBN</th><th>书名</th><th>作者</th><th>出版社</th><th>馆藏 (可用/总)</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
                ${books.map(book => `
                    <tr>
                        <td>${book.isbn}</td><td>${book.title}</td><td>${book.author || '-'}</td>
                        <td>${book.publisher || '-'}</td><td>${book.available_copies}/${book.total_copies}</td>
                        <td>${book.status}</td>
                        <td>
                            <button class="btn-edit btn-sm" onclick="showEditBookForm('${book.isbn}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete btn-sm" onclick="deleteBook('${book.isbn}')"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

// --- Add Book Logic ---
function renderAddBookForm() {
    const categoryOptions = bookCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
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
    event.preventDefault(); const form = event.target;
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
            dispatchAction('showBookList'); 
        } else { 
            showAlert('添加失败：' + (result.message || '未知错误'), '操作失败', 'error'); 
        }
    } catch (error) { 
        console.error('Error submitting book form:', error); 
        showAlert(`提交图书时发生错误: ${error.message}`, '网络错误', 'error'); 
    }
}

// --- Edit Book Logic ---
async function showEditBookForm(isbn) {
    showLoading();
    try {
        // First, get the book details to pre-fill the form
        // Assuming /searchbooks?isbn=... returns a single book if found in results
        const searchResult = await apiCall(`/searchbooks?isbn=${encodeURIComponent(isbn)}`);
        if (!searchResult.success || !searchResult.results || searchResult.results.length === 0) {
            throw new Error('找不到该图书或加载详情失败。');
        }
        const book = searchResult.results[0];

        const categoryOptions = bookCategories.map(cat => 
            `<option value="${cat.id}" ${book.category_id === cat.id ? 'selected' : ''}>${cat.name}</option>`
        ).join('');

        contentArea.innerHTML = `
            <div class="content-section">
                <div class="form-container">
                    <h2><i class="fas fa-edit"></i> 修改图书 - ISBN: ${book.isbn}</h2>
                    <form id="editBookForm" onsubmit="submitEditBookForm(event, '${book.isbn}')">
                        <div class="form-group">
                            <label for="edit_title">书名<span class="required-star">*</span>:</label>
                            <input type="text" id="edit_title" name="title" value="${book.title || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="edit_author">作者：</label>
                            <input type="text" id="edit_author" name="author" value="${book.author || ''}">
                        </div>
                        <div class="form-group">
                            <label for="edit_publisher">出版社：</label>
                            <input type="text" id="edit_publisher" name="publisher" value="${book.publisher || ''}">
                        </div>
                        <div class="form-group">
                            <label for="edit_publication_date">出版日期：</label>
                            <input type="date" id="edit_publication_date" name="publication_date" value="${book.publication_date ? book.publication_date.split('T')[0] : ''}">
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
                            <input type="number" id="edit_total_copies" name="total_copies" value="${book.total_copies || 1}" min="0">
                        </div>
                         <div class="form-group">
                            <label for="edit_available_copies">可用馆藏：</label>
                            <input type="number" id="edit_available_copies" name="available_copies" value="${book.available_copies || 0}" min="0">
                        </div>
                        <div class="form-group">
                            <label for="edit_status">状态：</label>
                            <select id="edit_status" name="status">
                                <option value="在馆" ${book.status === '在馆' ? 'selected' : ''}>在馆</option>
                                <option value="遗失" ${book.status === '遗失' ? 'selected' : ''}>遗失</option>
                                <option value="维护中" ${book.status === '维护中' ? 'selected' : ''}>维护中</option>
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
        showAlert(`加载图书信息失败: ${error.message}`, '错误', 'error');
        dispatchAction('showBookList'); // Go back to list if error
    }
}

async function submitEditBookForm(event, isbn) {
    event.preventDefault();
    const form = event.target;
    const bookData = {
        title: form.title.value,
        author: form.author.value,
        publisher: form.publisher.value,
        publication_date: form.publication_date.value || null,
        category_id: parseInt(form.category_id.value),
        total_copies: parseInt(form.total_copies.value),
        available_copies: parseInt(form.available_copies.value), // Added available_copies
        status: form.status.value
    };

    // Filter out undefined or empty string values if backend expects only changed fields
    // However, your backend PUT /editbook/:isbn seems to handle potentially all fields.

    try {
        const result = await apiCall(`/editbook/${isbn}`, 'PUT', bookData);
        if (result.success) {
            showAlert('图书信息更新成功！', '成功', 'success');
            dispatchAction('showBookList');
        } else {
            showAlert('更新图书失败：' + (result.message || '未知错误'), '操作失败', 'error');
        }
    } catch (error) {
        console.error('Error updating book:', error);
        showAlert(`更新图书时发生错误: ${error.message}`, '网络错误', 'error');
    }
}


// --- Delete Book Logic ---
async function deleteBook(isbn) {
    showConfirm(`确定要删除ISBN为 ${isbn} 的图书吗？`, async (confirmed) => {
        if (confirmed) {
            try {
                const result = await apiCall(`/deletebooks`, 'DELETE', { isbn }); // DELETE body
                if (result.success) { 
                    showAlert('图书删除成功！', '成功', 'success'); 
                    loadBookListLogic(); // Reload the current list view
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