// --- CORE SETTINGS ---
const API_URL = "https://lord123hh-shsj.hf.space/chat"; 
const UPLOAD_API_URL = "https://lord123hh-shsj.hf.space/upload"; // NEW: Dedicated Food Scanner API

let sessionUser = "User";
let currentFile = { data: null, mime: null, name: null, rawFile: null }; // Added rawFile to hold the actual image object
let chats = JSON.parse(localStorage.getItem('fase_chats_pro_v3')) || [];
let activeChatId = null;

// --- DOM ELEMENTS ---
const tosModal = document.getElementById('tos-modal');
const mainApp = document.getElementById('main-app');
const chatBox = document.getElementById('chat-box');
const sidebar = document.getElementById('sidebar');
const userInput = document.getElementById('user-input');
const dragOverlay = document.getElementById('drag-overlay');

// --- DYNAMIC MATH RENDERER (MATHJAX) ---
window.MathJax = {
    tex: { 
        inlineMath: [['$', '$'], ['\\(', '\\)']], 
        displayMath: [['$$', '$$'], ['\\[', '\\]']] 
    },
    startup: { typeset: false }
};
const mathScript = document.createElement('script');
mathScript.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
mathScript.async = true;
document.head.appendChild(mathScript);

// --- BULLETPROOF MARKDOWN IDE RENDERER ---
if(typeof marked !== "undefined" && typeof hljs !== "undefined") {
    const renderer = new marked.Renderer();
    
    renderer.code = function(arg1, arg2) {
        const code = typeof arg1 === 'object' ? (arg1.text || "") : (arg1 || "");
        const language = typeof arg1 === 'object' ? (arg1.lang || "") : (arg2 || "");
        
        const validLang = (language && hljs.getLanguage(language)) ? language : 'plaintext';
        const highlighted = hljs.highlight(code, { language: validLang }).value;
        
        return `
        <div class="my-4 rounded-xl overflow-hidden border border-gray-700 shadow-sm bg-[#1e1e1e] code-block-wrapper">
            <div class="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-gray-700">
                <span class="text-xs font-mono text-gray-300 uppercase tracking-wider">${validLang}</span>
                <button class="copy-code-btn text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    <span>Copy Code</span>
                </button>
            </div>
            <div class="p-4 overflow-x-auto">
                <pre class="!m-0 !p-0"><code class="hljs language-${validLang} text-[13px] !bg-transparent">${highlighted}</code></pre>
            </div>
        </div>`;
    };
    
    marked.use({ renderer, breaks: true }); 
} else {
    window.marked = { parse: (t) => t };
}

