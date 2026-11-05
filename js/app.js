// js/app.js
import { escapeHtml, isOnline, formatDateTime, getRemainingTime, getSchoolYearCode } from './utils.js';
import * as Storage from './storage.js';
import * as Modal from './modal.js';

let currentClass = Storage.getStoredClass();
let userName = Storage.getStoredUser();
let currentTasks = [];
let existingClasses = [];

// --- 完了状態トグル・クリーンアップ ---
function cleanupDoneTasks(latestTasks) {
    if (!currentClass) return;
    const doneList = Storage.getDoneTasks(currentClass);
    if (doneList.length === 0) return;

    const validFingerprints = latestTasks.map(Storage.getTaskFingerprint);
    const cleaned = doneList.filter(fp => validFingerprints.includes(fp));
    Storage.saveDoneTasks(currentClass, cleaned);
}

function toggleTaskStatus(event, taskId) {
    event.stopPropagation();
    const task = currentTasks.find(t => t.課題id == taskId);
    if (!task || !currentClass) return;

    const fp = Storage.getTaskFingerprint(task);
    let doneList = Storage.getDoneTasks(currentClass);

    doneList = doneList.includes(fp) ? doneList.filter(f => f !== fp) : [...doneList, fp];
    Storage.saveDoneTasks(currentClass, doneList);
    renderTasks(currentTasks);
}

// --- 画面描画 ---
function updateHeader() {
    const headerEl = document.getElementById('header-class-name');
    if (headerEl) {
        headerEl.innerHTML = `${escapeHtml(currentClass || '未設定')}<br>課題リストDev`;
    }
}

