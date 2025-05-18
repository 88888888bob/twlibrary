// js/admin-settings.js
// Assumes:
// - Quill library is loaded globally.
// - From quill-manager.js: initializeQuillEditor, syncAllQuillEditorsToHiddenInputs are global.
// - From admin-utils.js: API_BASE_URL, contentArea, showLoading, apiCall, escapeHtml are global.
// - From admin-modals.js: showAlert, showConfirm are global.
// - From admin-main.js: dispatchAction is global.

let currentSiteSettings = {}; // Cache for original settings to get description or compare changes

// --- Navigation entry point (called by admin-main.js via dispatchAction) ---
function showSiteSettingsPage() {
    loadAndRenderSiteSettings();
}

async function loadAndRenderSiteSettings() {
    if (typeof showLoading === 'function') showLoading();
    else if (contentArea) contentArea.innerHTML = "<p>正在加载...</p>";

    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => {
        console.warn("escapeHtml function not found, using basic text passthrough.");
        return text;
    };

    try {
        const data = await apiCall('/api/admin/settings');
        
        if (!contentArea) {
            console.error("CRITICAL: contentArea not found for rendering site settings.");
            if (typeof showAlert === 'function') showAlert("无法渲染设置页面：内容区域丢失。", "渲染错误", "error");
            return;
        }

        if (data.success && data.settings) {
            currentSiteSettings = {};
            let settingsHtml = `
                <div class="content-section">
                    <h2><i class="fas fa-cogs"></i>Website Settings 网站设置</h2>
                    <form id="siteSettingsForm" onsubmit="submitSiteSettings(event)">`;
            
            const usageGuideHtml = `
                <div class="editor-usage-guide" style="padding: 10px 15px; background-color: #e9f5ff; border: 1px solid #b8d6f0; border-radius: 4px; margin-bottom: 15px; font-size: 0.9em;">
                    <h4 style="margin-top:0; margin-bottom:5px; color: #005a9e;">编辑器使用说明:</h4>
                    <ul style="margin:0; padding-left:20px; list-style-position: inside;">
                        <li><strong>基本格式:</strong> 使用工具栏按钮进行文本加粗 (<b>B</b>), 斜体 (<i>I</i>), 下划线 (<u>U</u>)。</li>
                        <li><strong>字号/颜色:</strong> 通过下拉菜单选择不同的字号和颜色。</li>
                        <li><strong>对齐/列表:</strong> 使用对齐和列表按钮调整文本布局。</li>
                        <li><strong>链接:</strong> 选中文字后点击链接图标创建超链接。</li>
                        // <li><strong>图片/代码/公式:</strong> 通过对应图标插入网络图片、代码块或数学公式。</li>
                        // <li><strong>清除格式:</strong> 移除所选文字的所有样式。</li>
                    </ul>
                </div>`;

            if (data.settings.length === 0) {
                settingsHtml += "<p>暂无可配置的网站设置项。</p>";
            }

            data.settings.forEach(setting => {
                currentSiteSettings[setting.setting_key] = setting;
                const settingKeyEsc = esc(setting.setting_key);
                let descriptionHtml = esc(setting.description || setting.setting_key); // 默认使用英文描述

                // 为特定的 setting_key 添加中文翻译
                if (setting.setting_key === 'announcement_bar_html') {
                    if (setting.description && setting.description.toLowerCase().includes('homepage announcement bar content')) {
                         descriptionHtml = `
                            ${esc(setting.description)}<br>
                            <span style="font-weight:normal; color:#555;">首页公告栏内容 (允许 HTML)</span>
                         `;
                    } else { // 如果描述不是预期的，则只添加一个通用的中文
                        descriptionHtml += `<br><span style="font-weight:normal; color:#555;">首页公告栏内容</span>`;
                    }
                }
                // 你可以为其他 setting_key 添加类似的翻译逻辑
                // else if (setting.setting_key === 'another_key') {
                //     descriptionHtml = `${esc(setting.description)}<br><span style="font-weight:normal; color:#555;">另一个设置的中文描述</span>`;
                // }


                let fieldHtml = '';
                const labelHtml = `
                    <label for="setting_${settingKeyEsc}">${descriptionHtml} 
                        (<small>Key: <code>${settingKeyEsc}</code></small>):
                    </label>`;

                if (setting.setting_key === 'announcement_bar_html') {
                    fieldHtml = `
                        ${(setting.setting_key === 'announcement_bar_html' ? usageGuideHtml : '')}
                        <div class="form-group-editor-wrapper">
                            ${labelHtml}
                            <div id="quill_editor_${settingKeyEsc}" class="quill-editor-instance" style="min-height: 150px; border: 1px solid #ccc; border-radius: 4px;"></div>
                            <input type="hidden" id="setting_${settingKeyEsc}" name="${settingKeyEsc}">
                        </div>`;
                } else if (String(setting.setting_key).endsWith('_json')) {
                    fieldHtml = `
                        ${labelHtml}
                        <textarea id="setting_${settingKeyEsc}" name="${settingKeyEsc}" class="form-control" rows="8" style="font-family: monospace;">${esc(setting.setting_value)}</textarea>
                        <small class="form-text text-muted">此内容应为有效的 JSON 字符串。</small>`;
                } else { // Default to text input
                    fieldHtml = `
                        ${labelHtml}
                        <input type="text" id="setting_${settingKeyEsc}" name="${settingKeyEsc}" value="${esc(setting.setting_value)}" class="form-control">`;
                }

                settingsHtml += `
                    <div class="form-group">
                        ${fieldHtml}
                        <small class="form-text text-muted">最后更新：${new Date(setting.last_updated).toLocaleDateString()} ${new Date(setting.last_updated).toLocaleTimeString()}</small>
                    </div>
                    ${data.settings.indexOf(setting) < data.settings.length - 1 ? '<hr style="border-top: 1px dashed #eee; margin: 20px 0;">' : ''}`;
            });

            if (data.settings.length > 0) {
                 settingsHtml += `
                    <div class="form-actions">
                        <button type="submit" class="btn-submit"><i class="fas fa-save"></i> 保存所有更改</button>
                    </div>`;
            }
            settingsHtml += `</form></div>`; // Close content-section
            
            contentArea.innerHTML = settingsHtml;
                
            data.settings.forEach(setting => {
                if (setting.setting_key === 'announcement_bar_html') {
                    const editorContainerSelector = `#quill_editor_${esc(setting.setting_key)}`;
                    const hiddenInputSelector = `#setting_${esc(setting.setting_key)}`;
                    if (typeof initializeQuillEditor === 'function') {
                        initializeQuillEditor(
                            editorContainerSelector, 
                            hiddenInputSelector, 
                            setting.setting_value, 
                            'simple', 
                            '输入公告 HTML 内容...'
                        );
                    } else {
                        console.error("initializeQuillEditor function not found. Quill manager might not be loaded.");
                    }
                }
            });

        } else {
            contentArea.innerHTML = '<div class="content-section"><p>无法加载网站设置或没有设置项。</p></div>';
            if (typeof showAlert === 'function') showAlert(data.message || '加载设置失败', '错误', 'error');
        }
    } catch (error) {
        console.error('Error loading site settings:', error);
        contentArea.innerHTML = `<div class="content-section"><p>加载网站设置时发生严重错误：${error.message}</p></div>`;
        if (typeof showAlert === 'function') showAlert(`加载网站设置出错：${error.message}`, '网络错误', 'error');
    }
}


