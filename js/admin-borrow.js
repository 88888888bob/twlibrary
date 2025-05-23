// js/admin-borrow.js
// Assumes API_BASE_URL, contentArea, showAlert, showConfirm, showLoading, apiCall, 
// dispatchAction, openUserSearchModal, borrowDurations are globally available

// --- Globals for this module ---\
// let allBorrowedRecords = []; // 不再需要缓存所有数据
let currentBorrowPage = 1;
const BORROW_RECORDS_PER_PAGE = 15;
let currentBorrowFilters = { 
    status: 'all', // 'all', 'borrowed', 'returned', 'overdue'
    search: ''     // 用于搜索用户 ID/用户名/邮箱，图书 ISBN/书名
}; 

const borrowDurations = [
    { text: '7 天后', days: 7 }, { text: '15 天后', days: 15 },
    { text: '30 天后 (默认)', days: 30 }, { text: '60 天后', days: 60 },
    { text: '90 天后', days: 90 }
];

// --- Navigation entry points for this module ---
function showBorrowBookForm() { // Called by data-action
    renderBorrowBookForm();
}
function showReturnBookForm() { // Called by data-action
    renderReturnBookForm();
}
function showBorrowedRecords() { 
    currentBorrowPage = 1;
    currentBorrowFilters = { status: 'all', search: '' };
    loadBorrowedRecordsFrameworkAndFetchData();
}
function showOverdueBooks() { 
    currentBorrowPage = 1;
    currentBorrowFilters = { status: 'overdue', search: '' };
    loadBorrowedRecordsFrameworkAndFetchData();
}



// --- Borrowed Records Logic (New framework and data fetching) ---\
function loadBorrowedRecordsFrameworkAndFetchData() {
    console.log("[AdminBorrow] Initializing borrowed records framework.");
    showLoading();
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;
    contentArea.innerHTML = `
        <div class="content-section">
            <h2><i class="fas fa-history"></i> 借阅记录</h2>
            <div class="borrow-filter-header list-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;">
                <div class="filter-pills">
                    <button class="btn-filter-pill ${currentBorrowFilters.status === 'all' ? 'active' : ''}" onclick="applyBorrowStatusFilter('all')">全部</button>
                    <button class="btn-filter-pill ${currentBorrowFilters.status === 'borrowed' ? 'active' : ''}" onclick="applyBorrowStatusFilter('borrowed')">借阅中</button>
                    <button class="btn-filter-pill ${currentBorrowFilters.status === 'returned' ? 'active' : ''}" onclick="applyBorrowStatusFilter('returned')">已归还</button>
                    <button class="btn-filter-pill ${currentBorrowFilters.status === 'overdue' ? 'active' : ''}" onclick="applyBorrowStatusFilter('overdue')">已逾期</button>
                </div>
                <div class="search-container">
                    <input type="text" id="borrowSearchInput" placeholder="搜索用户/图书..." value="${esc(currentBorrowFilters.search || '')}" onkeyup="handleBorrowSearchInput(event)">
                    <button class="btn-search" onclick="applyBorrowSearchFilter()"><i class="fas fa-search"></i> 搜索</button>
                    <button class="btn-cancel" onclick="clearBorrowSearchFilter()" title="清除搜索"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div id="borrowedListContainer"><div class="loading-placeholder"><p>正在准备列表...</p></div></div>
            <div id="borrowPaginationContainer"></div>
        </div>`;
    
    document.getElementById('borrowSearchInput')?.addEventListener('keyup', event => {
        if (event.key === "Enter") applyBorrowSearchFilter();
    });

    fetchAndRenderBorrowedRecords();
}

function handleBorrowSearchInput(event) {
    if (event.key === "Enter") applyBorrowSearchFilter();
}

