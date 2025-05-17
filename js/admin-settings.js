// js/admin-settings.js
// Assumes API_BASE_URL, contentArea, showAlert, showConfirm, showLoading, apiCall, dispatchAction, escapeHtml are available

let currentSiteSettings = {};

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
    
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (text) => text;

    try {
        const data = await apiCall('/api/admin/settings');
        const container = document.getElementById('siteSettingsContainer');
        if (data.success && data.settings) {
            currentSiteSettings = {};
            let settingsHtml = '<form id="siteSettingsForm" onsubmit="submitSiteSettings(event)">';
            
            data.settings.forEach(setting => {
                currentSiteSettings[setting.setting_key] = setting;
                settingsHtml += `
                    <div class="form-group">
                        <label for="setting_${esc(setting.setting_key)}">${esc(setting.description || setting.setting_key)} 
                            (<small>Key: <code>${esc(setting.setting_key)}</code></small>):
                        </label>`;
                
                if (setting.setting_key === 'announcement_bar_html' || String(setting.setting_key).endsWith('_json')) {
                    settingsHtml += `<textarea id="setting_${esc(setting.setting_key)}" name="${esc(setting.setting_key)}" class="form-control" rows="5" style="font-family: monospace;">${esc(setting.setting_value)}</textarea>`;
                     if (String(setting.setting_key).endsWith('_json')) {
                         settingsHtml += `<small class="form-text text-muted">此内容应为有效的 JSON 字符串。</small>`;
                    }
                } else {
                    settingsHtml += `<input type="text" id="setting_${esc(setting.setting_key)}" name="${esc(setting.setting_key)}" value="${esc(setting.setting_value)}" class="form-control">`;
                }
                settingsHtml += `<small class="form-text text-muted">最后更新：${new Date(setting.last_updated).toLocaleString()}</small>`;
                settingsHtml += `</div>`;
            });

            settingsHtml += `
                <div class="form-actions">
                    <button type="submit" class="btn-submit"><i class="fas fa-save"></i> 保存所有更改</button>
                </div>
            </form>`;
            if (container) container.innerHTML = settingsHtml;
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

async function submitSiteSettings(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    let updatePromises = [];
    let allUpdatesSuccessful = true;

    const settingsContainer = document.getElementById('siteSettingsContainer');
    if (settingsContainer) showLoading('siteSettingsContainer');


    for (const [key, value] of formData.entries()) {
        const originalSetting = currentSiteSettings[key];
        let descriptionToSend = originalSetting ? originalSetting.description : null;

        // 如果表单中也允许编辑 description，则从表单获取
        // const descriptionField = form.elements[`description_${key}`]; // 假设有这样的字段
        // if (descriptionField) descriptionToSend = descriptionField.value;

        updatePromises.push(
            apiCall(`/api/admin/settings/${key}`, 'PUT', { 
                value: value, 
                description: descriptionToSend 
            }).catch(err => { // Catch individual promise rejections
                allUpdatesSuccessful = false;
                console.error(`Error updating setting '${key}':`, err);
                // showAlert is good, but too many alerts can be annoying for bulk updates.
                // Consider collecting errors and showing a summary.
                // For now, an individual alert is fine for debugging.
                showAlert(`更新设置 '${key}' 失败：${err.message}`, '错误', 'error');
                // We don't re-throw here so Promise.all doesn't fail fast,
                // allowing other updates to proceed.
            })
        );
    }

    // Wait for all promises to settle (either resolve or reject)
    const results = await Promise.allSettled(updatePromises);
    
    let successfulUpdates = 0;
    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value && result.value.success) {
            successfulUpdates++;
        }
    });

    if (successfulUpdates === updatePromises.length) {
        showAlert('所有网站设置已成功保存！', '成功', 'success');
    } else if (successfulUpdates > 0) {
        showAlert(`部分网站设置已保存 (${successfulUpdates}/${updatePromises.length})。请检查是否有错误提示。`, '部分成功', 'warning');
    } else if (updatePromises.length > 0) { // Only show "all failed" if there were attempts
        showAlert('所有设置更新均失败。请检查控制台或网络错误。', '全部失败', 'error');
    } else {
        // No updates were attempted (e.g., form was empty - though unlikely here)
    }

    loadAndRenderSiteSettings(); // Always reload to show the latest state
}