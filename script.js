// --- CORE SETTINGS ---
const API_URL = "https://lord123hh-shsj.hf.space/chat"; 

let sessionUser = "User";
let currentFile = { data: null, mime: null, name: null };
let chats = JSON.parse(localStorage.getItem('fase_chats_bw_v2')) || [];
let activeChatId = null;

// --- DOM ELEMENTS ---
const tosModal = document.getElementById('tos-modal');
const mainApp = document.getElementById('main-app');
const chatBox = document.getElementById('chat-box');
const sidebar = document.getElementById('sidebar');
const userInput = document.getElementById('user-input');
const dragOverlay = document.getElementById('drag-overlay');

// Fallback for marked parser
if(typeof marked === "undefined"){ window.marked = { parse: (t) => t }; }

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

if (!localStorage.getItem('fase_verified_v2')) {
    if(tosModal) tosModal.classList.remove('hidden');
} else {
    sessionUser = localStorage.getItem('fase_user_alias_v2') || "User";
    initApp();
}

if(loginBtn) {
    loginBtn.addEventListener('click', () => {
        const name = userNameInput.value.trim();
        localStorage.setItem('fase_verified_v2', 'true');
        localStorage.setItem('fase_user_alias_v2', name);
        sessionUser = name;
        tosModal.classList.add('hidden');
        initApp();
    });
}

function logout() {
    if(confirm("Are you sure you want to log out? This will require re-accepting the terms.")) {
        localStorage.removeItem('fase_verified_v2');
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
                
                setFileData(canvas.toDataURL('image/jpeg', 0.6), file.type, file.name);
            };
            img.src = e.target.result;
        } else {
            setFileData(e.target.result, file.type, file.name);
        }
    };
    reader.readAsDataURL(file);
}

function setFileData(data, mime, name) {
    currentFile = { data, mime, name };
    if(document.getElementById('file-name-display')) document.getElementById('file-name-display').innerText = name;
    
    let icon = '📄';
    if(mime.includes('image')) icon = '🖼️';
    if(mime.includes('video')) icon = '🎬';
    if(mime.includes('audio')) icon = '🎵';
    if(document.getElementById('file-icon')) document.getElementById('file-icon').innerText = icon;
    
    if(document.getElementById('file-tray')) document.getElementById('file-tray').classList.remove('hidden');
}

function clearFile() {
    currentFile = { data: null, mime: null, name: null };
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
            else appendAIMessage(msg.content);
        });
    } else {
        appendAIMessage("Hi there. I'm Fase. How can I help you today?");
    }
    renderSidebar();
}

function saveChats() { localStorage.setItem('fase_chats_bw_v2', JSON.stringify(chats)); }

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

    const aiBubble = createEmptyAIBubble();
    aiBubble.innerHTML = `<span class="text-gray-400">Thinking...</span>`;

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
        
        aiBubble.innerHTML = DOMPurify.sanitize(marked.parse(data.reply || "No response."));
        currentChat.messages.push({ role: "assistant", content: data.reply });
        saveChats();

    } catch (err) {
        aiBubble.innerHTML = `<span class="text-red-600 font-bold border border-red-200 bg-red-50 p-2 rounded">SYSTEM ERROR: ${err.message}</span>`;
        currentChat.messages.pop(); // Remove failed message
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

function appendAIMessage(text) {
    const bubble = createEmptyAIBubble();
    if(bubble) bubble.innerHTML = DOMPurify.sanitize(marked.parse(text));
}

function createEmptyAIBubble() {
    if(!chatBox) return null;
    const wrap = document.createElement('div');
    wrap.className = "flex justify-start mb-4";
    
    const avatar = document.createElement('div');
    avatar.className = "w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold text-xs mr-3 shrink-0 mt-1";
    avatar.innerText = "F";

    const bubble = document.createElement('div');
    bubble.className = "bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%] sm:max-w-[75%] markdown-body shadow-sm";
    
    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    chatBox.appendChild(wrap);
    chatBox.scrollTop = chatBox.scrollHeight;
    return bubble;
}

if(userInput) {
    userInput.addEventListener("keypress", (e) => { 
        if(e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
}

