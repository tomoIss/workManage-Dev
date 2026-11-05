// js/calendar.js
import { escapeHtml } from './utils.js';

let currentYearMonth = new Date(); // 表示対象の年月
let selectedDateStr = null;        // タップされた日 (YYYY-MM-DD)

export function renderCalendar(container, tasks, onSelectTask) {
    container.innerHTML = '';
    const year = currentYearMonth.getFullYear();
    const month = currentYearMonth.getMonth(); // 0-indexed

    // 日付ごとの課題マッピングを作る { "2026-11-05": [task, task], ... }
    const taskMap = {};
    tasks.forEach(task => {
        if (!task.期限) return;
        // YYYY-MM-DD 形式でキーを作る
        const dateKey = task.期限.substring(0, 10);
        if (!taskMap[dateKey]) taskMap[dateKey] = [];
        taskMap[dateKey].push(task);
    });

    const card = document.createElement('div');
    card.className = 'calendar-card';

    // ヘッダー (前月 / 年月表示 / 翌月)
    const header = document.createElement('div');
    header.className = 'calendar-header';
    header.innerHTML = `
        <button id="cal-prev">&lt;</button>
        <h3>${year}年 ${month + 1}月</h3>
        <button id="cal-next">&gt;</button>
    `;
    card.appendChild(header);

    // カレンダーグリッド
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    // 曜日ヘッダー
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    days.forEach(d => {
        const dEl = document.createElement('div');
        dEl.className = 'calendar-day-header';
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
        const hasTasks = taskMap[dateStr] && taskMap[dateStr].length > 0;

        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        if (dateStr === todayStr) dayEl.classList.add('today');
        if (dateStr === selectedDateStr) dayEl.classList.add('selected');

        dayEl.innerHTML = `<span>${date}</span>${hasTasks ? '<div class="task-dot"></div>' : ''}`;
        
        dayEl.onclick = () => {
            selectedDateStr = dateStr;
            renderCalendar(container, tasks, onSelectTask);
        };
        grid.appendChild(dayEl);
    }
    card.appendChild(grid);

    // タップされた日付の課題一覧エリア
    if (selectedDateStr) {
        const dayTasks = taskMap[selectedDateStr] || [];
        const taskListArea = document.createElement('div');
        taskListArea.className = 'selected-day-tasks';
        taskListArea.innerHTML = `<h4>${selectedDateStr} 締切の課題 (${dayTasks.length}件)</h4>`;

        if (dayTasks.length === 0) {
            taskListArea.innerHTML += `<p style="font-size: 0.8rem; color: #bbb;">この日が期限の課題はありません</p>`;
        } else {
            dayTasks.forEach(task => {
                const item = document.createElement('div');
                item.className = 'calendar-task-item';
                item.innerHTML = `
                    <span><strong>[${escapeHtml(task.教科)}]</strong> ${escapeHtml(task.課題名)}</span>
                    <small>${task.期限.includes('T') ? task.期限.substring(11, 16) : ''}</small>
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