function applyBorrowStatusFilter(status) {
    currentBorrowFilters.status = status;
    currentBorrowPage = 1;
    console.log(`[AdminBorrow] Applying status filter: '${status}'`);
    // Update active pill button
    const pillsContainer = contentArea.querySelector('.filter-pills');
    if (pillsContainer) {
        pillsContainer.querySelectorAll('.btn-filter-pill').forEach(btn => btn.classList.remove('active'));
        const activeButton = pillsContainer.querySelector(`button[onclick*="'${status}'"]`);
        if (activeButton) activeButton.classList.add('active');
    }
    fetchAndRenderBorrowedRecords();
}


function applyBorrowSearchFilter() {
    const searchInput = document.getElementById('borrowSearchInput');
    currentBorrowFilters.search = searchInput ? searchInput.value.trim() : '';
    currentBorrowPage = 1;
    console.log(`[AdminBorrow] Applying search filter: '${currentBorrowFilters.search}'`);
    fetchAndRenderBorrowedRecords();
}


function clearBorrowSearchFilter() {
    currentBorrowFilters.search = '';
    const searchInput = document.getElementById('borrowSearchInput');
    if (searchInput) searchInput.value = '';
    currentBorrowPage = 1;
    console.log("[AdminBorrow] Search filter cleared.");
    fetchAndRenderBorrowedRecords();
}


async function fetchAndRenderBorrowedRecords() {
    console.log(`[AdminBorrow] Fetching records. Page: ${currentBorrowPage}, Filters:`, currentBorrowFilters);
    const listContainer = document.getElementById('borrowedListContainer');
    const paginationContainer = document.getElementById('borrowPaginationContainer');
    if (!listContainer || !paginationContainer) {
        console.error("[AdminBorrow] Table or pagination container not found.");
        return;
    }
    showLoading(listContainer);
    paginationContainer.innerHTML = '';

    const queryParams = new URLSearchParams({
        page: currentBorrowPage,
        limit: BORROW_RECORDS_PER_PAGE
    });

    // API /managebooks?action=borrowed_records and /managebooks?action=overdue
    // Need to decide how to structure API calls for status filter.
    // Option 1: One endpoint for all records, frontend filters (bad for many records).
    // Option 2: Backend supports status filtering on /managebooks?action=borrowed_records&status=...
    // Option 3: Separate endpoints if logic is very different (already have one for overdue).

    // Let's assume backend /managebooks?action=borrowed_records will handle search
    // And status filtering can be done by changing the action for 'overdue'
    // and using query params for 'borrowed' (returned=0) and 'returned' (returned=1)
    
    let apiAction = 'borrowed_records';
    if (currentBorrowFilters.status === 'overdue') {
        apiAction = 'overdue'; // Backend handles overdue logic specifically
    } else if (currentBorrowFilters.status === 'borrowed') {
        queryParams.append('returned', '0');
    } else if (currentBorrowFilters.status === 'returned') {
        queryParams.append('returned', '1');
    }
    // For 'all', no 'returned' param is sent, backend returns all.

    if (currentBorrowFilters.search) {
        queryParams.append('search', currentBorrowFilters.search);
    }
    
    try {
        const response = await apiCall(`/managebooks?action=${apiAction}&${queryParams.toString()}`);
        if (response.success && response.data) { // Expecting paginated response format
            console.log("[AdminBorrow] Borrowed records fetched successfully:", response);
            renderBorrowedListTable(response.data);
            renderPagination(response.pagination, paginationContainer, (newPage) => {
                currentBorrowPage = newPage;
                fetchAndRenderBorrowedRecords();
            });
        } else {
            listContainer.innerHTML = `<p>无法加载借阅记录：${response.message || '未知错误'}</p>`;
            showAlert(response.message || '加载借阅记录失败', '错误', 'error');
        }
    } catch (error) {
        console.error("Error loading borrowed records:", error);
        listContainer.innerHTML = `<p>加载借阅记录出错：${error.message}</p>`;
        showAlert(`加载借阅记录出错：${error.message}`, '网络错误', 'error');
    }
}









