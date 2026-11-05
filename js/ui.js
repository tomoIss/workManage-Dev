const KEY_CLASS = 'dev_currentClass';
const KEY_TASKS_PREFIX = 'dev_cachedTasks_';
const USER_NAME = 'dev_userName';
const DONE_TASKS = 'dev_doneTasks';

let currentClass = localStorage.getItem(KEY_CLASS) || '';
let currentTasks = [];
let existingClasses = []; // 既存のクラス一覧を保持する変数
let userName = localStorage.getItem(USER_NAME) || '';

let isModalClosing = false;

// ==========================================
// データ正規化ヘルパー (Javaの英字キー -> 日本語キー変換)
// ==========================================
function normalizeTask(task) {
    if (!task) return null;
    return {
        課題id: task.id ?? task.課題id,
        className: task.className,
        教科: task.subject ?? task.教科,
        課題名: task.title ?? task.課題名,
        詳細: task.description ?? task.詳細,
        期限: task.date ?? task.期限,
        作成日時: task.createAt ?? task.作成日時,
        追加者: task.createBy ?? task.追加者
    };
}

// ==========================================
// アプリケーションロジック
// ==========================================

async function isOnline() {
    if (!navigator.onLine) return false;
    try {
        const response = await fetch('./icon/icon-192.jpg', { method: 'HEAD', cache: 'no-cache', signal: AbortSignal.timeout(3000) });
        return response.ok;
    } catch {
        return false;
    }
}

function loadCachedTasks(className) {
    try {
        const raw = localStorage.getItem(KEY_TASKS_PREFIX + className);
        if (!raw) return [];
        const cached = JSON.parse(raw);
        return Array.isArray(cached) ? cached : [];
    } catch (e) {
        console.warn('cachedTasks読み込み失敗', e);
        return [];
    }
}

function saveCachedTasks(className, tasks) {
    try {
        localStorage.setItem(KEY_TASKS_PREFIX + className, JSON.stringify(tasks));
    } catch (e) {
        console.warn('cachedTasks保存失敗', e);
    }
}

function getTaskFingerprint(task) {
    const deadline = task.期限 ? new Date(task.期限).getTime() : 'no-deadline';
    return `${task.課題id}-${task.教科}-${task.課題名}-${deadline}`;
}

function getDoneTasks() {
    return JSON.parse(localStorage.getItem(DONE_TASKS) || '[]');
}

function cleanupDoneTasks(latestTasks) {
    const doneList = getDoneTasks();
    if (doneList.length === 0) return;

    const validFingerprints = latestTasks.map(task => getTaskFingerprint(task));
    const cleanedList = doneList.filter(fingerprint => validFingerprints.includes(fingerprint));

    localStorage.setItem(DONE_TASKS, JSON.stringify(cleanedList));
    console.log(`キャッシュを整理しました。保持中: ${cleanedList.length}件`);
}

function toggleTaskStatus(event, taskId) {
    event.stopPropagation();

    const task = currentTasks.find(t => t.課題id == taskId);
    if (!task) return;

    const fingerprint = getTaskFingerprint(task);
    let doneList = getDoneTasks();

    if (doneList.includes(fingerprint)) {
        doneList = doneList.filter(f => f !== fingerprint);
    } else {
        doneList.push(fingerprint);
    }

    localStorage.setItem(DONE_TASKS, JSON.stringify(doneList));
    renderTasks(currentTasks);
}

function showNativePopup(message, options = {}) {
    const popup = document.getElementById('native-popup');
    const messageEl = document.getElementById('native-popup-message');
    const actions = document.getElementById('native-popup-actions');

    messageEl.innerText = message;
    actions.innerHTML = '';
    popup.classList.add('active');

    if (options.type === 'confirm') {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel';
        cancelBtn.innerText = options.cancelText || 'キャンセル';
        cancelBtn.onclick = () => {
            closeNativePopup();
            if (typeof options.onCancel === 'function') options.onCancel();
        };

        const confirmBtn = document.createElement('button');
        confirmBtn.innerText = options.confirmText || 'OK';
        confirmBtn.onclick = () => {
            closeNativePopup();
            if (typeof options.onConfirm === 'function') options.onConfirm();
        };

        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);
    } else {
        const okBtn = document.createElement('button');
        okBtn.innerText = options.okText || '閉じる';
        okBtn.onclick = () => {
            closeNativePopup();
            if (typeof options.onClose === 'function') options.onClose();
        };
        actions.appendChild(okBtn);
    }
}

function closeNativePopup() {
    const popup = document.getElementById('native-popup');
    popup.classList.remove('active');
}

