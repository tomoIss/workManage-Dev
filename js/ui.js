let currentClass = localStorage.getItem('currentClass') || '';
let currentTasks = [];
let existingClasses = []; // 既存クラスを保持する変数

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

// --- クラス名の正規化関数 (3年4組issr8 -> 3-4issR8) ---
function normalizeClassName(input) {
    if (!input) return "";
    
    // 1. 全角を半角に変換
    let val = input.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });

    // 2. 「○年○組」を「○-○」に変換
    val = val.replace(/(\d+)年(\d+)組/, '$1-$2');

    // 3. 不要な空白を削除
    val = val.replace(/\s+/g, '');

    // 4. "iss" を小文字に、"R" を大文字に統一（3-4issR8形式）
    val = val.replace(/iss/i, 'iss');
    val = val.replace(/r/i, 'R');

    return val;
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
        const data = await apiGetClassList();
        const btnContainer = document.getElementById('class-list-buttons');
        btnContainer.innerHTML = '';

        // 既存クラスリストを保存（後で重複チェックに使用）
        existingClasses = data.classes || [];

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
    const inputField = document.getElementById('new-class-input');
    const rawInput = inputField.value.trim();
    
    if (!rawInput) {
        alert("クラス名を入力してください");
        return;
    }

    // クラス名の整形 (3-4issR8形式へ)
    const normalized = normalizeClassName(rawInput);

    // バリデーション
    const hasIss = /iss/i.test(normalized);
    const digitCount = (normalized.match(/\d/g) || []).length;

    if (!hasIss || digitCount < 3) {
        alert("クラス名の形式が正しくありません。\n「iss」と、3つ以上の数字を含めてください。\n(例: 3-4issR8)");
        return;
    }

    // 既存チェック
    if (existingClasses.includes(normalized)) {
        alert(`既存のクラス「${normalized}」が見つかりました。このクラスを表示します。`);
    } else {
        if(!confirm(`新しいクラス「${normalized}」を作成しますか？`)) return;
    }

    selectClass(normalized);
    inputField.value = ''; 
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

    const statusMsg = document.getElementById('status-msg');
    
    try {
        closeModals();
        statusMsg.style.display = 'block';
        statusMsg.innerText = "追加処理中...";

        const d = new Date(deadlineRaw);
        const formattedDeadline = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes()}`;
        const payload = {
            action: 'add',
            className: currentClass,
            task: { subject, title, detail, deadline: formattedDeadline }
        };

        const result = await apiAddTask(payload);
        if (result.status === 'SUCCESS') {
            await loadTasks(); // 成功時は再読み込みでメッセージが消える
        } else {
            alert("追加エラー: " + result.status);
            statusMsg.style.display = 'none'; // エラー時は「追加中」を消す
        }
    } catch (e) {
        alert("通信エラー: " + e.message);
        statusMsg.style.display = 'none'; 
    }
}

async function confirmDelete(id) {
    if (!confirm("本当にこの課題を削除しますか？")) return;
    
    const statusMsg = document.getElementById('status-msg');
    closeModals();

    try {
        statusMsg.style.display = 'block';
        statusMsg.innerText = "削除処理中...";

        const payload = { action: 'delete', className: currentClass, id: id };
        const result = await apiDeleteTask(payload);

        if (result.status === 'SUCCESS') {
            await loadTasks();
        } else {
            alert("削除エラー: " + result.status);
            statusMsg.style.display = 'none';
        }
    } catch (e) {
        alert("通信エラー: " + e.message);
        statusMsg.style.display = 'none';
    }
}

// --- その他 (renderTasks, formatDateTime 等は変更なしのため省略可能ですが、構造維持のため残します) ---
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

function formatDateTime(isoString) {
    if (!isoString) return "--/-- --:--";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return String(isoString);
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

window.addEventListener('DOMContentLoaded', init);
