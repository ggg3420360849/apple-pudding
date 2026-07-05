"use strict";

/** Centralized HTTP boundary for the browser application. */
(function registerApiClient(global) {
    class ApiError extends Error {
        constructor(message, status, payload) {
            super(message);
            this.name = "ApiError";
            this.status = status;
            this.payload = payload;
        }
    }

    async function request(path, options = {}) {
        const response = await global.fetch(path, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });

        let payload;
        try {
            payload = await response.json();
        } catch {
            throw new ApiError(`服务返回了无效数据（HTTP ${response.status}）`, response.status);
        }

        if (!response.ok) {
            throw new ApiError(payload.detail || payload.error || `请求失败（HTTP ${response.status}）`, response.status, payload);
        }
        return payload;
    }

    function authorizedRequest(path, token, options = {}) {
        return request(path, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(options.headers || {})
            }
        });
    }

    const api = {
        chat(input) {
            return request("/api/animal/chat", {
                method: "POST",
                body: JSON.stringify(input)
            });
        },
        syncChildProgress(input, token) {
            return authorizedRequest("/api/family/child-progress/sync", token, {
                method: "POST",
                body: JSON.stringify(input)
            });
        },
        validateChildSession(childId, token) {
            return authorizedRequest(`/api/family/child-session/${encodeURIComponent(childId)}`, token, {
                method: "GET"
            });
        },
        getChildProfile(accountId, childId, token) {
            return authorizedRequest(`/api/family/accounts/${encodeURIComponent(accountId)}/children/${encodeURIComponent(childId)}`, token, {
                method: "GET"
            });
        },
        refreshChildEntryCode(accountId, childId, token) {
            return authorizedRequest(`/api/family/accounts/${encodeURIComponent(accountId)}/children/${encodeURIComponent(childId)}/entry-code`, token, {
                method: "POST",
                body: JSON.stringify({})
            });
        }
    };

    global.BlueAnimal = global.BlueAnimal || {};
    global.BlueAnimal.api = Object.freeze(api);
    global.BlueAnimal.ApiError = ApiError;
})(window);