// --- GLOBAL ACTIONS (Copy & Retry) ---
window.copyToClipboard = function(btn, text) {
    navigator.clipboard.writeText(text).then(() => {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> <span class="text-green-400">Copied!</span>`;
        setTimeout(() => { btn.innerHTML = originalHTML; }, 2000);
    });
};

function attachCodeCopyButtons(container) {
    container.querySelectorAll('.copy-code-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const codeText = this.closest('.code-block-wrapper').querySelector('code').innerText;
            copyToClipboard(this, codeText);
        });
    });
}

window.retryMessage = function() {
    const currentChat = chats.find(c => c.id === activeChatId);
    if(!currentChat || currentChat.messages.length < 2) return;
    
    currentChat.messages.pop();
    const lastUserMsg = currentChat.messages.pop();
    
    saveChats();
    loadChat(activeChatId);
    
    userInput.value = lastUserMsg.content;
    if(lastUserMsg.file) {
        currentFile = { ...lastUserMsg.file };
        setFileData(currentFile.data, currentFile.mime, currentFile.name || "Attached File", currentFile.rawFile);
    }
    sendMessage();
};


// --- LOGIN & TOS LOGIC ---
const agreeCheck = document.getElementById('agreeCheck');
const userNameInput = document.getElementById('userNameInput');
const loginBtn = document.getElementById('loginBtn');

function validateLogin() {
    if(agreeCheck.checked && userNameInput.value.trim().length > 0) {
        loginBtn.disabled = false;
        loginBtn.classList.remove('bg-gray-200', 'text-gray-400');
        loginBtn.classList.add('bg-black', 'text-white');
    } else {
        loginBtn.disabled = true;
        loginBtn.classList.add('bg-gray-200', 'text-gray-400');
        loginBtn.classList.remove('bg-black', 'text-white');
    }
}

if(agreeCheck && userNameInput) {
    agreeCheck.addEventListener('change', validateLogin);
    userNameInput.addEventListener('input', validateLogin);
}

if (!localStorage.getItem('fase_verified_v3')) {
    if(tosModal) tosModal.classList.remove('hidden');
} else {
    sessionUser = localStorage.getItem('fase_user_alias_v3') || "User";
    initApp();
}

if(loginBtn) {
    loginBtn.addEventListener('click', () => {
        const name = userNameInput.value.trim();
        localStorage.setItem('fase_verified_v3', 'true');
        localStorage.setItem('fase_user_alias_v3', name);
        sessionUser = name;
        tosModal.classList.add('hidden');
        initApp();
    });
}

function logout() {
    if(confirm("Are you sure you want to log out? This will require re-accepting the terms.")) {
        localStorage.removeItem('fase_verified_v3');
        location.reload();
    }
}

function initApp() {
    if(document.getElementById('user-display')) document.getElementById('user-display').innerText = sessionUser;
    if(document.getElementById('user-avatar')) document.getElementById('user-avatar').innerText = sessionUser.charAt(0).toUpperCase();
    
    if(mainApp) {
        mainApp.classList.remove('hidden');
        setTimeout(() => { mainApp.classList.remove('opacity-0'); }, 50);
    }
    
    if (chats.length === 0) createNewChat();
    else loadChat(chats[0].id);
    renderSidebar();
}

// --- UI TOGGLES ---
function toggleSidebar() {
    if(!sidebar) return;
    const isOpen = sidebar.classList.contains('sidebar-open');
    if (isOpen) {
        sidebar.classList.remove('sidebar-open');
        sidebar.classList.add('sidebar-closed');
        document.getElementById('sidebar-backdrop').classList.add('hidden');
    } else {
        sidebar.classList.remove('sidebar-closed');
        sidebar.classList.add('sidebar-open');
        document.getElementById('sidebar-backdrop').classList.remove('hidden');
    }
}

// --- DRAG AND DROP & FILE HANDLING ---
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

['dragenter', 'dragover'].forEach(eventName => {
    document.body.addEventListener(eventName, () => {
        if(dragOverlay) dragOverlay.classList.add('drag-active');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, (e) => {
        if(e.type === 'drop' || !e.relatedTarget || e.relatedTarget.nodeName === "HTML") {
            if(dragOverlay) dragOverlay.classList.remove('drag-active');
        }
    }, false);
});

document.body.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    if(file) processFile(file);
}, false);

function handleFileSelect(e) {
    const file = e.target.files[0];
    if(file) processFile(file);
}

function processFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        if(file.type.startsWith('image/')) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX = 800;
                let w = img.width, h = img.height;
                if (w > h && w > MAX) { h *= MAX / w; w = MAX; }
                else if (h > MAX) { w *= MAX / h; h = MAX; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                
                // Passed the raw 'file' here so the scanner endpoint can use it!
                setFileData(canvas.toDataURL('image/jpeg', 0.6), file.type, file.name, file);
            };
            img.src = e.target.result;
        } else {
            setFileData(e.target.result, file.type, file.name, file);
        }
    };
    reader.readAsDataURL(file);
}

function setFileData(data, mime, name, rawFile = null) {
    currentFile = { data, mime, name, rawFile };
    if(document.getElementById('file-name-display')) document.getElementById('file-name-display').innerText = name;
    
    let icon = '📄';
    if(mime.includes('image')) icon = '🖼️';
    if(mime.includes('video')) icon = '🎬';
    if(mime.includes('audio')) icon = '🎵';
    if(document.getElementById('file-icon')) document.getElementById('file-icon').innerText = icon;
    
    if(document.getElementById('file-tray')) document.getElementById('file-tray').classList.remove('hidden');
}

function clearFile() {
    currentFile = { data: null, mime: null, name: null, rawFile: null };
    if(document.getElementById('file-tray')) document.getElementById('file-tray').classList.add('hidden');
    if(document.getElementById('file-input')) document.getElementById('file-input').value = "";
}

// --- CHAT MANAGEMENT ---
function createNewChat() {
    const newChat = { id: Date.now().toString(), title: "New Conversation", messages: [] };
    chats.unshift(newChat);
    saveChats();
    loadChat(newChat.id);
    renderSidebar();
    if(window.innerWidth < 768) toggleSidebar();
}

function loadChat(chatId) {
    activeChatId = chatId;
    if(chatBox) chatBox.innerHTML = '';
    const chat = chats.find(c => c.id === chatId);
    if(document.getElementById('chat-title-header') && chat) document.getElementById('chat-title-header').innerText = chat.title;
    
    if (chat && chat.messages.length > 0) {
        chat.messages.forEach(msg => {
            if(msg.role === 'user') appendUserMessage(msg.content, msg.file);
            else if (msg.isScannerHTML) appendHTMLBubble(msg.content); // Detect scanner results
            else appendAIMessage(msg.content, true); 
        });
    } else {
        appendAIMessage("Hi there. I'm Fase. How can I help you today?", true);
    }
    renderSidebar();
}

function saveChats() { localStorage.setItem('fase_chats_pro_v3', JSON.stringify(chats)); }

function renderSidebar() {
    const list = document.getElementById('sidebar-history');
    if(!list) return;
    list.innerHTML = '';
    chats.forEach(chat => {
        const btn = document.createElement('button');
        const isActive = chat.id === activeChatId;
        btn.className = `w-full text-left px-3 py-2.5 mt-1 rounded-lg text-sm truncate transition-colors ${isActive ? 'bg-gray-200 text-black font-semibold' : 'text-gray-600 hover:bg-gray-100'}`;
        btn.innerText = chat.title;
        btn.onclick = () => loadChat(chat.id);
        list.appendChild(btn);
    });
}

// --- MESSAGE LOGIC ---
function toggleLoading(isLoading) {
    if(document.getElementById('send-btn')) document.getElementById('send-btn').disabled = isLoading;
    if(document.getElementById('send-icon')) document.getElementById('send-icon').classList.toggle('hidden', isLoading);
    if(document.getElementById('load-icon')) document.getElementById('load-icon').classList.toggle('hidden', !isLoading);
}

async function sendMessage() {
    if(!userInput) return;
    const text = userInput.value.trim();
    if (!text && !currentFile.data) return;

    toggleLoading(true);

    const currentChat = chats.find(c => c.id === activeChatId);
    if (currentChat.messages.length === 0 && text) {
        currentChat.title = text.substring(0, 25) + "...";
        if(document.getElementById('chat-title-header')) document.getElementById('chat-title-header').innerText = currentChat.title;
        renderSidebar();
    }

    const savedFile = { ...currentFile };
    appendUserMessage(text, savedFile);
    
    userInput.value = '';
    userInput.style.height = 'auto';
    clearFile();

    const uiElements = createEmptyAIBubble();
    uiElements.contentDiv.innerHTML = `<span class="text-gray-400">Thinking...</span>`;

    try {
        const apiHistory = currentChat.messages.map(m => ({
            role: m.role,
            content: m.content || "Attached a file."
        }));

        const payload = { 
            prompt: text || "Analyze the attached file.", 
            history: apiHistory, 
            model_tier: document.getElementById('model-selector') ? document.getElementById('model-selector').value : "pro", 
            file_data: savedFile.data,
            file_mime: savedFile.mime
        };

        currentChat.messages.push({ role: "user", content: text, file: savedFile.data ? savedFile : null });

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Server crashed with status: ${response.status}`);
        }

        const data = await response.json();
        const replyText = data.reply || "No response.";
        
        uiElements.contentDiv.innerHTML = DOMPurify.sanitize(marked.parse(replyText));
        
        attachCodeCopyButtons(uiElements.contentDiv);
        
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([uiElements.contentDiv]).catch(err => console.log('Math error:', err));
        }
        
        const copyBtn = uiElements.actionBar.querySelector('.copy-text-btn');
        copyBtn.onclick = function() { copyToClipboard(this, replyText); };
        
        uiElements.actionBar.classList.remove('hidden'); 

        currentChat.messages.push({ role: "assistant", content: replyText });
        saveChats();

    } catch (err) {
        uiElements.contentDiv.innerHTML = `<span class="text-red-600 font-bold border border-red-200 bg-red-50 p-2 rounded">SYSTEM ERROR: ${err.message}</span>`;
        uiElements.actionBar.classList.remove('hidden'); 
        currentChat.messages.pop(); 
    } finally {
        toggleLoading(false);
    }
}

