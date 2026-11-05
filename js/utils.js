// js/utils.js

export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export async function isOnline() {
    if (!navigator.onLine) return false;
    try {
        const response = await fetch('./icon/icon-192.jpg', { method: 'HEAD', cache: 'no-cache', signal: AbortSignal.timeout(3000) });
        return response.ok;
    } catch {
        return navigator.onLine;
    }
}

export function formatDateTime(isoString) {
    if (!isoString) return "--/-- --:--";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return String(isoString);
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function getRemainingTime(isoString) {
    if (!isoString) return { text: '', isUrgent: false };
    const deadline = new Date(isoString);
    if (isNaN(deadline.getTime())) return { text: '', isUrgent: false };

    const now = new Date();
    const diffMs = deadline - now;
    if (diffMs <= 0) return { text: '期限切れ', isUrgent: true };

    const totalMinutes = Math.ceil(diffMs / (1000 * 60));
    if (totalMinutes < 60 * 24) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return { text: `残り ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, isUrgent: true };
    } else {
        return { text: `残り ${Math.floor(totalMinutes / (60 * 24))}日`, isUrgent: false };
    }
}

export function getSchoolYearCode() {
    const now = new Date();
    let year = now.getFullYear();
    const month = now.getMonth() + 1;
    if (month >= 1 && month <= 3) year -= 1;
    return `R${year - 2018}`;
}