// --- 初期化 ---
async function init() {
    if (!userName) {
        showClassSelection(false);
        document.getElementById('username-init-modal').style.display = 'flex'; 
        return;
    }

    if (!currentClass) {
        showClassSelection(false);
    } else {
        updateHeader();
        currentTasks = loadCachedTasks(currentClass);
        if (currentTasks.length > 0) {
            renderTasks(currentTasks);
            const statusMsg = document.getElementById('status-msg');
            statusMsg.style.display = 'block';
            const online = await isOnline();
            statusMsg.innerText = online ? '最新データを取得しています...' : 'オフライン中：前回のデータを表示しています';
        }
        loadTasks();
    }
}

function submitInitialUsername() {
    const grade = document.getElementById('init-grade').value;
    const cls = document.getElementById('init-class').value;
    const attendanceNo = document.getElementById('init-attendance').value;
    const school = document.getElementById('init-school').value;

    userName = grade + cls + attendanceNo + school;
    localStorage.setItem(USER_NAME, userName);

    document.getElementById('username-init-modal').style.display = 'none';
    init();
}

// クラスリストを取得
async function fetchClassListOnly() {
    try {
        const res = await apiGetClassList();
        // {"status":"SUCCESS", "data": {"classes": [...]}} またはフォールバック
        const list = res?.data?.classes || res?.classes || res?.data || [];
        
        // オブジェクト配列 [{"className": "1-1issR8"}] の場合は文字列配列へ正規化
        existingClasses = list.map(item => typeof item === 'object' && item !== null ? (item.className || item.id) : item);
        return existingClasses;
    } catch (e) {
        console.error("クラスリストの取得に失敗しました", e);
        return existingClasses;
    }
}

function updateClassSelectionButtons() {
    const btnContainer = document.getElementById('class-list-buttons');
    btnContainer.innerHTML = '';

    if (existingClasses.length > 0) {
        existingClasses.forEach(cls => {
            const clsStr = String(cls);
            if (!clsStr.trim()) return;

            const btn = document.createElement('button');
            btn.className = 'class-btn';
            btn.innerText = clsStr;
            btn.onclick = () => selectClass(clsStr);
            btnContainer.appendChild(btn);
        });
    } else {
        btnContainer.innerHTML = '<p>既存のクラスはありません</p>';
    }
}

function updateHeader() {
    document.getElementById('header-class-name').innerHTML = `${currentClass || '未設定'}<br>課題リストDev`;
}

async function showClassSelection(canCancel = true) {
    const ui = document.getElementById('class-selection-ui');
    const loading = document.getElementById('loading-ui');
    const container = document.getElementById('class-selection-container');
    const cancelBtn = document.getElementById('close-selection-btn');

    ui.style.display = 'flex';
    loading.style.display = 'flex';
    container.style.display = 'none';
    cancelBtn.style.display = canCancel ? 'inline-block' : 'none';

    const btnContainer = document.getElementById('class-list-buttons');
    btnContainer.innerHTML = '';

    const gradeSel = document.getElementById('new-class-grade');
    const classSel = document.getElementById('new-class-class');
    const schoolSel = document.getElementById('new-class-school');
    const createBtn = document.querySelector('.new-class-btn');

    const online = await isOnline();
    if (!online) {
        btnContainer.innerHTML = '<div style="color: #ff6b6b; font-weight: bold; padding: 20px; text-align: center;">現在オフラインのため、クラスを切り替えできません。</div>';
        if (gradeSel) gradeSel.disabled = true;
        if (classSel) classSel.disabled = true;
        if (schoolSel) schoolSel.disabled = true;
        if (createBtn) createBtn.disabled = true;
        
        loading.style.display = 'none';
        container.style.display = 'block';
        showNativePopup('オフライン中はクラス変更できません。');
        return;
    }

    if (gradeSel) gradeSel.disabled = false;
    if (classSel) classSel.disabled = false;
    if (schoolSel) schoolSel.disabled = false;
    if (createBtn) createBtn.disabled = false;

    if (existingClasses.length > 0) {
        updateClassSelectionButtons();
    } else {
        btnContainer.innerHTML = '<p>クラス一覧を読み込んでいます...</p>';
    }

    fetchClassListOnly()
        .then(() => updateClassSelectionButtons())
        .catch(() => {
            if (existingClasses.length === 0) {
                btnContainer.innerHTML = '<p>クラス一覧の取得に失敗しました。</p>';
            }
        })
        .finally(() => {
            loading.style.display = 'none';
            container.style.display = 'block';
        });
}

function selectClass(cls) {
    if (!cls) return;
    currentClass = cls;
    localStorage.setItem(KEY_CLASS, currentClass);
    document.getElementById('class-selection-ui').style.display = 'none';
    updateHeader();
    loadTasks();
}

