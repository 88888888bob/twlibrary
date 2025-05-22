// js/admin-settings.js
// Assumes:
// - Quill library & quill-manager.js (initializeQuillEditor, syncAllQuillEditorsToHiddenInputs) are loaded globally.
// - admin-utils.js (apiCall, showLoading, escapeHtml, contentArea) are global.
// - admin-modals.js (showAlert) is global.

let originalSiteSettings = {}; // Stores the initial values of settings to detect changes
let currentSiteSettingsMeta = {}; // Stores metadata like description for settings
let changedSettingKeys = new Set(); // Stores keys of settings that have been changed by the user

// --- Navigation Entry Point (called by admin-main.js via dispatchAction) ---
function showSiteSettingsPage() {
    loadAndRenderSiteSettings();
}

async function loadAndRenderSiteSettings() {
    if (typeof showLoading === 'function') showLoading();
    else if (contentArea) contentArea.innerHTML = "<p>正在加载设置...</p>";

    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => {
        console.warn("escapeHtml function not found, using basic text passthrough.");
        return text !== null && text !== undefined ? String(text) : '';
    };

    try {
        const data = await apiCall('/api/admin/settings'); // Fetch all settings
        
        if (!contentArea) {
            console.error("CRITICAL: contentArea not found for rendering site settings.");
            if (typeof showAlert === 'function') showAlert("无法渲染设置页面：内容区域丢失。", "渲染错误", "error");
            return;
        }

        if (data.success && data.settings) {
            originalSiteSettings = {}; // Reset original settings cache
            currentSiteSettingsMeta = {}; // Reset metadata cache
            changedSettingKeys.clear(); // Clear the set of changed keys

            let settingsFormHtml = `<form id="siteSettingsForm" onsubmit="submitSiteSettings(event)">`;
            
            if (data.settings.length === 0) {
                settingsFormHtml += "<p>暂无可配置的网站设置项。</p>";
            }

            data.settings.forEach(setting => {
                originalSiteSettings[setting.setting_key] = setting.setting_value;
                currentSiteSettingsMeta[setting.setting_key] = { description: setting.description, last_updated: setting.last_updated };

                const settingKeyEsc = esc(setting.setting_key);
                const descriptionEsc = esc(setting.description || setting.setting_key);
                const originalValueEsc = esc(setting.setting_value); // Used for data-original-value

                let fieldHtml = '';
                if (setting.setting_key === 'announcement_bar_html') {
                    fieldHtml = `
                        <label for="quill_editor_${settingKeyEsc}">${descriptionEsc} 
                            (<small>Key: <code>${settingKeyEsc}</code></small>):
                        </label>
                        <div id="quill_editor_${settingKeyEsc}" class="quill-editor-instance setting-input-field" data-key="${settingKeyEsc}"></div>
                        <input type="hidden" id="setting_${settingKeyEsc}" name="${settingKeyEsc}" data-original-value="${originalValueEsc}">
                    `;
                } else if (setting.setting_key === 'blog_post_requires_review') {
                    fieldHtml = `
                        <label for="setting_${settingKeyEsc}">${descriptionEsc} 
                            (<small>Key: <code>${settingKeyEsc}</code></small>):
                        </label>
                        <select id="setting_${settingKeyEsc}" name="${settingKeyEsc}" class="form-control setting-input-field" data-key="${settingKeyEsc}" data-original-value="${originalValueEsc}" onchange="handleSettingInputChange(this)">
                            <option value="true" ${setting.setting_value === 'true' ? 'selected' : ''}>是 (Yes) - 需要审核</option>
                            <option value="false" ${setting.setting_value === 'false' ? 'selected' : ''}>否 (No) - 直接发布</option>
                        </select>`;
                } else if (String(setting.setting_key).endsWith('_json')) {
                    fieldHtml = `
                        <label for="setting_${settingKeyEsc}">${descriptionEsc} 
                            (<small>Key: <code>${settingKeyEsc}</code></small>):
                        </label>
                        <textarea id="setting_${settingKeyEsc}" name="${settingKeyEsc}" class="form-control setting-input-field" data-key="${settingKeyEsc}" data-original-value="${originalValueEsc}" rows="8" style="font-family: monospace;" oninput="handleSettingInputChange(this)">${originalValueEsc}</textarea>
                        <small class="form-text text-muted">此内容应为有效的 JSON 字符串。</small>`;
                } else { // Default to text input
                    fieldHtml = `
                        <label for="setting_${settingKeyEsc}">${descriptionEsc} 
                            (<small>Key: <code>${settingKeyEsc}</code></small>):
                        </label>
                        <input type="text" id="setting_${settingKeyEsc}" name="${settingKeyEsc}" value="${originalValueEsc}" class="form-control setting-input-field" data-key="${settingKeyEsc}" data-original-value="${originalValueEsc}" oninput="handleSettingInputChange(this)">`;
                }

                settingsFormHtml += `
                    <div class="form-group" id="group_for_setting_${settingKeyEsc}"> <!-- Unique ID for form group -->
                        ${fieldHtml}
                        <small class="form-text text-muted">最后更新：${formatUtcToLocalDate(setting.last_updated)}</small>
                    </div>
                    ${data.settings.length > 1 ? '<hr style="border-top: 1px dashed #eee; margin: 20px 0;">' : ''}`;
            });

            if (data.settings.length > 0) {
                 settingsFormHtml += `
                    <div class="form-actions">
                        <button type="submit" class="btn-submit"><i class="fas fa-save"></i> 保存已修改的设置</button>
                    </div>`;
            }
            settingsFormHtml += `</form>`;
            
            const pageHeaderHtml = `
                <h2><i class="fas fa-cogs"></i> 网站设置</h2>
                <p class="settings-page-description">在这里管理网站的全局配置。只有被修改的设置项 (高亮显示) 才会在点击保存时提交更新。</p>
            `;
            contentArea.innerHTML = `<div class="content-section">${pageHeaderHtml}${settingsFormHtml}</div>`;
                
            // Initialize Quill editor(s) AFTER HTML is in DOM
            data.settings.forEach(setting => {
                if (setting.setting_key === 'announcement_bar_html') {
                    const editorContainerSelector = `#quill_editor_${esc(setting.setting_key)}`;
                    const hiddenInputSelector = `#setting_${esc(setting.setting_key)}`;
                    if (typeof initializeQuillEditor === 'function') {
                        const quillInstance = initializeQuillEditor(
                            editorContainerSelector, 
                            hiddenInputSelector, 
                            setting.setting_value, 
                            'simple', // Toolbar config key
                            '输入公告 HTML 内容...'
                        );
                        // Add change listener specifically for Quill to update hidden input and detect changes
                        if (quillInstance) {
                            quillInstance.on('text-change', (delta, oldDelta, source) => {
                                if (source === 'user') {
                                    const hiddenInput = document.querySelector(hiddenInputSelector);
                                    if (hiddenInput) {
                                        hiddenInput.value = quillInstance.root.innerHTML;
                                        handleSettingInputChange(hiddenInput); // Trigger change detection
                                    }
                                }
                            });
                        }
                    } else {
                        console.error("initializeQuillEditor function not found from quill-manager.js.");
                        const editorDiv = document.querySelector(editorContainerSelector);
                        if(editorDiv) editorDiv.textContent = "Quill 编辑器加载失败。";
                    }
                }
            });

        } else {
            contentArea.innerHTML = '<div class="content-section"><h2><i class="fas fa-cogs"></i> 网站设置</h2><p>无法加载网站设置或没有设置项。</p></div>';
            if (typeof showAlert === 'function') showAlert(data.message || '加载设置失败', '错误', 'error');
        }
    } catch (error) {
        console.error('Error loading site settings:', error);
        contentArea.innerHTML = `<div class="content-section"><h2><i class="fas fa-cogs"></i> 网站设置</h2><p>加载网站设置时发生严重错误：${error.message}</p></div>`;
        if (typeof showAlert === 'function') showAlert(`加载网站设置出错：${error.message}`, '网络错误', 'error');
    }
}