function renderTasks(tasks) {
    const container = document.getElementById('task-list');
    container.innerHTML = '';
    const doneList = Storage.getDoneTasks(currentClass);
    
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
        const isDone = doneList.includes(Storage.getTaskFingerprint(task));
        const remaining = getRemainingTime(task.期限);
    
        const card = document.createElement('div');
        card.className = 'task-card';
        card.onclick = () => openDetailModal(task.課題id);

        card.innerHTML = `
            <button class="status-toggle-btn ${isDone ? 'is-done' : ''}" 
                    onclick="toggleTaskStatus(event, '${escapeHtml(task.課題id)}')">
                ${isDone ? '完了' : '未完了'}
            </button>
            <div class="subject">${escapeHtml(task.教科 || "不明")}</div>
            <div class="title">${escapeHtml(task.課題名 || "無題の課題")}</div>
            <div class="detail-badge">${escapeHtml(task.詳細 || "==詳細なし==")}</div>
            <div class="task-footer">
                <div class="time-left ${remaining.isUrgent ? 'urgent' : ''}">${escapeHtml(remaining.text)}</div>
                <div class="deadline">${escapeHtml(formatDateTime(task.期限))}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- APIデータ連携 ---
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
    const cachedTasks = Storage.loadCachedTasks(currentClass);
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
            const rawTasks = result?.works || result?.data?.works || result?.work || result?.tasks || [];
            currentTasks = rawTasks.map(Storage.normalizeTask).filter(Boolean);

            Storage.saveCachedTasks(currentClass, currentTasks);
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
            statusMsg.innerHTML = `データ取得に失敗しました。前回のキャッシュを表示します。<br><small>${escapeHtml(error.message)}</small>`;
            renderTasks(cachedTasks);
        } else {
            statusMsg.innerHTML = `取得に失敗しました。<br><small>${escapeHtml(error.message)}</small>`;
        }
    }
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
        currentTasks = Storage.loadCachedTasks(currentClass);
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

// --- クラス選択・作成 ---
async function fetchClassListOnly() {
    try {
        const res = await apiGetClassList();
        const list = res?.classes || res?.data?.classes || res?.data || [];
        existingClasses = list.map(item => typeof item === 'object' && item !== null ? (item.className || item.id) : item);
        return existingClasses;
    } catch (e) {
        console.error("クラスリスト取得失敗", e);
        return existingClasses;
    }
}

function updateClassSelectionButtons() {
    const btnContainer = document.getElementById('class-list-buttons');
    btnContainer.innerHTML = '';
    if (existingClasses.length > 0) {
        existingClasses.forEach(cls => {
            const clsStr = String(cls).trim();
            if (!clsStr) return;
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

async function showClassSelection(canCancel = true) {
    const ui = document.getElementById('class-selection-ui');
    const loading = document.getElementById('loading-ui');
    const container = document.getElementById('class-selection-container');
    const cancelBtn = document.getElementById('close-selection-btn');

    ui.style.display = 'flex';
    loading.style.display = 'flex';
    container.style.display = 'none';
    cancelBtn.style.display = canCancel ? 'inline-block' : 'none';

    const online = await isOnline();
    if (!online) {
        document.getElementById('class-list-buttons').innerHTML = '<div style="color: #ff6b6b; padding: 20px;">オフラインのためクラス変更できません。</div>';
        loading.style.display = 'none';
        container.style.display = 'block';
        Modal.showNativePopup('オフライン中はクラス変更できません。');
        return;
    }

    if (existingClasses.length > 0) updateClassSelectionButtons();

    fetchClassListOnly()
        .then(() => updateClassSelectionButtons())
        .finally(() => {
            loading.style.display = 'none';
            container.style.display = 'block';
        });
}

function selectClass(cls) {
    if (!cls) return;
    currentClass = cls;
    Storage.setStoredClass(currentClass);
    document.getElementById('class-selection-ui').style.display = 'none';
    updateHeader();
    loadTasks();
}

async function createNewClass() {
    const online = await isOnline();
    if (!online) {
        Modal.showNativePopup('オフライン中は新規クラスを作成できません。');
        return;
    }
    const grade = document.getElementById('new-class-grade').value;
    const clsNum = document.getElementById('new-class-class').value;
    const school = document.getElementById('new-class-school').value;
    const normalized = `${grade}-${clsNum}${school}${getSchoolYearCode()}`;

    try {
        const isExisting = existingClasses.some(cls => String(cls).trim().toLowerCase() === normalized.toLowerCase());
        if (isExisting) {
            Modal.showNativePopup(`既存のクラス「${normalized}」が見つかりました。接続します。`);
        } else {
            await apiCreateClass(normalized);
            Modal.showNativePopup(`新規クラス「${normalized}」を作成しました。`);
        }
        selectClass(normalized);
    } catch (e) {
        Modal.showNativePopup("クラス登録エラー: " + e.message);
    }
}

// --- 詳細・追加操作 ---
function openDetailModal(id) {
    if (Modal.isModalClosing()) return;
    const task = currentTasks.find(t => t.課題id === id);
    if (!task) return;

    document.getElementById('detail-subject').innerText = task.教科 || "不明";
    document.getElementById('detail-title').innerText = task.課題名 || "無題の課題";
    document.getElementById('detail-desc').innerText = task.詳細 || "詳細なし";
    document.getElementById('detail-deadline').innerText = "期限: " + formatDateTime(task.期限);
    document.getElementById('detail-delete-btn').onclick = () => confirmDelete(id);
    document.getElementById('detail-modal').style.display = 'flex';
}

async function openAddModal() {
    if (Modal.isModalClosing()) return;
    const online = await isOnline();
    if (!online) {
        Modal.showNativePopup('オフライン中は課題の追加ができません。');
        return;
    }
    if (!currentClass) {
        Modal.showNativePopup('先にクラスを設定してください。');
        showClassSelection(true);
        return;
    }
    document.getElementById('add-subject').value = '';
    document.getElementById('add-title').value = '';
    document.getElementById('add-detail').value = '';
    document.getElementById('add-deadline').value = '';
    document.getElementById('add-modal').style.display = 'flex';
}

async function submitTask() {
    const subject = document.getElementById('add-subject').value.trim();
    const title = document.getElementById('add-title').value.trim();
    const detail = document.getElementById('add-detail').value.trim();
    const deadlineRaw = document.getElementById('add-deadline').value;

    const online = await isOnline();
    if (!online) {
        Modal.showNativePopup('オフライン中は課題の追加ができません。');
        return;
    }
    if (!subject || !title || !deadlineRaw) {
        Modal.showNativePopup('科目名、課題名、期限は必須です。');
        return;
    }
    if (!userName) {
        Modal.showNativePopup('ユーザー情報が消えています。再設定してください。');
        init();
        return;
    }

    try {
        Modal.closeModals();
        const statusMsg = document.getElementById('status-msg');
        statusMsg.style.display = 'block';
        statusMsg.innerText = "追加処理中...";

        await apiAddTask(currentClass, {
            subject, title, description: detail, date: deadlineRaw, createBy: userName
        });
        loadTasks();
    } catch (e) {
        Modal.showNativePopup("通信エラー: " + e.message);
        document.getElementById('status-msg').style.display = 'none';
    }
}

async function confirmDelete(id) {
    const online = await isOnline();
    if (!online) {
        Modal.showNativePopup('オフライン中は課題の削除ができません。');
        return;
    }
    Modal.showNativePopup('本当にこの課題を削除しますか？', {
        type: 'confirm',
        confirmText: '削除する',
        cancelText: 'キャンセル',
        onConfirm: async () => {
            Modal.closeModals();
            try {
                const statusMsg = document.getElementById('status-msg');
                statusMsg.style.display = 'block';
                statusMsg.innerText = '削除処理中...';
                const ok = await apiDeleteTask(currentClass, id);
                if (ok) {
                    loadTasks();
                } else {
                    Modal.showNativePopup('削除に失敗しました');
                    statusMsg.style.display = 'none';
                }
            } catch (e) {
                Modal.showNativePopup('通信エラー: ' + e.message);
                document.getElementById('status-msg').style.display = 'none';
            }
        }
    });
}

function submitInitialUsername() {
    const grade = document.getElementById('init-grade').value;
    const cls = document.getElementById('init-class').value;
    const attendanceNo = document.getElementById('init-attendance').value;
    const school = document.getElementById('init-school').value;

    userName = grade + cls + attendanceNo + school;
    Storage.setStoredUser(userName);
    document.getElementById('username-init-modal').style.display = 'none';
    init();
}

async function refreshTasks() {
    const icon = document.querySelector('.refresh-icon');
    if (icon) icon.classList.add('spinning');
    try {
        await loadTasks();
    } finally {
        setTimeout(() => { if (icon) icon.classList.remove('spinning'); }, 500);
    }
}

// ==========================================
// HTML の onclick 属性から呼べるよう window に登録
// ==========================================
window.promptClassChange = () => showClassSelection(true);
window.closeClassSelection = () => document.getElementById('class-selection-ui').style.display = 'none';
window.createNewClass = createNewClass;
window.submitInitialUsername = submitInitialUsername;
window.openAddModal = openAddModal;
window.closeModals = Modal.closeModals;
window.submitTask = submitTask;
window.refreshTasks = refreshTasks;
window.toggleTaskStatus = toggleTaskStatus;

// リスナー登録
window.addEventListener('click', (event) => {
    const detailModal = document.getElementById('detail-modal');
    const addModal = document.getElementById('add-modal');
    if (event.target === detailModal || event.target === addModal) {
        Modal.closeModals();
    }
});

window.addEventListener('DOMContentLoaded', init);