function getSchoolYearCode() {
    const now = new Date();
    let year = now.getFullYear();
    const month = now.getMonth() + 1;
    if (month >= 1 && month <= 3) {
        year -= 1;
    }
    const reiwaYear = year - 2018;
    return `R${reiwaYear}`;
}

// 新規クラス作成
async function createNewClass() {
    const online = await isOnline();
    if (!online) {
        showNativePopup('オフライン中は新しいクラスを作成できません。');
        return;
    }

    const grade = document.getElementById('new-class-grade').value;
    const clsNum = document.getElementById('new-class-class').value;
    const school = document.getElementById('new-class-school').value;
    const year = getSchoolYearCode();
    
    const normalized = `${grade}-${clsNum}${school}${year}`;

    try {
        const isExisting = existingClasses.some(cls => String(cls).trim().toLowerCase() === normalized.toLowerCase());

        if (isExisting) {
            showNativePopup(`既存のクラス「${normalized}」が見つかりました。接続します。`);
            selectClass(normalized);
        } else {
            // サーバーに登録
            await apiCreateClass(normalized);
            showNativePopup(`新規クラス「${normalized}」を作成しました。`);
            selectClass(normalized);
        }
    } catch (e) {
        showNativePopup("クラス登録エラー: " + e.message);
    }
}

function closeClassSelection() {
    document.getElementById('class-selection-ui').style.display = 'none';
}

function promptClassChange() {
    showClassSelection(true);
}

// 課題の読み込み
async function loadTasks() {
    if (!currentClass) {
        await showClassSelection(false);
        return;
    }
    const statusMsg = document.getElementById('status-msg');
    const container = document.getElementById('task-list');
    container.innerHTML = '';
    statusMsg.style.display = 'block';

    const online = await isOnline();
    const cachedTasks = loadCachedTasks(currentClass);
    if (cachedTasks.length > 0) {
        currentTasks = cachedTasks;
        renderTasks(currentTasks);
        statusMsg.innerText = online ? '最新データを取得しています...' : 'オフライン中：前回のデータを表示しています';
    } else if (!online) {
        statusMsg.innerText = 'オフライン中です。前回のデータがありません。';
        return;
    }

    if (!online) return;

    statusMsg.innerText = 'チョークで書き込み中...';

    try {
        const result = await apiGetTasks(currentClass);

        if (result.status === 'SUCCESS') {
            // {"status":"SUCCESS", "data": {"works": [...]}} から抽出して正規化
            const rawTasks = result?.works || result?.work || result?.tasks || [];
            currentTasks = rawTasks.map(normalizeTask).filter(Boolean);

            saveCachedTasks(currentClass, currentTasks);
            cleanupDoneTasks(currentTasks);
            
            if (currentTasks.length === 0) {
                statusMsg.innerText = '現在、課題はありません。';
                container.innerHTML = '';
            } else {
                statusMsg.style.display = 'none';
                renderTasks(currentTasks);
            }
        } else {
            statusMsg.innerText = 'データエラー: ' + result.status;
        }
    } catch (error) {
        if (cachedTasks.length > 0) {
            statusMsg.innerHTML = `データ取得に失敗しました。前回のキャッシュを表示します。<br><small>${error.message}</small>`;
            renderTasks(cachedTasks);
        } else {
            statusMsg.innerHTML = `取得に失敗しました。<br><small>${error.message}</small>`;
        }
    }
}

function getRemainingTime(isoString) {
    if (!isoString) return { text: '', isUrgent: false };
    const deadline = new Date(isoString);
    if (isNaN(deadline.getTime())) return { text: '', isUrgent: false };

    const now = new Date();
    const diffMs = deadline - now;

    if (diffMs <= 0) {
        return { text: '期限切れ', isUrgent: true };
    }

    const totalMinutes = Math.ceil(diffMs / (1000 * 60));
    if (totalMinutes < 60 * 24) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        return { text: `残り ${timeStr}`, isUrgent: true };
    } else {
        const days = Math.floor(totalMinutes / (60 * 24));
        return { text: `残り ${days}日`, isUrgent: false };
    }
}