// --- Borrow Book Form (Moved for logical flow) ---
function renderBorrowBookForm() {
    let durationOptionsHtml = borrowDurations.map(d => `<option value="${d.days}" ${d.days === 30 ? 'selected' : ''}>${d.text}</option>`).join('');
    durationOptionsHtml += `<option value="custom">自定义日期</option>`;
    contentArea.innerHTML = `
        <div class="content-section">
             <div class="form-container">
                <h2><i class="fas fa-arrow-circle-up"></i> 办理借阅</h2>
                <form id="borrowBookForm" onsubmit="submitBorrowBook(event)">
                    <div class="form-group">
                        <label for="borrow_isbn">图书 ISBN<span class="required-star">*</span>:</label>
                        <input type="text" id="borrow_isbn" name="borrow_isbn" required>
                    </div>
                    <div class="form-group">
                        <label for="borrow_user_id">用户 ID<span class="required-star">*</span>:</label>
                        <div style="display: flex; align-items: center;">
                            <input type="text" id="borrow_user_id" name="borrow_user_id" required style="flex-grow:1; margin-right:5px;">
                            <button type="button" class="btn btn-search btn-sm" onclick="openUserSearchModal('borrow_user_id')" title="搜索用户"><i class="fas fa-search"></i></button>
                        </div>
                        <span class="selected-user-display" id="borrow_selected_user_display"></span>
                    </div>
                    <div class="form-group">
                        <label for="borrow_duration_select">选择借阅期限:</label>
                        <select id="borrow_duration_select" onchange="updateDueDateFromDuration()">
                            ${durationOptionsHtml}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="borrow_due_date">应还日期<span class="required-star">*</span>:</label>
                        <input type="date" id="borrow_due_date" name="borrow_due_date" required>
                    </div>
                     <div class="form-actions">
                        <button type="submit" class="btn-submit"><i class="fas fa-book-reader"></i> 办理借阅</button>
                        <button type="button" class="btn-cancel" onclick="dispatchAction('showBorrowedRecords')"><i class="fas fa-times"></i> 取消</button>
                    </div>
                </form>
                <p style="margin-top:15px; font-size:0.9em; color: #666;"><span class="required-star">*</span> 表示必填项。</p>
            </div>
        </div>`;
    updateDueDateFromDuration(); // Initialize date
}

function updateDueDateFromDuration() {
    const durationSelect = document.getElementById('borrow_duration_select');
    const dueDateInput = document.getElementById('borrow_due_date');
    if (!durationSelect || !dueDateInput) return;

    const selectedValue = durationSelect.value;
    if (selectedValue === "custom") { 
        dueDateInput.focus(); 
    } else {
        const days = parseInt(selectedValue); 
        const today = new Date(); 
        today.setDate(today.getDate() + days);
        dueDateInput.value = today.toISOString().split('T')[0];
    }
}

async function submitBorrowBook(event) {
    event.preventDefault(); 
    const form = event.target;
    const borrowData = { 
        isbn: form.borrow_isbn.value, 
        user_id: parseInt(form.borrow_user_id.value), // Ensure user_id is int
        due_date: form.borrow_due_date.value 
    };
    try {
        const result = await apiCall('/borrowbooks', 'POST', borrowData);
        if (result.success) { 
            showAlert(result.message || '图书借阅成功！', '成功', 'success'); 
            form.reset(); 
            const displayElem = document.getElementById('borrow_selected_user_display');
            if(displayElem) displayElem.textContent = '';
            updateDueDateFromDuration(); // Reset due date
            // Optionally navigate or refresh current view if it shows borrow stats
        } else { 
            showAlert('借阅失败：' + (result.message || '未知错误'), '操作失败', 'error'); 
        }
    } catch (error) { 
        console.error('Error borrowing book:', error); 
        showAlert(`办理借阅时发生错误：${error.message}`, '网络错误', 'error');
    }
}


