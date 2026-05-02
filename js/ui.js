let currentClass = localStorage.getItem('currentClass') || '';
let currentTasks = [];
let existingClasses = []; // 既存のクラス一覧を保持する変数

// --- 初期化 ---
async function init() {
    // 既存クラスのリストは常に最初に取得しておく（重複チェックのため）
    await fetchClassListOnly();

    if (!currentClass) {
        await showClassSelection(false);
    } else {
        updateHeader();
        loadTasks();
    }
}

// クラスリストのみを取得して変数に格納する内部関数
async function fetchClassListOnly() {
    try {
        const data = await apiGetClassList();
        existingClasses = data.classes || [];
    } catch (e) {
        console.error("クラスリストの取得に失敗しました", e);
    }
}

function updateHeader() {
    document.getElementById('header-class-name').innerHTML = `${currentClass || '未設定'}<br>課題リスト`;
}

// --- クラス選択関連 ---
async function showClassSelection(canCancel = true) {
    const ui = document.getElementById('class-selection-ui');
    const loading = document.getElementById('loading-ui');
    const container = document.getElementById('class-selection-container');
    const cancelBtn = document.getElementById('close-selection-btn');

    ui.style.display = 'flex';
    loading.style.display = 'flex';
    container.style.display = 'none';
    cancelBtn.style.display = canCancel ? 'inline-block' : 'none';

    try {
        // 表示の際にも最新のリストを取得
        await fetchClassListOnly();
        
        const btnContainer = document.getElementById('class-list-buttons');
        btnContainer.innerHTML = '';

        if (existingClasses.length > 0) {
            existingClasses.forEach(cls => {
                if (['クラスリスト', '課題リストテンプレート', 'スクリプトログ'].includes(cls)) return;
                const btn = document.createElement('button');
                btn.className = 'class-btn';
                btn.innerText = cls;
                btn.onclick = () => selectClass(cls);
                btnContainer.appendChild(btn);
            });
        } else {
            btnContainer.innerHTML = '<p>既存のクラスはありません</p>';
        }

        loading.style.display = 'none';
        container.style.display = 'block';
    } catch (e) {
        alert("クラス一覧の表示に失敗しました。");
        loading.style.display = 'none';
        container.style.display = 'block';
    }
}

function selectClass(cls) {
    if (!cls) return;
    currentClass = cls;
    localStorage.setItem('currentClass', currentClass);
    document.getElementById('class-selection-ui').style.display = 'none';
    updateHeader();
    loadTasks();
}

function createNewClass() {
    const inputElement = document.getElementById('new-class-input');
    const input = inputElement.value.trim();
    if (!input) {
        alert("クラス名を入力してください");
        return;
    }
    
    // 1. 入力値の正規化 (String変換を挟んで安全にする)
    let normalized = String(input).replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    }).toLowerCase();

    normalized = normalized.replace(/年/g, '-').replace(/組/g, '');
    normalized = normalized.replace(/iss/g, 'iss').replace(/r/g, 'R');

    const hasIss = /iss/i.test(normalized);
    const digitCount = (normalized.match(/\d/g) || []).length;

    if (hasIss && digitCount >= 3) {
        try {
            // --- 修正: エラーでクラッシュしないための安全な比較 ---
            const isExisting = existingClasses.some(cls => {
                if (!cls) return false; // 空データはスキップ
                
                // GASのデータが数値型などで渡ってきてもエラーにならないよう String(cls) で文字列化
                let checkCls = String(cls).replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
                    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
                }).toLowerCase();
                
                checkCls = checkCls.replace(/年/g, '-').replace(/組/g, '').replace(/iss/g, 'iss').replace(/r/g, 'R');
                
                return checkCls === normalized;
            });

            if (isExisting) {
                alert(`既存のクラス「${normalized}」が見つかりました。既存のデータに接続します。`);
            }
            
            // 接続処理へ
            selectClass(normalized);
            inputElement.value = '';
            
        } catch (e) {
            // 万が一ここでエラーが起きても原因がわかるように表示
            alert("処理中にエラーが発生しました: " + e.message);
        }
    } else {
        alert("クラス名の形式が正しくありません。\n「iss」という文字と、3つの数字を含めてください。\n(例: 3-4issR8, 3年4組issr8)");
    }
}


function closeClassSelection() {
    document.getElementById('class-selection-ui').style.display = 'none';
}

function promptClassChange() {
    showClassSelection(true);
}

