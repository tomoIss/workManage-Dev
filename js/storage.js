// js/storage.js

const KEY_CLASS = 'dev_currentClass';
const KEY_TASKS_PREFIX = 'dev_cachedTasks_';
const USER_NAME = 'dev_userName';
const KEY_DONE_PREFIX = 'dev_doneTasks_';

export function normalizeTask(task) {
    if (!task) return null;
    return {
        課題id: task.id ?? task["id "] ?? task.課題id,
        className: task.className,
        教科: task.subject ?? task.教科,
        課題名: task.title ?? task.課題名,
        詳細: task.description ?? task.詳細,
        期限: task.date ?? task.期限,
        作成日時: task.createAt ?? task.作成日時,
        追加者: task.createBy ?? task.追加者
    };
}

export function getTaskFingerprint(task) {
    const deadline = task.期限 ? new Date(task.期限).getTime() : 'no-deadline';
    return `${task.課題id}-${task.教科}-${task.課題名}-${deadline}`;
}

// ユーザー・クラス設定
export const getStoredClass = () => localStorage.getItem(KEY_CLASS) || '';
export const setStoredClass = (cls) => localStorage.setItem(KEY_CLASS, cls);
export const getStoredUser = () => localStorage.getItem(USER_NAME) || '';
export const setStoredUser = (name) => localStorage.setItem(USER_NAME, name);

// タスクキャッシュ
export function loadCachedTasks(className) {
    try {
        const raw = localStorage.getItem(KEY_TASKS_PREFIX + className);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveCachedTasks(className, tasks) {
    try {
        localStorage.setItem(KEY_TASKS_PREFIX + className, JSON.stringify(tasks));
    } catch (e) {
        console.warn('キャッシュ保存失敗', e);
    }
}

// 完了タスク管理
export function getDoneTasks(className) {
    if (!className) return [];
    return JSON.parse(localStorage.getItem(KEY_DONE_PREFIX + className) || '[]');
}

export function saveDoneTasks(className, doneList) {
    localStorage.setItem(KEY_DONE_PREFIX + className, JSON.stringify(doneList));
}