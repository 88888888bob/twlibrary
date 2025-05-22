const API_BASE_URL = 'https://twapi.bob666.eu.org';
const LOGIN_PAGE_URL = 'login.html';
const contentArea = document.getElementById('contentArea');

/**
 * 将 UTC 时间字符串转换为用户本地时区的日期时间字符串。
 * @param {string} utcDateTimeString - UTC 时间字符串 (例如 'YYYY-MM-DD HH:MM:SS' 或 'YYYY-MM-DDTHH:MM:SSZ')。
 * @param {boolean} [dateOnly=false] - 是否只返回日期部分 (YYYY-MM-DD)。
 * @param {object} [options=null] - 传递给 Date.toLocaleString 的选项。
 * @returns {string} 本地化后的日期时间字符串，或原始字符串如果转换失败。
 */
function formatUtcToLocalDate(utcDateTimeString, dateOnly = false, options = null) {
    if (!utcDateTimeString) {
        return '-'; // 或者适合的占位符
    }
    try {
        // 尝试确保输入是标准 ISO 格式，如果不是，Date 构造函数可能行为不一致
        // 'YYYY-MM-DD HH:MM:SS' 需要替换空格为 'T' 并附加 'Z' (表示 UTC)
        let isoString = utcDateTimeString.replace(' ', 'T');
        if (!isoString.endsWith('Z') && !isoString.includes('+') && !isoString.includes('-')) { // 简单判断是否已有时区信息
            isoString += 'Z';
        }

        const date = new Date(isoString);
        if (isNaN(date.getTime())) { // 无效日期
            console.warn(`formatUtcToLocalDate: Invalid date string provided: ${utcDateTimeString}`);
            return utcDateTimeString; // 返回原始字符串
        }

        if (dateOnly) {
            // 获取本地年、月、日并格式化
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        } else {
            const defaultOptions = {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', // second: '2-digit',
                hour12: false // 使用 24 小时制
            };
            // navigator.language 获取浏览器首选语言，可以用于本地化格式
            return date.toLocaleString(navigator.language || 'zh-CN', options || defaultOptions);
        }
    } catch (e) {
        console.error(`Error formatting date string "${utcDateTimeString}":`, e);
        return utcDateTimeString; // 出错时返回原始字符串
    }
}

function showLoading(containerOrId = contentArea) {
    const container = (typeof containerOrId === 'string') ? document.getElementById(containerOrId) : containerOrId;
    if (container) container.innerHTML = '<div class="loading-spinner"></div>';
}

async function apiCall(endpoint, method = 'GET', body = null, includeCredentials = true) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (includeCredentials) {
        options.credentials = 'include';
    }
    if (body && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok) {
            let errorData;
            try { errorData = await response.json(); } catch (e) { errorData = { message: `HTTP error! status: ${response.status}` }; }
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return { success: true, message: "Operation successful." };
        }
        return await response.json();
    } catch (error) {
        console.error(`API call to ${endpoint} failed:`, error);
        throw new Error(error.message || 'A network error occurred.');
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        if (unsafe === null || unsafe === undefined) return '';
        try {
            return String(unsafe)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        } catch (e) {
            console.warn("Failed to convert to string for HTML escaping:", unsafe, e);
            return ''; // or return a placeholder like '[invalid input]'
        }
    }
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// You can add more utility functions here, like a wrapper for fetch API calls
async function apiCall(endpoint, method = 'GET', body = null, includeCredentials = true) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (includeCredentials) {
        options.credentials = 'include';
    }
    if (body && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { message: `HTTP error! status: ${response.status}` };
            }
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        // For DELETE requests or others that might not return JSON body but are successful
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return { success: true, message: "Operation successful." }; // Or an empty object
        }
        return await response.json();
    } catch (error) {
        console.error(`API call to ${endpoint} failed:`, error);
        // Re-throw a more specific error or a generic one
        throw new Error(error.message || 'A network error occurred.');
    }
}