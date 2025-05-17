// js/admin-settings.js
// Assumes API_BASE_URL, contentArea, showAlert, ..., apiCall, escapeHtml, Quill are available

let currentSiteSettings = {};
let quillInstances = {}; // Store multiple Quill instances if needed, keyed by setting_key

// --- Navigation entry point ---
function showSiteSettingsPage() {
    loadAndRenderSiteSettings();
}

async function loadAndRenderSiteSettings() {
    showLoading();
    contentArea.innerHTML = `
        <div class="content-section">
            <h2><i class="fas fa-cogs"></i> 网站设置</h2>
            <div id="siteSettingsContainer">
                <p>正在加载设置...</p>
            </div>
        </div>`;
    
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text; // Fallback for escapeHtml

    try {
        const data = await apiCall('/api/admin/settings');
        const container = document.getElementById('siteSettingsContainer');
        if (data.success && data.settings) {
            currentSiteSettings = {}; // Reset cache
            quillInstances = {};    // Reset Quill instances
            let settingsHtml = '<form id="siteSettingsForm" onsubmit="submitSiteSettings(event)">';
            
            data.settings.forEach(setting => {
                currentSiteSettings[setting.setting_key] = setting;
                const settingKeyEsc = esc(setting.setting_key);
                const descriptionEsc = esc(setting.description || setting.setting_key);
                
                settingsHtml += `
                    <div class="form-group">
                        <label for="setting_${settingKeyEsc}">${descriptionEsc} 
                            (<small>Key: <code>${settingKeyEsc}</code></small>):
                        </label>`;
                
                // Specific handling for 'announcement_bar_html' to use Quill
                if (setting.setting_key === 'announcement_bar_html') {
                    settingsHtml += `
                        <div id="quill_editor_${settingKeyEsc}" style="min-height: 150px; border: 1px solid #ccc; border-radius: 4px;"></div>
                        <input type="hidden" id="setting_${settingKeyEsc}" name="${settingKeyEsc}" value="${esc(setting.setting_value)}">
                    `;
                } else if (String(setting.setting_key).endsWith('_json')) {
                     settingsHtml += `<textarea id="setting_${settingKeyEsc}" name="${settingKeyEsc}" class="form-control" rows="8" style="font-family: monospace;">${esc(setting.setting_value)}</textarea>
                                      <small class="form-text text-muted">此内容应为有效的 JSON 字符串。</small>`;
                } else { // Default to text input
                    settingsHtml += `<input type="text" id="setting_${settingKeyEsc}" name="${settingKeyEsc}" value="${esc(setting.setting_value)}" class="form-control">`;
                }
                settingsHtml += `<small class="form-text text-muted">最后更新：${new Date(setting.last_updated).toLocaleString()}</small>`;
                settingsHtml += `</div><hr style="border-top: 1px dashed #eee; margin: 20px 0;">`;
            });

            settingsHtml += `
                <div class="form-actions">
                    <button type="submit" class="btn-submit"><i class="fas fa-save"></i> 保存所有更改</button>
                </div>
            </form>`;
            
            if (container) {
                container.innerHTML = settingsHtml;
                
                // Initialize Quill editor(s) after HTML is rendered
                data.settings.forEach(setting => {
                    if (setting.setting_key === 'announcement_bar_html') {
                        initializeQuillForSetting(setting.setting_key, setting.setting_value);
                    }
                    // Add more conditions here if other settings also need Quill
                });
            }
        } else {
            if (container) container.innerHTML = '<p>无法加载网站设置。</p>';
            showAlert(data.message || '加载设置失败', '错误', 'error');
        }
    } catch (error) {
        console.error('Error loading site settings:', error);
        const c = document.getElementById('siteSettingsContainer');
        if (c) c.innerHTML = `<p>加载网站设置时出错：${error.message}</p>`;
        showAlert(`加载网站设置出错：${error.message}`, '网络错误', 'error');
    }
}

