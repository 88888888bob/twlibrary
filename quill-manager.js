// js/quill-manager.js

// 全局存储 Quill 实例，以 ID 或其他唯一键作为 key
const activeQuillInstances = {};

/**
 * 初始化一个 Quill 编辑器实例。
 * @param {string} editorContainerSelector - 编辑器容器的 CSS 选择器 (例如 '#myEditorDiv').
 * @param {string} hiddenInputSelector - 存储 HTML 内容的隐藏 input 的 CSS 选择器 (例如 '#myHiddenInput').
 * @param {string} [initialHtmlContent=''] - 编辑器的初始 HTML 内容.
 * @param {object} [toolbarConfigKey='default'] - 用于选择预定义工具栏配置的键名 (例如 'default', 'simple', 'news').
 * @param {string} [placeholder='在此输入内容...'] - 编辑器的占位符文本.
 * @returns {Quill|null} 返回创建的 Quill 实例，如果失败则返回 null.
 */
function initializeQuillEditor(editorContainerSelector, hiddenInputSelector, initialHtmlContent = '', toolbarConfigKey = 'default', placeholder = '在此输入内容...') {
    const editorElement = document.querySelector(editorContainerSelector);
    const hiddenInput = document.querySelector(hiddenInputSelector);

    if (!editorElement) {
        console.error(`Quill init failed: Editor container '${editorContainerSelector}' not found.`);
        return null;
    }
    if (!hiddenInput) {
        console.error(`Quill init failed: Hidden input '${hiddenInputSelector}' not found.`);
        return null;
    }

    // --- 预定义的工具栏配置 ---
    const toolbarConfigurations = {
        'default': [
            [{ 'font': [] }, { 'size': ['small', false, 'large', 'huge'] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'script': 'sub'}, { 'script': 'super' }],
            [{ 'align': [] }],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'indent': '-1'}, { 'indent': '+1' }],
            ['link', 'image', 'code-block', 'formula'],
            ['clean']
        ],
        'simple': [ // 例如用于公告栏
            [{ 'size': ['small', false, 'large'] }],
            ['bold', 'italic', 'underline'],        
            [{ 'color': [] }],         
            [{ 'align': [] }],
            ['link'],                  
            ['clean']                  
        ],
        'comments': [ // 例如用于评论区
            ['bold', 'italic', 'underline'],
            ['link'],
            [{ 'list': 'bullet' }],
            ['clean']
        ]
        // 你可以根据需要添加更多配置，如 'news_editor' 等
    };

    const selectedToolbar = toolbarConfigurations[toolbarConfigKey] || toolbarConfigurations['default'];

    // 如果此选择器已存在实例，先处理 (理想情况下，ID 应该是唯一的，但选择器可能匹配多个)
    // 为了简单，我们假设 editorContainerSelector 对应一个唯一的编辑器实例。
    // 如果需要更复杂的管理，可以用 editorContainerSelector 或一个自定义 ID 作为 activeQuillInstances 的键。
    if (activeQuillInstances[editorContainerSelector]) {
        // 尝试销毁或正确处理旧实例的逻辑可以放在这里
        // Quill 官方没有提供一个干净的 destroy() 方法。
        // 通常是移除 DOM 元素再重建，或者只是替换内容。
        console.warn(`Re-initializing Quill on selector '${editorContainerSelector}'. Previous instance might be orphaned if DOM element was not replaced.`);
    }
    
    let quill;
    try {
        quill = new Quill(editorElement, {
            modules: { 
                toolbar: selectedToolbar,
                formula: selectedToolbar.some(group => group.includes('formula') || (Array.isArray(group) && group[0] === 'formula')), // 仅当工具栏需要时启用公式
                // syntax: selectedToolbar.some(group => group.includes('code-block')), // 类似地，为代码块启用语法高亮插件 (如果使用)
            },
            theme: 'snow',
            placeholder: placeholder
        });
    } catch (e) {
        console.error("Error initializing Quill:", e, "on selector:", editorContainerSelector);
        return null;
    }


    if (initialHtmlContent && typeof initialHtmlContent === 'string') {
        quill.clipboard.dangerouslyPasteHTML(0, initialHtmlContent);
        hiddenInput.value = initialHtmlContent;
    } else {
        quill.setText(''); // 清空内容
        hiddenInput.value = '';
    }

    quill.on('text-change', (delta, oldDelta, source) => {
        // 更新隐藏 input 的值
        // source 可以是 'user', 'api', 'silent'
        if (source === 'user' || source === 'api') { 
            hiddenInput.value = quill.root.innerHTML;
        }
    });
    
    activeQuillInstances[editorContainerSelector] = quill; // 使用选择器作为键存储实例
    return quill;
}