function handleSettingInputChange(element) {
    const key = element.name || element.dataset.key; // `name` for standard inputs, `data-key` for Quill's hidden input proxy
    if (!key) {
        console.warn("handleSettingInputChange called on element without a name or data-key:", element);
        return;
    }
    
    const originalValue = originalSiteSettings[key]; // Get original value from our cache
    let currentValue = element.value;

    // For Quill, element is the hidden input, its value is already HTML string.
    // For standard inputs, element.value is fine.

    const formGroupElement = document.getElementById(`group_for_setting_${escapeHtml(key)}`) || element.closest('.form-group');

    // Normalize undefined/null to empty string for comparison, if originalValue could be null from DB
    const normalizedOriginalValue = (originalValue === null || originalValue === undefined) ? "" : originalValue;
    const normalizedCurrentValue = (currentValue === null || currentValue === undefined) ? "" : currentValue;

    if (normalizedCurrentValue !== normalizedOriginalValue) {
        changedSettingKeys.add(key);
        if (formGroupElement) formGroupElement.classList.add('setting-changed');
    } else {
        changedSettingKeys.delete(key);
        if (formGroupElement) formGroupElement.classList.remove('setting-changed');
    }
}

async function submitSiteSettings(event) {
    event.preventDefault();
    
    // Sync Quill editors one last time before checking changedSettingKeys
    if (typeof syncAllQuillEditorsToHiddenInputs === 'function') {
        syncAllQuillEditorsToHiddenInputs();
        // After syncing, manually trigger change detection for any Quill-backed hidden inputs
        // that might have been programmatically updated by syncAll.
        document.querySelectorAll('.setting-input-field[data-key]').forEach(hiddenInput => {
            // Check if it's a hidden input potentially linked to Quill (has data-key and is hidden)
            if (hiddenInput.type === 'hidden' && originalSiteSettings.hasOwnProperty(hiddenInput.dataset.key)) {
                 handleSettingInputChange(hiddenInput);
            }
        });
    }

    if (changedSettingKeys.size === 0) {
        if (typeof showAlert === 'function') showAlert("没有检测到任何更改。", "提示", "info");
        return;
    }

    const form = document.getElementById('siteSettingsForm');
    if (!form) {
        console.error("Site settings form not found for submission.");
        return;
    }
    
    const settingsContainerForLoading = document.getElementById('siteSettingsContainer');
    if (settingsContainerForLoading && typeof showLoading === 'function') {
        showLoading(settingsContainerForLoading);
    }

    let updatePromises = [];
    
    changedSettingKeys.forEach(key => {
        const formElement = form.elements[key]; // Get by name
        if (formElement) {
            const value = formElement.value;
            const settingMeta = currentSiteSettingsMeta[key]; // Get description from metadata cache
            let descriptionToSend = settingMeta ? settingMeta.description : null;

            console.log(`Submitting changed setting: ${key}`);
            updatePromises.push(
                apiCall(`/api/admin/settings/${key}`, 'PUT', { 
                    value: value, 
                    description: descriptionToSend 
                }).catch(err => {
                    console.error(`Error updating setting '${key}':`, err);
                    if (typeof showAlert === 'function') {
                        showAlert(`更新设置 '${key}' 失败：${err.message}`, '错误', 'error');
                    }
                    return { success: false, key: key, error: err.message }; 
                })
            );
        } else {
            console.warn(`Form element for changed key '${key}' not found.`);
        }
    });

    if (updatePromises.length === 0 && changedSettingKeys.size > 0) {
        // This case might happen if changed keys were for elements not found in form.
        console.warn("Changed keys were noted, but no corresponding form elements found to submit.");
        if(typeof showAlert === 'function') showAlert("检测到更改但无法提交，请检查表单。", "提交错误", "error");
        loadAndRenderSiteSettings(); // Reload to clear state
        return;
    }
    if (updatePromises.length === 0 && changedSettingKeys.size === 0) {
        // Already handled by the check at the beginning of the function.
        // loadAndRenderSiteSettings(); // Reload to clear loading if it was shown
        return;
    }


    const results = await Promise.allSettled(updatePromises);
    
    let successfulUpdates = 0;
    let failedKeys = [];

    results.forEach(result => {
        if (result.status === 'fulfilled') {
            if (result.value && result.value.success === true) {
                successfulUpdates++;
            } else if (result.value && result.value.success === false) {
                failedKeys.push(result.value.key || '未知项');
            }
        } else if (result.status === 'rejected') {
            console.error("Unhandled rejection in settings update Promise.allSettled:", result.reason);
            // This should ideally not be hit if all .catch blocks return an object
            failedKeys.push(result.reason?.key || '未知项 (Promise 直接 rejected)');
        }
    });

    if (typeof showAlert === 'function') {
        if (successfulUpdates === changedSettingKeys.size) { // Compare with attempted changes
            showAlert('所有已修改的设置已成功保存！', '成功', 'success');
        } else if (successfulUpdates > 0) {
            showAlert(`部分设置已保存 (${successfulUpdates}/${changedSettingKeys.size})。失败项：${failedKeys.join(', ')}`, '部分成功', 'warning');
        } else if (changedSettingKeys.size > 0) {
            showAlert(`所有已修改的设置 (${changedSettingKeys.size}项) 更新均失败。失败项：${failedKeys.join(', ')}`, '全部失败', 'error');
        }
    }

    loadAndRenderSiteSettings(); // Reload to update original values and clear highlights/changedKeys set
}