function initializeQuillForSetting(settingKey, initialHtmlContent = '') {
    const editorContainerId = `quill_editor_${escapeHtml(settingKey)}`;
    const hiddenInputId = `setting_${escapeHtml(settingKey)}`;
    
    const editorElement = document.getElementById(editorContainerId);
    const hiddenInput = document.getElementById(hiddenInputId);

    if (editorElement && hiddenInput) {
        // Toolbar options - customize as needed for different editors
        let toolbarOptions = [
            ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
            [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
            [{ 'font': [] }],
            [{ 'align': [] }],
            ['link'], // 'image' 'video' - add if needed for news/comments
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'script': 'sub'}, { 'script': 'super' }],      // superscript/subscript
            [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent
            [{ 'direction': 'rtl' }],                         // text direction (optional)
            [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            ['clean']                                         // remove formatting button
        ];
        
        // Simplified toolbar for announcements if desired
        if (settingKey === 'announcement_bar_html') {
            toolbarOptions = [
                ['bold', 'italic'],
                [{ 'color': [] }],
                ['link'],
                ['clean']
            ];
        }

        // Destroy existing instance if any for this key to avoid conflicts on re-render
        if (quillInstances[settingKey]) {
             // Quill doesn't have a formal destroy. We might need to remove the element and re-add if issues.
             // For now, just create new, assuming container ID is unique per render.
        }

        const quill = new Quill(editorElement, {
            modules: { toolbar: toolbarOptions },
            theme: 'snow',
            placeholder: '在此输入内容...'
        });

        if (initialHtmlContent) {
            quill.clipboard.dangerouslyPasteHTML(0, initialHtmlContent);
            hiddenInput.value = initialHtmlContent; // Ensure hidden input is also set
        } else {
            hiddenInput.value = ''; // Ensure empty if no content
        }

        quill.on('text-change', (delta, oldDelta, source) => {
            if (source === 'user') { // Only update if change comes from user interaction
                hiddenInput.value = quill.root.innerHTML;
            }
        });
        
        quillInstances[settingKey] = quill; // Store the instance
    } else {
        console.error(`Quill container or hidden input not found for setting: ${settingKey}`);
    }
}

async function submitSiteSettings(event) {
    event.preventDefault();
    const form = event.target;

    // Before creating FormData, ensure all Quill editor contents are synced to their hidden inputs
    for (const key in quillInstances) {
        if (quillInstances.hasOwnProperty(key) && quillInstances[key]) {
            const hiddenInput = document.getElementById(`setting_${escapeHtml(key)}`);
            if (hiddenInput) {
                hiddenInput.value = quillInstances[key].root.innerHTML;
            }
        }
    }
    
    const formData = new FormData(form);
    let updatePromises = [];
    // ... (rest of your submitSiteSettings logic using Promise.allSettled remains the same)

    const settingsContainer = document.getElementById('siteSettingsContainer');
    if (settingsContainer) showLoading('siteSettingsContainer');

    for (const [key, value] of formData.entries()) {
        const originalSetting = currentSiteSettings[key];
        let descriptionToSend = originalSetting ? originalSetting.description : null;

        updatePromises.push(
            apiCall(`/api/admin/settings/${key}`, 'PUT', { 
                value: value, 
                description: descriptionToSend 
            }).catch(err => {
                console.error(`Error updating setting '${key}':`, err);
                showAlert(`更新设置 '${key}' 失败：${err.message}`, '错误', 'error');
                // No re-throw to let Promise.allSettled handle it
            })
        );
    }

    const results = await Promise.allSettled(updatePromises);
    
    let successfulUpdates = 0;
    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value && result.value.success) {
            successfulUpdates++;
        }
    });

    if (updatePromises.length === 0) { // No settings were on the form to update
        showAlert('没有需要更新的设置。', '提示', 'info');
    } else if (successfulUpdates === updatePromises.length) {
        showAlert('所有网站设置已成功保存！', '成功', 'success');
    } else if (successfulUpdates > 0) {
        showAlert(`部分网站设置已保存 (${successfulUpdates}/${updatePromises.length})。请检查是否有错误提示。`, '部分成功', 'warning');
    } else {
        showAlert('所有设置更新均失败。请检查控制台或网络错误。', '全部失败', 'error');
    }

    // Important: Re-rendering will create new editor instances.
    // If you want to preserve editor state across failed partial saves, this logic needs more sophistication.
    loadAndRenderSiteSettings();
}

// escapeHtml function should be available (e.g., from admin-utils.js)
// function escapeHtml(unsafe) { ... }