// --- Return Book Form (Moved for logical flow) ---
function renderReturnBookForm() {
    contentArea.innerHTML = `
        <div class="content-section">
            <div class="form-container">
                <h2><i class="fas fa-arrow-circle-down"></i> 办理归还</h2>
                <form id="returnBookForm" onsubmit="submitReturnBook(event)">
                    <div class="form-group">
                        <label for="return_isbn">图书 ISBN<span class="required-star">*</span>:</label>
                        <input type="text" id="return_isbn" name="return_isbn" required>
                    </div>
                    <div class="form-group">
                        <label for="return_user_id">用户 ID<span class="required-star">*</span>:</label>
                         <div style="display: flex; align-items: center;">
                            <input type="text" id="return_user_id" name="return_user_id" required style="flex-grow:1; margin-right:5px;">
                            <button type="button" class="btn btn-search btn-sm" onclick="openUserSearchModal('return_user_id')" title="搜索用户"><i class="fas fa-search"></i></button>
                        </div>
                        <span class="selected-user-display" id="return_selected_user_display"></span>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-submit"><i class="fas fa-undo-alt"></i> 办理归还</button>
                        <button type="button" class="btn-cancel" onclick="dispatchAction('showBorrowedRecords')"><i class="fas fa-times"></i> 取消</button>
                    </div>
                </form>
                <p style="margin-top:15px; font-size:0.9em; color: #666;"><span class="required-star">*</span> 表示必填项。</p>
            </div>
        </div>`;
}

async function submitReturnBook(event) {
    event.preventDefault(); 
    const form = event.target;
    const returnData = { 
        isbn: form.return_isbn.value, 
        user_id: parseInt(form.return_user_id.value) // Ensure user_id is int
    };
    try {
        const result = await apiCall('/returnbooks', 'PUT', returnData);
        if (result.success) { 
            showAlert(result.message || '图书归还成功！', '成功', 'success'); 
            form.reset(); 
            const displayElem = document.getElementById('return_selected_user_display');
            if(displayElem) displayElem.textContent = '';
        } else { 
            showAlert('归还失败：' + (result.message || '未知错误'), '操作失败', 'error'); 
        }
    } catch (error) { 
        console.error('Error returning book:', error); 
        showAlert(`办理归还时发生错误：${error.message}`, '网络错误', 'error'); 
    }
}

// --- Borrowed Records Logic ---
async function loadBorrowedRecordsLogic(filterType = 'all', applyOverdueFilterPostLoad = false) {
    currentBorrowFilter = filterType;
    showLoading();
    contentArea.innerHTML = `
        <div class="content-section">
            <h2><i class="fas fa-history"></i> 借阅记录</h2>
            <div class="borrow-filter-header list-header">
                <div>
                    <button class="btn-filter ${filterType === 'all' && !applyOverdueFilterPostLoad ? 'active' : ''}" onclick="filterAndRenderBorrowedRecords('all')"><i class="fas fa-list-ul"></i> 全部</button>
                    <button class="btn-filter ${filterType === 'borrowed' ? 'active' : ''}" onclick="filterAndRenderBorrowedRecords('borrowed')"><i class="fas fa-hourglass-half"></i> 借阅中</button>
                    <button class="btn-filter ${filterType === 'returned' ? 'active' : ''}" onclick="filterAndRenderBorrowedRecords('returned')"><i class="fas fa-check-circle"></i> 已归还</button>
                    <button class="btn-filter ${applyOverdueFilterPostLoad || filterType === 'overdue' ? 'active' : ''}" onclick="filterAndRenderBorrowedRecords('overdue')"><i class="fas fa-exclamation-triangle"></i> 已逾期</button>
                </div>
            </div>
            <div id="borrowedListContainer"></div>
        </div>`;
    
    // Fetch only if 'all' or no data cached or forced to fetch for overdue specific view
    if (filterType === 'all' || allBorrowedRecords.length === 0 || applyOverdueFilterPostLoad) {
        try {
            const data = await apiCall('/managebooks?action=borrowed_records');
            const container = document.getElementById('borrowedListContainer');
            if (data.success && data.results) {
                allBorrowedRecords = data.results;
                if(applyOverdueFilterPostLoad) {
                    filterAndRenderBorrowedRecords('overdue');
                } else {
                    filterAndRenderBorrowedRecords(currentBorrowFilter);
                }
            } else { 
                if(container) container.innerHTML = "<p>无法加载借阅记录或记录为空。</p>"; 
                showAlert(data.message || '加载借阅记录失败', '错误', 'error');
            }
        } catch (error) { 
            console.error("Error loading borrowed records:", error); 
            const c=document.getElementById('borrowedListContainer'); 
            if(c) c.innerHTML = `<p>加载借阅记录出错：${error.message}</p>`;
            showAlert(`加载借阅记录出错：${error.message}`, '网络错误', 'error');
        }
    } else {
         filterAndRenderBorrowedRecords(currentBorrowFilter);
    }
}

