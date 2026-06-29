(function registerAuthenticatedFetch(global) {
    global.authFetch = async function authFetch(input, init = {}) {
        const token = global.localStorage.getItem("parentToken");
        const headers = new Headers(init.headers || {});
        if (token) headers.set("Authorization", `Bearer ${token}`);
        const response = await global.fetch(input, { ...init, headers });
        if (response.status === 401 && token) {
            global.localStorage.removeItem("parentToken");
            global.localStorage.removeItem("parentAccount");
        }
        return response;
    };
})(window);