// --- 課題の読み込みと描画 ---
async function loadTasks() {
    if (!currentClass) {
        await showClassSelection(false);
        return;
    }
    const statusMsg = document.getElementById('status-msg');
    const container = document.getElementById('task-list');
    container.innerHTML = '';
    statusMsg.style.display = 'block';
    statusMsg.innerText = "チョークで書き込み中...";

    try {
        const result = await apiGetTasks(currentClass);

        if (result.status === "SUCCESS") {
            currentTasks = result.tasks || [];
            if (currentTasks.length === 0) {
                statusMsg.innerText = "現在、課題はありません。";
            } else {
                statusMsg.style.display = 'none';
                renderTasks(currentTasks);
            }
        } else {
            statusMsg.innerText = "データエラー: " + result.status;
        }
    } catch (error) {
        statusMsg.innerHTML = `取得に失敗しました。<br><small>${error.message}</small>`;
    }
}

function renderTasks(tasks) {
    const container = document.getElementById('task-list');
    container.innerHTML = '';
    tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.onclick = () => openDetailModal(task.課題id);
        card.innerHTML = `
            <div class="subject">${task.教科 || "不明"}</div>
            <div class="title">${task.課題名 || "無題の課題"}</div>
            <div class="detail-badge">${task.詳細 || "==詳細なし=="}</div>
            <div class="deadline">${formatDateTime(task.期限)}</div>
        `;
        container.appendChild(card);
    });
}

// --- モーダル制御 ---
function closeModals() {
    document.getElementById('add-modal').style.display = 'none';
    document.getElementById('detail-modal').style.display = 'none';
}

function openAddModal() {
    if (!currentClass) {
        alert("先にクラスを設定してください。");
        promptClassChange();
        return;
    }
    document.getElementById('add-subject').value = '';
    document.getElementById('add-title').value = '';
    document.getElementById('add-detail').value = '';
    document.getElementById('add-deadline').value = '';
    document.getElementById('add-modal').style.display = 'flex';
}

function openDetailModal(id) {
    const task = currentTasks.find(t => t.課題id === id);
    if (!task) return;

    document.getElementById('detail-subject').innerText = task.教科 || "不明";
    document.getElementById('detail-title').innerText = task.課題名 || "無題の課題";
    document.getElementById('detail-desc').innerText = task.詳細 || "詳細なし";
    document.getElementById('detail-deadline').innerText = "期限: " + formatDateTime(task.期限);
    document.getElementById('detail-delete-btn').onclick = () => confirmDelete(id);
    document.getElementById('detail-modal').style.display = 'flex';
}

// --- 登録・削除アクション ---
async function submitTask() {
    const subject = document.getElementById('add-subject').value.trim();
    const title = document.getElementById('add-title').value.trim();
    const detail = document.getElementById('add-detail').value.trim();
    const deadlineRaw = document.getElementById('add-deadline').value;

    if (!subject || !title || !deadlineRaw) {
        alert("科目名、課題名、期限は必須です。");
        return;
    }

    const d = new Date(deadlineRaw);
    const formattedDeadline = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes()}`;
    const payload = {
        action: 'add',
        className: currentClass,
        task: { subject, title, detail, deadline: formattedDeadline }
    };

    try {
        closeModals();
        document.getElementById('status-msg').style.display = 'block';
        document.getElementById('status-msg').innerText = "追加処理中...";
        const result = await apiAddTask(payload);
        if (result.status === 'SUCCESS') {
            loadTasks();
        } else {
            alert("追加エラー: " + result.status);
            document.getElementById('status-msg').style.display = 'none';
        }
    } catch (e) {
        alert("通信エラー: " + e.message);
        document.getElementById('status-msg').style.display = 'none';
    }
}

async function confirmDelete(id) {
    if (!confirm("本当にこの課題を削除しますか？")) return;
    closeModals();
    const payload = { action: 'delete', className: currentClass, id: id };

    try {
        document.getElementById('status-msg').style.display = 'block';
        document.getElementById('status-msg').innerText = "削除処理中...";
        const result = await apiDeleteTask(payload);
        if (result.status === 'SUCCESS') {
            loadTasks();
        } else {
            alert("削除エラー: " + result.status);
            document.getElementById('status-msg').style.display = 'none';
        }
    } catch (e) {
        alert("通信エラー: " + e.message);
        document.getElementById('status-msg').style.display = 'none';
    }
}

function formatDateTime(isoString) {
    if (!isoString) return "--/-- --:--";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return String(isoString);
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

window.addEventListener('DOMContentLoaded', init);
