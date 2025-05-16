// js/admin-utils.js
const API_BASE_URL = 'https://twapi.bob666.eu.org'; // Centralized API base URL
const LOGIN_PAGE_URL = 'login.html';
const contentArea = document.getElementById('contentArea'); // Make contentArea globally accessible for modules

function showLoading(containerOrId = contentArea) {
    const container = (typeof containerOrId === 'string') ? document.getElementById(containerOrId) : containerOrId;
    if (container) container.innerHTML = '<div class="loading-spinner"></div>';
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