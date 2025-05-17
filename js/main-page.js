// js/main-page.js

// 全局常量 (确保与后端 API 和 localStorage 键一致)
const API_BASE_URL_PUBLIC = 'https://twapi.bob666.eu.org'; // 公开 API 的基础 URL，可能与 admin 的不同
const ANNOUNCEMENT_SETTING_KEY = 'announcement_bar_html';
const ANNOUNCEMENT_CACHE_KEY = 'site_announcement'; // localStorage key
const ANNOUNCEMENT_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// DOMContentLoaded 确保在操作 DOM 前，HTML 已完全加载和解析
document.addEventListener('DOMContentLoaded', function() {
    manageAnnouncementDisplay();
});

async function fetchAndUpdateAnnouncement() {
    const announcementBarContainer = document.getElementById('dynamicAnnouncementBarContainer'); // Changed to container
    if (!announcementBarContainer) {
        console.warn("Announcement bar container 'dynamicAnnouncementBarContainer' not found.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL_PUBLIC}/api/settings/${ANNOUNCEMENT_SETTING_KEY}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => null); // Try to parse error, but don't fail if no JSON
            console.error(`Failed to fetch announcement, status: ${response.status}`, errorData?.message || '');
            throw new Error(errorData?.message || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        if (data.success && typeof data.value === 'string') { // Check if value is a string
            announcementBarContainer.innerHTML = data.value; // 直接插入 HTML 内容
            
            const cacheEntry = {
                value: data.value,
                last_updated_server: data.last_updated,
                fetched_at: Date.now()
            };
            localStorage.setItem(ANNOUNCEMENT_CACHE_KEY, JSON.stringify(cacheEntry));
            console.log("Announcement fetched from server and cached.");
        } else {
            console.warn("Announcement data from server is not valid:", data);
            // If server returns success:false or invalid value, still try to load from cache as fallback
            loadAnnouncementFromCache(true, "服务器返回数据格式不正确。");
        }
    } catch (error) {
        console.error("Error fetching live announcement:", error);
        loadAnnouncementFromCache(true, "获取最新消息失败。");
    }
}

function loadAnnouncementFromCache(isFallback = false, fallbackMessagePrefix = "") {
    const announcementBarContainer = document.getElementById('dynamicAnnouncementBarContainer');
    if (!announcementBarContainer) return null;

    const cachedDataString = localStorage.getItem(ANNOUNCEMENT_CACHE_KEY);
    if (cachedDataString) {
        try {
            const entry = JSON.parse(cachedDataString);
            if (entry && typeof entry.value === 'string') {
                announcementBarContainer.innerHTML = entry.value;
                if (isFallback) {
                    const fallbackNotice = document.createElement('small');
                    fallbackNotice.style.display = 'block';
                    fallbackNotice.style.color = 'grey';
                    fallbackNotice.style.marginTop = '5px';
                    fallbackNotice.textContent = `(${fallbackMessagePrefix} 显示的是缓存消息。)`;
                    announcementBarContainer.appendChild(fallbackNotice);
                }
                console.log("Announcement loaded from cache.");
                return entry;
            } else {
                throw new Error("Cached data format is invalid.");
            }
        } catch (e) {
            console.error("Error parsing cached announcement or cache is invalid:", e);
            if (isFallback) announcementBarContainer.innerHTML = `<p>${fallbackMessagePrefix} 无法读取缓存。</p>`;
            localStorage.removeItem(ANNOUNCEMENT_CACHE_KEY); // Clear corrupted cache
            return null;
        }
    } else {
        if (isFallback) announcementBarContainer.innerHTML = `<p>${fallbackMessagePrefix} 暂无缓存消息。</p>`;
        console.log("No announcement in cache.");
        return null;
    }
}

async function manageAnnouncementDisplay() {
    const announcementBarContainer = document.getElementById('dynamicAnnouncementBarContainer');
    if (!announcementBarContainer) return;

    // Initially show a loading message if no cache is immediately available
    const cachedEntry = JSON.parse(localStorage.getItem(ANNOUNCEMENT_CACHE_KEY) || 'null');
    if (!cachedEntry || !cachedEntry.value) {
        announcementBarContainer.innerHTML = "<p><i>正在加载最新消息...</i></p>";
    } else {
        // If there's cache, display it immediately
        loadAnnouncementFromCache();
    }

    if (cachedEntry && typeof cachedEntry.fetched_at === 'number') {
        const timeSinceLastFetch = Date.now() - cachedEntry.fetched_at;
        // Also check server's last_updated time against cached server's last_updated time
        // This requires an additional lightweight request or a HEAD request if supported
        // For simplicity, we'll primarily rely on cache expiry for now.
        if (timeSinceLastFetch > ANNOUNCEMENT_CACHE_EXPIRY_MS) {
            console.log("Announcement cache expired, fetching new.");
            await fetchAndUpdateAnnouncement();
        } else {
            // Optional: Proactively check if server data is newer even if local cache hasn't expired
            // This can be done by making a HEAD request or a GET request and comparing last_updated timestamps
            // For now, we assume cache is fresh enough if not expired.
            console.log("Announcement loaded from cache, not expired yet.");
        }
    } else {
        // No valid cache or no fetched_at timestamp, must fetch
        console.log("No valid announcement cache, fetching new.");
        await fetchAndUpdateAnnouncement();
    }
}