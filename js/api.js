const GAS_URL = "https://script.google.com/macros/s/AKfycbzPmSdad-DIkjoBhha1VfRWU7jDHpQOdVBFsvD5Wmqtwx_0Lc8qTgc3gtxpb1LiaPX2/exec";

/**
 * クラス一覧を取得する
 */
async function apiGetClassList() {
    // キャッシュを回避するためにタイムスタンプを付与
    const cacheBuster = `&t=${Date.now()}`;
    const res = await fetch(`${GAS_URL}?action=getClassList${cacheBuster}`, {
        method: "GET",
        mode: "cors", // クロスドメイン通信を明示
        redirect: "follow" // GASのリダイレクトを確実に追いかける
    });
    return await res.json();
}

/**
 * 指定したクラスの課題一覧を取得する
 */
async function apiGetTasks(className) {
    const cacheBuster = `&t=${Date.now()}`;
    const response = await fetch(`${GAS_URL}?className=${encodeURIComponent(className)}${cacheBuster}`, {
        method: "GET",
        mode: "cors",
        redirect: "follow"
    });
    if (!response.ok) throw new Error("ネットワークエラー");
    return await response.json();
}

/**
 * 課題を追加する
 */
async function apiAddTask(payload) {
    const res = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    return await res.json();
}

/**
 * 課題を削除する
 */
async function apiDeleteTask(payload) {
    const res = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    return await res.json();
}