// --- RENDERERS ---
function appendUserMessage(text, fileData = null) {
    if(!chatBox) return;
    const wrap = document.createElement('div');
    wrap.className = "flex justify-end mb-4";
    
    const bubble = document.createElement('div');
    bubble.className = "bg-gray-100 text-black px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] sm:max-w-[70%] text-sm shadow-sm";
    
    if (fileData && fileData.data) {
        if(fileData.mime.includes('image')) {
            bubble.innerHTML += `<img src="${fileData.data}" class="max-w-[200px] rounded-lg mb-2 border border-gray-200">`;
        } else {
            bubble.innerHTML += `<div class="bg-white border border-gray-200 p-2 rounded-lg text-xs font-medium mb-2 flex items-center gap-2"><span class="text-lg">📎</span> ${fileData.name}</div>`;
        }
    }
    if (text) bubble.innerHTML += `<p class="whitespace-pre-wrap">${text}</p>`;
    
    wrap.appendChild(bubble);
    chatBox.appendChild(wrap);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function createEmptyAIBubble() {
    if(!chatBox) return null;
    const wrap = document.createElement('div');
    wrap.className = "flex justify-start mb-4 group";
    
    const avatar = document.createElement('div');
    avatar.className = "w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold text-xs mr-3 shrink-0 mt-1";
    avatar.innerText = "F";

    const bubbleWrapper = document.createElement('div');
    bubbleWrapper.className = "bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%] sm:max-w-[75%] shadow-sm overflow-hidden flex flex-col";
    
    const contentDiv = document.createElement('div');
    contentDiv.className = "markdown-body";
    
    const actionBar = document.createElement('div');
    actionBar.className = "hidden flex items-center gap-4 mt-3 pt-3 border-t border-gray-100";
    actionBar.innerHTML = `
        <button class="copy-text-btn text-xs text-gray-400 hover:text-black flex items-center gap-1 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            Copy
        </button>
        <button onclick="retryMessage()" class="text-xs text-gray-400 hover:text-black flex items-center gap-1 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            Retry
        </button>
    `;

    bubbleWrapper.appendChild(contentDiv);
    bubbleWrapper.appendChild(actionBar);
    
    wrap.appendChild(avatar);
    wrap.appendChild(bubbleWrapper);
    chatBox.appendChild(wrap);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    return { wrap, contentDiv, actionBar };
}

function appendAIMessage(text, isHistory = false) {
    const ui = createEmptyAIBubble();
    ui.contentDiv.innerHTML = DOMPurify.sanitize(marked.parse(text));
    attachCodeCopyButtons(ui.contentDiv); 
    
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([ui.contentDiv]).catch(err => console.log('Math error:', err));
    }
    
    if(!isHistory) {
        const copyBtn = ui.actionBar.querySelector('.copy-text-btn');
        copyBtn.onclick = function() { copyToClipboard(this, text); };
        ui.actionBar.classList.remove('hidden');
    }
}