/**
 * 在表单提交前，确保所有活动的 Quill 编辑器的内容都同步到它们关联的隐藏 input 字段。
 */
function syncAllQuillEditorsToHiddenInputs() {
    for (const selector in activeQuillInstances) {
        if (activeQuillInstances.hasOwnProperty(selector)) {
            const quill = activeQuillInstances[selector];
            if (quill && quill.root) {
                // 找到与此编辑器关联的隐藏 input
                // 假设 hiddenInputSelector 是根据 editorContainerSelector 推断的，或者在创建时已关联
                // 这是一个简化的例子，实际中你可能需要更可靠地找到对应的 hiddenInput
                const editorElement = document.querySelector(selector);
                if (editorElement) {
                    // 尝试从编辑器的父级或特定属性找到隐藏输入框
                    // 这个逻辑需要根据你的 HTML 结构来定，或者在 initialize 时传入 hiddenInput 的选择器
                    // 例如，如果隐藏输入框是编辑器的下一个兄弟元素且有特定类或 name
                    const hiddenInput = editorElement.nextElementSibling; // 这是一个非常脆弱的假设
                    // 更稳妥的方式是在 initializeQuillEditor 时把 hiddenInputSelector 也存起来与实例关联
                    // 或者，在 activeQuillInstances 中存储 { quill, hiddenInputSelector }
                    
                    // **更可靠的方案：修改 activeQuillInstances 的结构**
                    // activeQuillInstances[editorContainerSelector] = { quillInstance: quill, hiddenInputSelector: hiddenInputSelectorFromInit };
                    // 然后在这里：
                    // const associatedData = activeQuillInstances[selector];
                    // const hiddenInput = document.querySelector(associatedData.hiddenInputSelector);
                    // if (hiddenInput) {
                    //    hiddenInput.value = quill.root.innerHTML;
                    // }
                    
                    // 简化版本，假设 hidden input 的 ID 是 editorContainer ID 去掉 'quill_editor_' 前缀并加上 'setting_'
                    // 例如，quill_editor_announcement_bar_html -> setting_announcement_bar_html
                    const hiddenInputIdGuess = selector.replace(/^#quill_editor_/, 'setting_');
                    const actualHiddenInput = document.getElementById(hiddenInputIdGuess);
                    if (actualHiddenInput) {
                         actualHiddenInput.value = quill.root.innerHTML;
                         console.log(`Synced Quill content for ${selector} to ${hiddenInputIdGuess}`);
                    } else {
                        console.warn(`Could not find hidden input for Quill editor ${selector} using guessed ID ${hiddenInputIdGuess}`);
                    }
                }
            }
        }
    }
}

/**
 * (可选) 获取特定 Quill 实例。
 * @param {string} editorContainerSelector - 编辑器容器的 CSS 选择器.
 * @returns {Quill|null}
 */
function getQuillInstance(editorContainerSelector) {
    return activeQuillInstances[editorContainerSelector] || null;
}

/**
 * (可选) 销毁/清理特定的 Quill 实例和关联的 DOM。
 * @param {string} editorContainerSelector - 编辑器容器的 CSS 选择器.
 */
function destroyQuillInstance(editorContainerSelector) {
    const quill = activeQuillInstances[editorContainerSelector];
    if (quill) {
        // Quill 没有官方的 destroy 方法，通常需要手动清理
        // 1. 移除事件监听器 (Quill 内部会处理大部分)
        // 2. 清理 activeQuillInstances 中的引用
        delete activeQuillInstances[editorContainerSelector];
        // 3. 可选：从 DOM 中移除编辑器元素 (如果编辑器是动态添加的)
        // const editorElement = document.querySelector(editorContainerSelector);
        // if (editorElement && editorElement.parentNode) {
        //     editorElement.parentNode.removeChild(editorElement);
        // }
        console.log(`Quill instance for ${editorContainerSelector} marked for cleanup.`);
    }
}

// 如果你想让这些函数在其他 JS 文件中通过全局作用域访问（不推荐，但简单项目可以）
// window.initializeQuillEditor = initializeQuillEditor;
// window.syncAllQuillEditorsToHiddenInputs = syncAllQuillEditorsToHiddenInputs;
// window.getQuillInstance = getQuillInstance;

// 更好的方式是其他模块按需导入这些函数 (如果你的项目使用 ES 模块打包)
// export { initializeQuillEditor, syncAllQuillEditorsToHiddenInputs, getQuillInstance, destroyQuillInstance };
// 但对于简单的 script 标签引入，它们默认就是全局的，除非你用 IIFE 包裹。