function renderTasks(tasks) {
    const container = document.getElementById('task-list');
    container.innerHTML = '';
    const doneList = getDoneTasks();
    
    const validTasks = tasks.filter(task => task && (task.課題id || task.教科 || task.課題名));
    if (validTasks.length === 0) {
        const statusMsg = document.getElementById('status-msg');
        if (statusMsg) {
            statusMsg.style.display = 'block';
            statusMsg.innerText = '現在、課題はありません。';
        }
        return;
    }

    validTasks.forEach(task => {
        const isDone = doneList.includes(getTaskFingerprint(task));
        const remaining = getRemainingTime(task.期限);
    
        const card = document.createElement('div');
        card.className = 'task-card';
        card.onclick = () => openDetailModal(task.課題id);

        card.innerHTML = `
            <button class="status-toggle-btn ${isDone ? 'is-done' : ''}" 
                    onclick="toggleTaskStatus(event, '${task.課題id}')">
                ${isDone ? '完了' : '未完了'}
            </button>
            <div class="subject">${task.教科 || "不明"}</div>
            <div class="title">${task.課題名 || "無題の課題"}</div>
            <div class="detail-badge">${task.詳細 || "==詳細なし=="}</div>
            <div class="task-footer">
                <div class="time-left ${remaining.isUrgent ? 'urgent' : ''}">${remaining.text}</div>
                <div class="deadline">${formatDateTime(task.期限)}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

function closeModals() {
    document.getElementById('add-modal').style.display = 'none';
    document.getElementById('detail-modal').style.display = 'none';

    isModalClosing = true;
    setTimeout(() => {
        isModalClosing = false;
    }, 500);
}

async function openAddModal() {
    if (isModalClosing) return;
    const online = await isOnline();
    if (!online) {
        showNativePopup('オフライン中は課題の追加ができません。');
        return;
    }
    if (!currentClass) {
        showNativePopup('先にクラスを設定してください。');
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
    if (isModalClosing) return;
    const task = currentTasks.find(t => t.課題id === id);
    if (!task) return;

    document.getElementById('detail-subject').innerText = task.教科 || "不明";
    document.getElementById('detail-title').innerText = task.課題名 || "無題の課題";
    document.getElementById('detail-desc').innerText = task.詳細 || "詳細なし";
    document.getElementById('detail-deadline').innerText = "期限: " + formatDateTime(task.期限);
    document.getElementById('detail-delete-btn').onclick = () => confirmDelete(id);
    document.getElementById('detail-modal').style.display = 'flex';
}

// 課題の追加送信
async function submitTask() {
    const subject = document.getElementById('add-subject').value.trim();
    const title = document.getElementById('add-title').value.trim();
    const detail = document.getElementById('add-detail').value.trim();
    const deadlineRaw = document.getElementById('add-deadline').value;

    const online = await isOnline();
    if (!online) {
        showNativePopup('オフライン中は課題の追加ができません。');
        return;
    }

    if (!subject || !title || !deadlineRaw) {
        showNativePopup('科目名、課題名、期限は必須です。');
        return;
    }
    
    if (!userName) {
        showNativePopup('ユーザー情報が消えています。再設定してください。');
        init();
        return;
    }

    // Java側の WorkData に適合するJSON構造
    const taskData = {
        subject: subject,
        title: title,
        description: detail,
        date: deadlineRaw, // YYYY-MM-DD または YYYY-MM-DDTHH:mm
        createBy: userName
    };

    try {
        closeModals();
        const statusMsg = document.getElementById('status-msg');
        statusMsg.style.display = 'block';
        statusMsg.innerText = "追加処理中...";
        
        await apiAddTask(currentClass, taskData);
        loadTasks();
    } catch (e) {
        showNativePopup("通信エラー: " + e.message);
        document.getElementById('status-msg').style.display = 'none';
    }
}

// 課題の削除確認
async function confirmDelete(id) {
    const online = await isOnline();
    if (!online) {
        showNativePopup('オフライン中は課題の削除ができません。');
        return;
    }

    showNativePopup('本当にこの課題を削除しますか？', {
        type: 'confirm',
        confirmText: '削除する',
        cancelText: 'キャンセル',
        onConfirm: async () => {
            closeModals();
            try {
                document.getElementById('status-msg').style.display = 'block';
                document.getElementById('status-msg').innerText = '削除処理中...';
                
                const ok = await apiDeleteTask(currentClass, id);
                if (ok) {
                    loadTasks();
                } else {
                    showNativePopup('削除に失敗しました');
                    document.getElementById('status-msg').style.display = 'none';
                }
            } catch (e) {
                showNativePopup('通信エラー: ' + e.message);
                document.getElementById('status-msg').style.display = 'none';
            }
        }
    });
}

function formatDateTime(isoString) {
    if (!isoString) return "--/-- --:--";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return String(isoString);
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function refreshTasks() {
    const icon = document.querySelector('.refresh-icon');
    icon.classList.add('spinning');
    try {
        await loadTasks();
    } finally {
        setTimeout(() => {
            icon.classList.remove('spinning');
        }, 500);
    }
}

const handleOutsideClick = (event) => {
    const detailModal = document.getElementById('detail-modal');
    const addModal = document.getElementById('add-modal');

    if (event.target === detailModal || event.target === addModal) {
        closeModals();
    }
};

window.addEventListener('click', handleOutsideClick);
window.addEventListener('touchstart', handleOutsideClick, { passive: true });
window.addEventListener('DOMContentLoaded', init);