function appendHTMLBubble(htmlString) {
    const ui = createEmptyAIBubble();
    ui.contentDiv.innerHTML = htmlString;
}

if(userInput) {
    userInput.addEventListener("keypress", (e) => { 
        if(e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
}

// ========================================================
// --- NEW: FOOD HEALTH SCANNER INTEGRATION (TAILWIND) ---
// ========================================================

// This function can be called from index.html by pressing a new "Scan Food" button
window.scanNutritionFile = async function(file) {
    if (!file) return;

    // 1. Show User's image in chat
    const savedFile = { ...currentFile };
    appendUserMessage("Please analyze this nutrition label.", savedFile);
    clearFile();

    // 2. Create AI thinking bubble
    const uiElements = createEmptyAIBubble();
    uiElements.contentDiv.innerHTML = `<span class="text-blue-500 font-medium animate-pulse">Scanning nutrition label via AI...</span>`;

    try {
        // 3. Send raw image file to backend
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch(UPLOAD_API_URL, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error("Backend failed to respond.");
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // 4. Calculate health score & generate Tailwind HTML
        const html = generateHealthScannerHTML(data);
        uiElements.contentDiv.innerHTML = html;

        // 5. Save the visual HTML into the chat history so it doesn't disappear on refresh
        const currentChat = chats.find(c => c.id === activeChatId);
        if (currentChat) {
            currentChat.messages.push({ role: "user", content: "Please analyze this nutrition label.", file: savedFile });
            currentChat.messages.push({ role: "assistant", content: html, isScannerHTML: true });
            saveChats();
        }

    } catch (err) {
        uiElements.contentDiv.innerHTML = `<span class="text-red-600 font-bold">SCAN ERROR: ${err.message}</span>`;
    }
};

// Helper: Takes AI JSON data and builds the beautiful progress bars using Tailwind classes
function generateHealthScannerHTML(nutriments) {
    const sugar = nutriments?.sugars_100g || 0;
    const fat = nutriments?.fat_100g || 0;
    const salt = nutriments?.salt_100g || 0;

    // Skeleton bug catch
    if (sugar === 0 && fat === 0 && salt === 0) {
        return `<div class="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 font-medium">❓ Could not read the numbers from this picture. Please ensure the label is clear and straight.</div>`;
    }

    const sugarPercent = Math.min(100, (sugar / 25) * 100); 
    const fatPercent = Math.min(100, (fat / 20) * 100);
    const saltPercent = Math.min(100, (salt / 1.5) * 100);

    const averageBadness = (sugarPercent + fatPercent + saltPercent) / 3;
    const overallHealthPercent = Math.max(0, Math.round(100 - averageBadness));

    let headerColor = "text-red-500";
    if (overallHealthPercent >= 70) headerColor = "text-green-500";
    else if (overallHealthPercent >= 40) headerColor = "text-yellow-500";

    const makeBar = (label, amount, pct) => {
        let barColor = "bg-green-500";
        let status = "Good";
        if (pct >= 75) { barColor = "bg-red-500"; status = "High"; }
        else if (pct >= 40) { barColor = "bg-yellow-500"; status = "Moderate"; }
        
        return `
        <div class="mt-3">
            <div class="flex justify-between text-xs font-semibold mb-1">
                <span class="text-gray-700">${label}: ${amount}g</span>
                <span class="text-gray-500">${status}</span>
            </div>
            <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div class="h-full ${barColor}" style="width: ${pct}%"></div>
            </div>
        </div>`;
    };

    return `
    <div class="w-full bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h3 class="text-sm text-gray-500 font-bold uppercase tracking-wider mb-1">Health Score</h3>
        <div class="text-4xl font-extrabold ${headerColor} mb-4">${overallHealthPercent}%</div>
        <div class="border-t border-gray-100 pt-2">
            ${makeBar('Sugar', sugar, sugarPercent)}
            ${makeBar('Fat', fat, fatPercent)}
            ${makeBar('Salt', salt, saltPercent)}
        </div>
    </div>`;
}
