"use strict";

/**
 * Browser persistence adapter.
 *
 * Feature code should not know how JSON is serialized or which Web Storage
 * implementation is used. Keeping that detail here also gives tests one seam
 * to replace when the application gets a test runner.
 */
(function registerBrowserStorage(global) {
    function readJson(storage, key, fallback = null) {
        const value = storage.getItem(key);
        if (value === null) return fallback;
        return JSON.parse(value);
    }

    function writeJson(storage, key, value) {
        storage.setItem(key, JSON.stringify(value));
    }

    const browserStorage = {
        persistent: {
            read: (key, fallback) => readJson(global.localStorage, key, fallback),
            write: (key, value) => writeJson(global.localStorage, key, value),
            remove: (key) => global.localStorage.removeItem(key)
        },
        session: {
            read: (key, fallback = null) => global.sessionStorage.getItem(key) ?? fallback,
            write: (key, value) => global.sessionStorage.setItem(key, value),
            remove: (key) => global.sessionStorage.removeItem(key)
        },
        sizeOf(value) {
            return new Blob([JSON.stringify(value)]).size;
        }
    };

    global.BlueAnimal = global.BlueAnimal || {};
    global.BlueAnimal.storage = Object.freeze(browserStorage);
})(window);
