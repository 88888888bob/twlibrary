// js/admin-modals.js
const modalOverlay = document.getElementById('customModal');
const modalTitleElem = document.getElementById('modalTitle');
const modalMessageElem = document.getElementById('modalMessage');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalOkBtn = document.getElementById('modalOkBtn');
let globalConfirmCallback = null; // Renamed to avoid conflict if other files use confirmCallback

function showAlert(message, title = '通知', type = 'info') {
    modalTitleElem.textContent = title;
    modalMessageElem.innerHTML = message;
    modalConfirmBtn.style.display = 'none';
    modalCancelBtn.style.display = 'none';
    modalOkBtn.style.display = 'inline-block';
    
    modalOkBtn.className = 'modal-btn-ok';
    if (type === 'success') modalOkBtn.classList.add('modal-btn-confirm');
    else if (type === 'error') modalOkBtn.classList.add('modal-btn-delete');

    modalOverlay.style.display = 'flex';
    modalOkBtn.onclick = () => modalOverlay.style.display = 'none';
}

function showConfirm(message, callback, title = '请确认') {
    modalTitleElem.textContent = title;
    modalMessageElem.innerHTML = message;
    modalConfirmBtn.style.display = 'inline-block';
    modalCancelBtn.style.display = 'inline-block';
    modalOkBtn.style.display = 'none';
    modalOverlay.style.display = 'flex';
    globalConfirmCallback = callback;
    modalConfirmBtn.onclick = () => {
        modalOverlay.style.display = 'none';
        if (globalConfirmCallback) globalConfirmCallback(true);
    };
    modalCancelBtn.onclick = () => {
        modalOverlay.style.display = 'none';
        if (globalConfirmCallback) globalConfirmCallback(false);
    };
}

// User Search Modal specific logic (can also be in its own file or admin-utils.js)
const userSearchModalOverlay = document.getElementById('userSearchModal');
const userSearchModalInput = document.getElementById('userSearchModalInput');
const userSearchModalResultsDiv = document.getElementById('userSearchModalResults');
let activeUserSearchInputTarget = null;

function openUserSearchModal(targetInputId) {
    activeUserSearchInputTarget = document.getElementById(targetInputId);
    if (!activeUserSearchInputTarget) {
        console.error("Target input ID for user search not found:", targetInputId);
        return;
    }
    userSearchModalInput.value = '';
    userSearchModalResultsDiv.innerHTML = '<p>请输入关键词搜索。</p>';
    userSearchModalOverlay.style.display = 'flex';
    userSearchModalInput.focus();
}

function closeUserSearchModal() {
    userSearchModalOverlay.style.display = 'none';
    activeUserSearchInputTarget = null;
}

async function performUserSearchInModal() {
    // This function depends on API_BASE_URL, so it might be better in admin-utils.js
    // or ensure API_BASE_URL is globally available before this script runs.
    // For now, assuming API_BASE_URL is global.
    if (typeof API_BASE_URL === 'undefined') {
        console.error("API_BASE_URL is not defined for performUserSearchInModal");
        userSearchModalResultsDiv.innerHTML = '<p>配置错误，无法搜索。</p>';
        return;
    }
    const searchTerm = userSearchModalInput.value.trim();
    if (!searchTerm) {
        userSearchModalResultsDiv.innerHTML = '<p>请输入关键词进行搜索。</p>';
        return;
    }
    userSearchModalResultsDiv.innerHTML = '<div class="loading-spinner" style="margin: 10px auto;"></div>';
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users?search=${encodeURIComponent(searchTerm)}`, { credentials: 'include' });
        if (!response.ok) throw new Error('搜索请求失败');
        const data = await response.json();
        if (data.success && data.users && data.users.length > 0) {
            let resultsHtml = '<ul style="list-style:none; padding:0; margin:0;">';
            data.users.forEach(user => {
                resultsHtml += `<li style="padding: 8px 5px; cursor: pointer; border-bottom: 1px solid #f0f0f0;" 
                                    onclick="selectUserFromModal('${user.id}', '${user.username.replace(/'/g, "\\'")}')">
                                    <strong>${user.username}</strong> (${user.email}) - ID: ${user.id}
                                </li>`;
            });
            resultsHtml += '</ul>';
            userSearchModalResultsDiv.innerHTML = resultsHtml;
        } else {
            userSearchModalResultsDiv.innerHTML = '<p>未找到匹配的用户。</p>';
        }
    } catch (error) {
        console.error('Error searching users in modal:', error);
        userSearchModalResultsDiv.innerHTML = '<p>搜索用户时出错，请稍后重试。</p>';
    }
}

function selectUserFromModal(userId, username) {
    if (activeUserSearchInputTarget) {
        activeUserSearchInputTarget.value = userId;
        let displayElem = activeUserSearchInputTarget.parentNode.querySelector('.selected-user-display');
        if (!displayElem) {
            displayElem = document.createElement('span');
            displayElem.className = 'selected-user-display';
            displayElem.style.marginLeft = '10px';
            displayElem.style.fontSize = '0.9em';
            displayElem.style.color = '#007bff';
            // Insert after the button if the button is the direct sibling, else after input
            const button = activeUserSearchInputTarget.nextElementSibling;
            if (button && button.tagName === 'BUTTON') {
                 activeUserSearchInputTarget.parentNode.insertBefore(displayElem, button.nextSibling);
            } else {
                 activeUserSearchInputTarget.parentNode.insertBefore(displayElem, activeUserSearchInputTarget.nextSibling);
            }
        }
        displayElem.textContent = `已选：${username} (ID: ${userId})`;
    }
    closeUserSearchModal();
}