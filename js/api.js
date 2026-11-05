const API_URL = "https://workmanagebackend.25tomo.f5.si";

/**
 * リトライ付きfetch関数
 */
async function fetchWithRetry(url, options, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            throw new Error(`HTTP ${response.status}`);
        } catch (error) {
            if (i === retries - 1) throw error;
            const delay = Math.random() * 2000 + 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * 1. クラス一覧を取得する
 * 戻り値: {"status": "SUCCESS", "data": [...]}
 */
async function apiGetClassList() {
    const cacheBuster = `?t=${Date.now()}`;
    const res = await fetchWithRetry(`${API_URL}/classList${cacheBuster}`, {
        method: "GET",
        mode: "cors"
    });
    return await res.json();
}

/**
 * 2. 指定したクラスの課題一覧を取得する
 * 戻り値: {"status": "SUCCESS", "data": [...]}
 */
async function apiGetTasks(className) {
    const cacheBuster = `?t=${Date.now()}`;
    const url = `${API_URL}/work/${encodeURIComponent(className)}${cacheBuster}`;
    const res = await fetchWithRetry(url, {
        method: "GET",
        mode: "cors"
    });
    return await res.json();
}

/**
 * クラスを新規登録する (POST /classList)
 * @param {string} className - クラス名 (例: "1-1issR8")
 */
async function apiCreateClass(className) {
    const res = await fetchWithRetry(`${API_URL}/classList`, {
        method: "POST",
        mode: "cors",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            className: className
        })
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}`);
    }

    return await res.json();
}

/**
 * 3. 課題を追加する
 * @param {string} className - クラス名 (例: "1-1issR1")
 * @param {object} payload - { subject, title, description, date, createBy }
 * 戻り値: 追加された課題データ
 */
async function apiAddTask(className, payload) {
    const url = `${API_URL}/work/${encodeURIComponent(className)}`;
    const res = await fetchWithRetry(url, {
        method: "POST",
        mode: "cors",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
    return await res.json();
}

/**
 * 4. 課題を削除する
 * @param {string} className - クラス名
 * @param {number|string} id - 課題のID (例: 1)
 * 戻り値: boolean (成功なら true)
 */
async function apiDeleteTask(className, id) {
    const url = `${API_URL}/work/${encodeURIComponent(className)}/${encodeURIComponent(id)}`;
    const res = await fetchWithRetry(url, {
        method: "DELETE",
        mode: "cors"
    });
    // 204 No Content のため、json() は呼ばず成功(true)を返す
    return res.ok;
}
