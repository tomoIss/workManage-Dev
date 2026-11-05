// js/modal.js

let isClosing = false;

export function showNativePopup(message, options = {}) {
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
            if (options.onCancel) options.onCancel();
        };

        const confirmBtn = document.createElement('button');
        confirmBtn.innerText = options.confirmText || 'OK';
        confirmBtn.onclick = () => {
            closeNativePopup();
            if (options.onConfirm) options.onConfirm();
        };

        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);
    } else {
        const okBtn = document.createElement('button');
        okBtn.innerText = options.okText || '閉じる';
        okBtn.onclick = () => {
            closeNativePopup();
            if (options.onClose) options.onClose();
        };
        actions.appendChild(okBtn);
    }
}

export function closeNativePopup() {
    document.getElementById('native-popup').classList.remove('active');
}

export function closeModals() {
    document.getElementById('add-modal').style.display = 'none';
    document.getElementById('detail-modal').style.display = 'none';
    isClosing = true;
    setTimeout(() => { isClosing = false; }, 500);
}

export function isModalClosing() {
    return isClosing;
}