async function submitSiteSettings(event) {
    event.preventDefault();
    
    if (typeof syncAllQuillEditorsToHiddenInputs === 'function') {
        syncAllQuillEditorsToHiddenInputs();
    } else {
        console.warn('syncAllQuillEditorsToHiddenInputs function is not available. Quill content might not be saved correctly.');
    }
    
    const form = event.target;
    const formData = new FormData(form);
    
    const settingsContainerForLoading = document.getElementById('siteSettingsContainer'); // Get a reference for loading
    if (settingsContainerForLoading && typeof showLoading === 'function') {
        showLoading(settingsContainerForLoading); // Show loading within the settings area
    }

    let updatePromises = [];
    let attemptedUpdates = 0;

    for (const [key, value] of formData.entries()) {
        attemptedUpdates++;
        const originalSetting = currentSiteSettings[key];
        let descriptionToSend = originalSetting ? originalSetting.description : null;

        // If you add an input field for description in the form, you'd get it here:
        // const descriptionFromForm = formData.get(`description_${key}`); // Example if you had such a field
        // if (descriptionFromForm !== undefined) descriptionToSend = descriptionFromForm;

        updatePromises.push(
            apiCall(`/api/admin/settings/${key}`, 'PUT', { 
                value: value, 
                description: descriptionToSend 
            }).catch(err => { // Catch individual promise rejections to allow others to proceed
                console.error(`Error updating setting '${key}':`, err);
                if (typeof showAlert === 'function') {
                    showAlert(`更新设置 '${key}' 失败：${err.message}`, '错误', 'error');
                }
                // Return a specific error object or null so Promise.allSettled can distinguish
                return { success: false, key: key, error: err.message }; 
            })
        );
    }

    if (attemptedUpdates === 0) {
        if (typeof showAlert === 'function') showAlert('没有可提交的设置项。', '提示', 'info');
        loadAndRenderSiteSettings(); // Still reload to clear loading spinner if any
        return;
    }

    const results = await Promise.allSettled(updatePromises);
    
    let successfulUpdates = 0;
    let failedKeys = [];

    results.forEach(result => {
        if (result.status === 'fulfilled') {
            // Check our custom success from catch block or apiCall's success
            if (result.value && result.value.success === true) {
                successfulUpdates++;
            } else if (result.value && result.value.success === false) { // Error caught and returned
                failedKeys.push(result.value.key || '未知项');
            }
        } else if (result.status === 'rejected') {
            // This case might not be hit if all apiCall rejections are caught above
            console.error("Unhandled rejection in Promise.allSettled:", result.reason);
            // Try to find the key if possible (would require more complex promise wrapping)
            failedKeys.push('未知项 (Promise rejected)');
        }
    });

    if (typeof showAlert === 'function') {
        if (successfulUpdates === attemptedUpdates) {
            showAlert('所有网站设置已成功保存！', '成功', 'success');
        } else if (successfulUpdates > 0) {
            showAlert(`部分网站设置已保存 (${successfulUpdates}/${attemptedUpdates})。失败项：${failedKeys.join(', ')}`, '部分成功', 'warning');
        } else {
            showAlert(`所有设置 (${attemptedUpdates}项) 更新均失败。失败项：${failedKeys.join(', ')}`, '全部失败', 'error');
        }
    }

    loadAndRenderSiteSettings(); // Always reload to show the latest state and clear loading
}