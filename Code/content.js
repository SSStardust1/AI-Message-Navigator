// --- 1. UI 构造 ---
const navContainer = document.createElement('div');
navContainer.id = 'gemini-nav-window';
navContainer.innerHTML = `
    <div id="gemini-nav-header" style="cursor: move; user-select: none;">AI 消息导航</div>
    <div id="gemini-nav-search-container">
        <input type="text" id="gemini-nav-search-input" placeholder="搜索历史消息...">
    </div>
    <div id="gemini-nav-list"></div>
`;
document.body.appendChild(navContainer);

const navList = document.getElementById('gemini-nav-list');
const searchInput = document.getElementById('gemini-nav-search-input');
const navHeader = document.getElementById('gemini-nav-header');

let allUserMessages = [];
let lastContentHash = "";
let isInitialLoad = true;

// --- 2. 核心校验：排除侧边栏、AI 回复和思考过程 ---
function isValidUserMsg(node) {
    if (navContainer.contains(node)) return false;
    const text = node.innerText.trim();
    if (text.length < 2) return false;

    let current = node;
    let depth = 0;
    while (current && depth < 10) {
        const cls = (current.className || "").toString().toLowerCase();
        const tag = current.tagName.toLowerCase();

        // 排除侧边栏、导航和 AI markdown 区域
        if (cls.includes('sidebar') || cls.includes('history') || tag === 'aside' || tag === 'nav' || 
            cls.includes('markdown') || cls.includes('thought') || cls.includes('assistant') || cls.includes('answer')) {
            return false;
        }
        
        if (tag === 'user-query') return true; // Gemini 专属标签
        current = current.parentElement;
        depth++;
    }
    return true;
}

// --- 3. 消息抓取 ---
function refreshMessageList() {
    const selectors = [
        'user-query .query-text', 
        '[data-testid="message_text_content"]', 
        'div[class^="fbb"]', 
        '.query-text-wrapper', 
        '[data-message-author-role="user"]'
    ];

    let nodes = [];
    selectors.forEach(s => {
        nodes = nodes.concat(Array.from(document.querySelectorAll(s)));
    });

    const uniqueUserMessages = [];
    const seenTexts = new Set();

    nodes.forEach(node => {
        const txt = node.innerText.trim();
        if (txt && !seenTexts.has(txt) && isValidUserMsg(node)) {
            uniqueUserMessages.push(node);
            seenTexts.add(txt);
        }
    });

    const currentHash = uniqueUserMessages.length + (uniqueUserMessages[0]?.innerText || "");
    if (currentHash === lastContentHash && searchInput.value === "") return;

    lastContentHash = currentHash;
    allUserMessages = uniqueUserMessages;
    renderList();
}

function renderList() {
    const term = searchInput.value.toLowerCase();
    navList.innerHTML = '';
    
    allUserMessages.forEach((msg, i) => {
        const text = msg.innerText.trim();
        if (text && text.toLowerCase().includes(term)) {
            const item = document.createElement('div');
            item.className = 'gemini-nav-item';
            // 针对 fMRI 研究等科研提问保留较长预览
            item.innerText = `${i + 1}. ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`;
            item.onclick = () => {
                msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                msg.style.outline = '2px solid #1a73e8';
                setTimeout(() => msg.style.outline = '', 2000);
            };
            navList.appendChild(item);
        }
    });

    // 自动置底
    const isAtBottom = navList.scrollHeight - navList.scrollTop <= navList.clientHeight + 100;
    if (isInitialLoad || isAtBottom) {
        setTimeout(() => {
            navList.scrollTop = navList.scrollHeight;
            isInitialLoad = false;
        }, 100);
    }
}

// --- 4. 监听与交互 ---
const debouncedRefresh = (() => {
    let timer;
    return () => { clearTimeout(timer); timer = setTimeout(refreshMessageList, 500); };
})();

searchInput.addEventListener('input', renderList);

let isDragging = false, ox, oy;
navHeader.onmousedown = (e) => {
    isDragging = true; ox = e.clientX - navContainer.offsetLeft; oy = e.clientY - navContainer.offsetTop;
};
document.onmousemove = (e) => {
    if (isDragging) {
        navContainer.style.left = (e.clientX - ox) + 'px';
        navContainer.style.top = (e.clientY - oy) + 'px';
        navContainer.style.right = 'auto';
    }
};
document.onmouseup = () => isDragging = false;

const observer = new MutationObserver(debouncedRefresh);
observer.observe(document.body, { childList: true, subtree: true });
setTimeout(refreshMessageList, 1500);