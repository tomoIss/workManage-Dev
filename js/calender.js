// js/calendar.js

// 外部依存をなくすため、エスケープ関数を内蔵
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

let currentYearMonth = new Date(); // 表示対象の年月
let selectedDateStr = null;        // タップされた日 (YYYY-MM-DD)

export function renderCalendar(container, tasks, onSelectTask) {
    if (!container) return;
    container.innerHTML = '';

    const year = currentYearMonth.getFullYear();
    const month = currentYearMonth.getMonth(); // 0-indexed

    // 日付ごとの課題マッピングを作る { "2026-11-05": [task, ...], ... }
    const taskMap = {};
    (tasks || []).forEach(task => {
        if (!task.期限) return;
        const dateKey = task.期限.substring(0, 10);
        if (!taskMap[dateKey]) taskMap[dateKey] = [];
        taskMap[dateKey].push(task);
    });

    const card = document.createElement('div');
    card.className = 'calendar-card';

    // 1. ヘッダー (前月 / 年月表示 / 翌月)
    const header = document.createElement('div');
    header.className = 'calendar-header';
    header.innerHTML = `
        <button id="cal-prev" type="button">&lt; 前月</button>
        <h3>${year}年 ${month + 1}月</h3>
        <button id="cal-next" type="button">翌月 &gt;</button>
    `;
    card.appendChild(header);

    // 2. カレンダーグリッド
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    // 曜日ヘッダー
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    days.forEach((d, idx) => {
        const dEl = document.createElement('div');
        dEl.className = 'calendar-day-header';
        if (idx === 0) dEl.style.color = '#ff6b6b';
        if (idx === 6) dEl.style.color = '#4dadf7';
        dEl.innerText = d;
        grid.appendChild(dEl);
    });

    // 日付の計算
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 先頭の空欄
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        grid.appendChild(empty);
    }

    // 日付セル
    for (let date = 1; date <= lastDate; date++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
        const dayTasks = taskMap[dateStr] || [];

        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        if (dateStr === todayStr) dayEl.classList.add('today');
        if (dateStr === selectedDateStr) dayEl.classList.add('selected');

        dayEl.innerHTML = `
            <span>${date}</span>
            ${dayTasks.length > 0 ? `<div class="task-dot"></div>` : ''}
        `;
        
        dayEl.onclick = () => {
            selectedDateStr = (selectedDateStr === dateStr) ? null : dateStr;
            renderCalendar(container, tasks, onSelectTask);
        };
        grid.appendChild(dayEl);
    }
    card.appendChild(grid);

    // 3. タップされた日付の課題一覧エリア
    if (selectedDateStr) {
        const dayTasks = taskMap[selectedDateStr] || [];
        const taskListArea = document.createElement('div');
        taskListArea.className = 'selected-day-tasks';
        taskListArea.innerHTML = `<h4>📅 ${selectedDateStr} 締切の課題 (${dayTasks.length}件)</h4>`;

        if (dayTasks.length === 0) {
            taskListArea.innerHTML += `<p style="font-size: 0.85rem; color: #ccc; margin: 5px 0;">この日が期限の課題はありません</p>`;
        } else {
            dayTasks.forEach(task => {
                const item = document.createElement('div');
                item.className = 'calendar-task-item';
                item.innerHTML = `
                    <span><strong>[${escapeHtml(task.教科)}]</strong> ${escapeHtml(task.課題名)}</span>
                    <small style="color: #f6c343;">${task.期限.includes('T') ? task.期限.substring(11, 16) : ''}</small>
                `;
                item.onclick = () => onSelectTask(task.課題id);
                taskListArea.appendChild(item);
            });
        }
        card.appendChild(taskListArea);
    }

    container.appendChild(card);

    // 前月・翌月ボタンのリスナー
    card.querySelector('#cal-prev').onclick = () => {
        currentYearMonth.setMonth(currentYearMonth.getMonth() - 1);
        renderCalendar(container, tasks, onSelectTask);
    };
    card.querySelector('#cal-next').onclick = () => {
        currentYearMonth.setMonth(currentYearMonth.getMonth() + 1);
        renderCalendar(container, tasks, onSelectTask);
    };
}