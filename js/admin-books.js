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


// --- Navigation entry points ---
function showBookList() { loadBookListLogic(); }
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

function renderBookListTable(books) {
    const bookListDiv = document.getElementById('bookListContainer');
    if (!bookListDiv) { console.error("bookListContainer element not found!"); return; }
    if (!books || books.length === 0) { bookListDiv.innerHTML = '<p>Cannot find a matching book. 没有找到匹配的图书。</p>'; return; }
    // Ensure escapeHtml is available
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text; 

    bookListDiv.innerHTML = `
        <table class="data-table book-table">
            <thead><tr><th>ISBN</th><th>Book Name书名</th><th>Author作者</th><th>Publisher 出版社</th><th>Book Copies馆藏 (可用/总 Usable/Total)</th><th>Status状态</th><th>Operation 操作</th></tr></thead>
            <tbody>
                ${books.map(book => `
                    <tr>
                        <td>${esc(book.isbn)}</td><td>${esc(book.title)}</td><td>${esc(book.author) || '-'}</td>
                        <td>${esc(book.publisher) || '-'}</td><td>${esc(book.available_copies)}/${esc(book.total_copies)}</td>
                        <td>${esc(book.status)}</td>
                        <td>
                            <button class="btn-edit btn-sm" onclick="renderEditBookForm('${esc(book.isbn)}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete btn-sm" onclick="deleteBook('${esc(book.isbn)}')"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

// --- Add Book Logic ---
function renderAddBookForm() {
    const categoryOptions = bookCategories.map(cat => `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`).join('');
    contentArea.innerHTML = `
        <div class="content-section">
            <div class="form-container">
                <h2><i class="fas fa-plus-circle"></i> 添加新书</h2>
                <form id="addBookForm" onsubmit="submitAddBookForm(event)">
                    <div class="form-group"><label for="isbn">ISBN<span class="required-star">*</span>:</label><input type="text" id="isbn" name="isbn" required></div>
                    <div class="form-group"><label for="title">Name 书名<span class="required-star">*</span>:</label><input type="text" id="title" name="title" required></div>
                    <div class="form-group"><label for="author">Author 作者：</label><input type="text" id="author" name="author"></div>
                    <div class="form-group"><label for="publisher">Publisher 出版社：</label><input type="text" id="publisher" name="publisher"></div>
                    <div class="form-group"><label for="publication_date">Publication Date 出版日期：</label><input type="date" id="publication_date" name="publication_date"></div>
                    <div class="form-group"><label for="category_id">Book Category 图书分类<span class="required-star">*</span>:</label><select id="category_id" name="category_id" required><option value="">请选择分类...</option>${categoryOptions}</select></div>
                    <div class="form-group"><label for="total_copies">Total copies in library 总馆藏量：</label><input type="number" id="total_copies" name="total_copies" value="1" min="1"></div>
                    <div class="form-group"><label for="status">Status 状态：</label><select id="status" name="status"><option value="在馆">在馆</option><option value="遗失">遗失</option><option value="维护中">维护中</option></select></div>
                    <div class="form-actions">
                        <button type="submit" class="btn-submit"><i class="fas fa-check"></i>Submit 提交</button>
                        <button type="button" class="btn-cancel" onclick="dispatchAction('showBookList')"><i class="fas fa-times"></i>Cancel 取消</button>
                    </div>
                    <p style="margin-top:15px; font-size:0.9em; color: #666;"><span class="required-star">*</span>Must write options. 表示必填项。</p>
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
        status: form.status.value || 'In Library 在馆' 
    };
    try {
        const result = await apiCall('/addbooks', 'POST', bookData);
        if (result.success) { 
            showAlert('Book adding successful! 图书添加成功！', '成功', 'success'); 
            dispatchAction('showBookList'); 
        } else { 
            showAlert('Error in adiing添加失败：' + (result.message || 'Unknown error 未知错误'), 'Operation error 操作失败', 'error'); 
        }
    } catch (error) { 
        console.error('Error submitting book form:', error); 
        showAlert(`Error when submitting book details 提交图书时发生错误: ${error.message}`, 'Network error 网络错误', 'error'); 
    }
}

// --- Edit Book Logic ---
async function renderEditBookForm(isbn) { // Renamed from showEditBookForm for consistency
    showLoading();
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;
    try {
        const searchResult = await apiCall(`/searchbooks?isbn=${encodeURIComponent(isbn)}`);
        if (!searchResult.success || !searchResult.results || searchResult.results.length === 0) {
            throw new Error('Cannot find the book requested or loading error. Please try again later. 找不到该图书或加载详情失败。');
        }
        const book = searchResult.results[0];

        const categoryOptions = bookCategories.map(cat => 
            `<option value="${cat.id}" ${book.category_id == cat.id ? 'selected' : ''}>${esc(cat.name)}</option>`
        ).join(''); // Use == for category_id comparison as one might be string, other number

        contentArea.innerHTML = `
            <div class="content-section">
                <div class="form-container">
                    <h2><i class="fas fa-edit"></i> Change Book Details-ISBN 修改图书 - ISBN: ${esc(book.isbn)}</h2>
                    <form id="editBookForm" onsubmit="submitEditBookForm(event, '${esc(book.isbn)}')">
                        <div class="form-group">
                            <label for="edit_title">Name书名：<span class="required-star">*</span>:</label>
                            <input type="text" id="edit_title" name="title" value="${esc(book.title || '')}" required>
                        </div>
                        <div class="form-group">
                            <label for="edit_author">Author作者：</label>
                            <input type="text" id="edit_author" name="author" value="${esc(book.author || '')}">
                        </div>
                        <div class="form-group">
                            <label for="edit_publisher">Publisher出版社：</label>
                            <input type="text" id="edit_publisher" name="publisher" value="${esc(book.publisher || '')}">
                        </div>
                        <div class="form-group">
                            <label for="edit_publication_date">Publication Date 出版日期：</label>
                            <input type="date" id="edit_publication_date" name="publication_date" value="${book.publication_date ? String(book.publication_date).split('T')[0] : ''}">
                        </div>
                        <div class="form-group">
                            <label for="edit_category_id">Book Category 图书分类<span class="required-star">*</span>:</label>
                            <select id="edit_category_id" name="category_id" required>
                                <option value="">Please choose one option 请选择分类...</option>
                                ${categoryOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="edit_total_copies">Total copies in library总馆藏量：</label>
                            <input type="number" id="edit_total_copies" name="total_copies" value="${book.total_copies !== undefined ? book.total_copies : 1}" min="0">
                        </div>
                         <div class="form-group">
                            <label for="edit_available_copies">Available number of books可用馆藏：</label>
                            <input type="number" id="edit_available_copies" name="available_copies" value="${book.available_copies !== undefined ? book.available_copies : 0}" min="0">
                        </div>
                        <div class="form-group">
                            <label for="edit_status">Status状态：</label>
                            <select id="edit_status" name="status">
                                <option value="In library 在馆" ${book.status === 'In library 在馆' ? 'selected' : ''}>In library 在馆</option>
                                <option value="Lost遗失" ${book.status === 'Lost 遗失' ? 'selected' : ''}>Lost 遗失</option>
                                <option value="In maintenance 维护中" ${book.status === 'In maintenence 维护中' ? 'selected' : ''}>In maintenance 维护中</option>
                                <!-- Add other statuses if your backend supports them -->
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn-submit"><i class="fas fa-save"></i>Save and Change 保存更改</button>
                            <button type="button" class="btn-cancel" onclick="dispatchAction('showBookList')"><i class="fas fa-times"></i>Cancel 取消</button>
                        </div>
                        <p style="margin-top:15px; font-size:0.9em; color: #666;"><span class="required-star">*</span>Must write options 表示必填项。</p>
                    </form>
                </div>
            </div>`;
    } catch (error) {
        showAlert(`Error in loading book details加载图书信息失败: ${error.message}`, 'Error 错误', 'error');
        dispatchAction('showBookList');
    }
}

async function submitEditBookForm(event, isbn) {
    event.preventDefault();
    const form = event.target;
    const bookData = {
        title: form.title.value,
        author: form.author.value || null, // Send null if empty
        publisher: form.publisher.value || null,
        publication_date: form.publication_date.value || null,
        category_id: form.category_id.value ? parseInt(form.category_id.value) : null,
        total_copies: form.total_copies.value !== '' ? parseInt(form.total_copies.value) : undefined, // Send undefined if not changed or empty
        available_copies: form.available_copies.value !== '' ? parseInt(form.available_copies.value) : undefined,
        status: form.status.value
    };

    // Optional: Send only changed fields. This requires comparing with original book data.
    // For simplicity, sending all fields and backend PUT handles partial updates.

    try {
        // Backend endpoint is PUT /editbook/:isbn
        const result = await apiCall(`/editbook/${isbn}`, 'PUT', bookData); 
        if (result.success) {
            showAlert('Book Details Changed Successfully图书信息更新成功！', 'Success 成功', 'success');
            dispatchAction('showBookList');
        } else {
            showAlert('Book Details update error更新图书失败：' + (result.message || 'Unknown Error 未知错误'), 'Operation error 操作失败', 'error');
        }
    } catch (error) {
        console.error('Error updating book:', error);
        showAlert(`Error in updating book 更新图书时发生错误: ${error.message}`, 'Network error 网络错误', 'error');
    }
}

// --- Delete Book Logic ---
async function deleteBook(isbn) {
    // Ensure escapeHtml is available for the message if isbn can contain special chars
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;
    showConfirm(`Do you confirm to delete  the book with ISBN of  确定要删除ISBN为 <strong>${esc(isbn)}</strong> ? 的图书吗？`, async (confirmed) => {
        if (confirmed) {
            try {
                const result = await apiCall(`/deletebooks`, 'DELETE', { isbn });
                if (result.success) { 
                    showAlert('Book Deletion success! 图书删除成功！', 'Succcess! 成功', 'success'); 
                    loadBookListLogic(); 
                } else { 
                    showAlert('Deletion error! 删除失败：' + (result.message || 'Unknown Error 未知错误'), 'Operation Error 操作失败', 'error'); 
                }
            } catch (error) { 
                console.error('Error deleting book:', error); 
                showAlert(`Error when deletion of book删除图书时发生错误: ${error.message}`, 'Network Error. Please try again later. 网络错误', 'error'); 
            }
        }
    }, '删除确认');
}
