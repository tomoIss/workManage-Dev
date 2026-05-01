let currentClass = localStorage.getItem('currentClass') || '';
let currentTasks = [];

// --- 初期化 ---
async function init() {
    if (!currentClass) {
        await showClassSelection(false);
    } else {
        updateHeader();
        loadTasks();
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
        const data = await apiGetClassList(); // api.jsの関数を使用
        const btnContainer = document.getElementById('class-list-buttons');
        btnContainer.innerHTML = '';

        if (data.classes && data.classes.length > 0) {
            data.classes.forEach(cls => {
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
        alert("クラス一覧の取得に失敗しました。");
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
    const input = document.getElementById('new-class-input').value.trim();
    if (!input) {
        alert("クラス名を入力してください");
        return;
    }
    // 全角を半角に変換し、小文字に統一してチェック
    const normalized = input.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    }).toLowerCase();

    const hasIss = /iss/.test(normalized);
    const digitCount = (normalized.match(/\d/g) || []).length;

    if (hasIss && digitCount === 3) {
        // 条件に合致すれば作成
        selectClass(input);
        inputField.value = ''; // 入力欄をクリア
    } else {
        // エラーメッセージ
        alert("クラス名の形式が正しくありません。\n「iss」という文字と、3つの数字を含めてください。\n(例: 3-4issR8, 3年2組issr1)");
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
    if (!currentClass) return;
    const statusMsg = document.getElementById('status-msg');
    const container = document.getElementById('task-list');
    container.innerHTML = '';
    statusMsg.style.display = 'block';
    statusMsg.innerText = "チョークで書き込み中...";

    try {
        const result = await apiGetTasks(currentClass); // api.jsの関数を使用

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
        const result = await apiAddTask(payload); // api.js
        if (result.status === 'SUCCESS') loadTasks();
        else alert("追加エラー: " + result.status);
    } catch (e) {
        alert("通信エラー: " + e.message);
    }
}

async function confirmDelete(id) {
    if (!confirm("本当にこの課題を削除しますか？")) return;
    closeModals();
    const payload = { action: 'delete', className: currentClass, id: id };

    try {
        document.getElementById('status-msg').style.display = 'block';
        document.getElementById('status-msg').innerText = "削除処理中...";
        const result = await apiDeleteTask(payload); // api.js
        if (result.status === 'SUCCESS') loadTasks();
        else alert("削除エラー: " + result.status);
    } catch (e) {
        alert("通信エラー: " + e.message);
    }
}

function formatDateTime(isoString) {
    if (!isoString) return "--/-- --:--";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return String(isoString);
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

window.addEventListener('DOMContentLoaded', init);
