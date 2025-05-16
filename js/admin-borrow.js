// js/admin-borrow.js
// Assumes API_BASE_URL, contentArea, showAlert, showConfirm, showLoading, apiCall, 
// dispatchAction, openUserSearchModal, borrowDurations are globally available

// --- Globals for this module ---
let currentBorrowFilter = 'all';
let allBorrowedRecords = []; // Cache for borrowed records
const borrowDurations = [ // THIS IS WHERE IT SHOULD BE
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
function showBorrowedRecords() { // Called by data-action (main view for this section)
    loadBorrowedRecordsLogic('all'); // Default to 'all' filter
}
function showOverdueBooks() { // Called by data-action
    loadBorrowedRecordsLogic('all', true); // Load all, then filter to overdue
}


// --- Borrow Book Logic ---
function renderBorrowBookForm() {
    let durationOptionsHtml = borrowDurations.map(d => `<option value="${d.days}">${d.text}</option>`).join('');
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
                        <span class="selected-user-display"></span>
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
                        <button type="button" class="btn-cancel" onclick="dispatchAction('showDashboard')"><i class="fas fa-times"></i> 取消</button>
                    </div>
                </form>
                <p style="margin-top:15px; font-size:0.9em; color: #666;"><span class="required-star">*</span> 表示必填项。</p>
            </div>
        </div>`;
    // Initialize date for 30 days later
    const durationSelect = document.getElementById('borrow_duration_select');
    if (durationSelect) { // Ensure element exists before setting value
        durationSelect.value = '30'; 
        updateDueDateFromDuration();
    }
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
        dueDateInput.value = today.toISOString().split('T')[0]; // YYYY-MM-DD
    }
}

async function submitBorrowBook(event) {
    event.preventDefault(); 
    const form = event.target;
    const borrowData = { 
        isbn: form.borrow_isbn.value, 
        user_id: form.borrow_user_id.value, 
        due_date: form.borrow_due_date.value 
    };
    try {
        const result = await apiCall('/borrowbooks', 'POST', borrowData);
        if (result.success) { 
            showAlert(result.message || '图书借阅成功！', '成功', 'success'); 
            form.reset(); 
            const displayElem = form.querySelector('.selected-user-display');
            if(displayElem) displayElem.textContent = '';
            if (document.getElementById('borrow_duration_select')) { // Re-initialize duration if form still visible
                 document.getElementById('borrow_duration_select').value = '30';
                 updateDueDateFromDuration();
            }
            // dispatchAction('showDashboard'); // Or navigate to borrowed records
        } else { 
            showAlert('借阅失败：' + (result.message || '未知错误'), '操作失败', 'error'); 
        }
    } catch (error) { 
        console.error('Error borrowing book:', error); 
        showAlert(`办理借阅时发生错误：${error.message}`, '网络错误', 'error');
    }
}

// --- Return Book Logic ---
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
                        <span class="selected-user-display"></span>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-submit"><i class="fas fa-undo-alt"></i> 办理归还</button>
                        <button type="button" class="btn-cancel" onclick="dispatchAction('showDashboard')"><i class="fas fa-times"></i> 取消</button>
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
        user_id: form.return_user_id.value 
    };
    try {
        const result = await apiCall('/returnbooks', 'PUT', returnData);
        if (result.success) { 
            showAlert(result.message || '图书归还成功！', '成功', 'success'); 
            form.reset(); 
            const displayElem = form.querySelector('.selected-user-display');
            if(displayElem) displayElem.textContent = '';
            // dispatchAction('showDashboard'); 
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

function renderBorrowedListTable(records, containerId, highlightOverdueStatus = false) {
    const listDiv = document.getElementById(containerId);
    if(!listDiv) { console.error(`${containerId} not found!`); return; }
    if (!records || records.length === 0) { listDiv.innerHTML = "<p>暂无相关记录。</p>"; return; }
    listDiv.innerHTML = `
        <table class="data-table borrowed-table">
            <thead><tr><th>ISBN</th><th>书名</th><th>用户 ID</th><th>用户名</th><th>借阅日期</th><th>应还日期</th><th>归还日期</th><th>状态</th></tr></thead>
            <tbody>
                ${records.map(record => { 
                    const isOverdue = !record.returned && new Date(record.due_date) < new Date(); 
                    const rowStyle = highlightOverdueStatus && isOverdue ? 'style="background-color: #ffebee;"' : ''; 
                    return `<tr ${rowStyle}>
                                <td>${record.isbn}</td><td>${record.book_title || 'N/A'}</td><td>${record.user_id}</td>
                                <td>${record.username || 'N/A'}</td><td>${new Date(record.borrow_date).toLocaleDateString()}</td>
                                <td>${new Date(record.due_date).toLocaleDateString()}</td>
                                <td>${record.returned && record.return_date ? new Date(record.return_date).toLocaleDateString() : '-'}</td>
                                <td>${record.returned ? '已归还' : '借阅中'} ${isOverdue ? '<strong style="color:red;">(逾期)</strong>' : ''}</td>
                            </tr>`; 
                }).join('')}
            </tbody>
        </table>`;
}