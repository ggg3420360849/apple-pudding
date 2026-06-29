"use strict";

/**
 * Use-case facade for every AI conversation in the product.
 * Feature modules depend on this service instead of transport details.
 */
(function registerAnimalChatService(global) {
    async function ask({ mode, message, animal, model }) {
        const result = await global.BlueAnimal.api.chat({ mode, message, animal, model });
        if (!result.success) {
            throw new Error(result.error || "AI 服务暂时不可用");
        }
        return {
            reply: result.reply || "",
            model: result.model || model
        };
    }

    global.BlueAnimal.chat = Object.freeze({ ask });
})(window);