function filterAndRenderBorrowedRecords(filter) {
    currentBorrowFilter = filter;
    const header = contentArea.querySelector('.borrow-filter-header'); // Ensure header exists
    if (header) {
        header.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
        const activeButton = header.querySelector(`.btn-filter[onclick*="'${filter}'"]`);
        if(activeButton) activeButton.classList.add('active');
    }


    let filteredRecords = [];
    if (filter === 'all') filteredRecords = allBorrowedRecords;
    else if (filter === 'borrowed') filteredRecords = allBorrowedRecords.filter(r => r.returned === 0);
    else if (filter === 'returned') filteredRecords = allBorrowedRecords.filter(r => r.returned === 1);
    else if (filter === 'overdue') filteredRecords = allBorrowedRecords.filter(r => r.returned === 0 && new Date(r.due_date) < new Date());
    renderBorrowedListTable(filteredRecords, 'borrowedListContainer', filter === 'overdue');
}

function renderBorrowedListTable(records) {
    const listDiv = document.getElementById('borrowedListContainer');
    if(!listDiv) { console.error("borrowedListContainer not found!"); return; }
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;

    if (!records || records.length === 0) { 
        listDiv.innerHTML = "<p>暂无相关记录。</p>"; 
        return; 
    }
    
    listDiv.innerHTML = `
        <table class="data-table borrowed-table">
            <thead>
                <tr>
                    <th>记录 ID</th>
                    <th>图书 ISBN</th>
                    <th>书名</th>
                    <th>用户 ID</th>
                    <th>用户名</th>
                    <th>借阅日期</th>
                    <th>应还日期</th>
                    <th>归还日期</th>
                    <th>状态</th>
                </tr>
            </thead>
            <tbody>
                ${records.map(record => { 
                    const isOverdue = !record.returned && new Date(record.due_date) < new Date(); 
                    let statusText = '';
                    let statusClass = '';
                    if (record.returned) {
                        statusText = '已归还';
                        statusClass = 'status-returned';
                    } else if (isOverdue) {
                        statusText = '逾期未还';
                        statusClass = 'status-overdue';
                    } else {
                        statusText = '借阅中';
                        statusClass = 'status-borrowed';
                    }
                    
                    return `<tr>
                                <td>${record.id}</td>
                                <td>${esc(record.isbn)}</td>
                                <td>${esc(record.book_title || 'N/A')}</td>
                                <td>${record.user_id}</td>
                                <td>${esc(record.username || 'N/A')}</td>
                                <td>${formatUtcToLocalDateCommon(record.borrow_date, true)}</td>
                                <td>${formatUtcToLocalDateCommon(record.due_date, true)}</td>
                                <td>${record.returned && record.return_date ? formatUtcToLocalDateCommon(record.return_date, true) : '-'}</td>
                                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                            </tr>`; 
                }).join('')}
            </tbody>
        </table>`;
}