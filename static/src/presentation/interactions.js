function showToast(text) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = text;
    toast.classList.remove("hide");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.add("hide"), 2200);
}

function showLockedAnimalHint(button) {
    const bubble = button.querySelector(".unlock-bubble");
    document.querySelectorAll(".unlock-bubble.show").forEach((item) => {
        if (item !== bubble) {
            item.classList.remove("show");
            item.closest(".marker")?.classList.remove("hint-open");
        }
    });

    button.classList.remove("is-shaking");
    void button.offsetWidth;
    button.classList.add("is-shaking", "hint-open");
    bubble?.classList.add("show");

    window.clearTimeout(button.unlockHintTimer);
    button.unlockHintTimer = window.setTimeout(() => {
        button.classList.remove("is-shaking", "hint-open");
        bubble?.classList.remove("show");
    }, 3000);
}

document.addEventListener("click", async (event) => {
    if (state.profile && state.settingsOpen && !event.target.closest(".settings-menu") && !event.target.closest("[data-action='toggle-settings']")) {
        state.settingsOpen = false;
        render();
        return;
    }

    const sessionButton = event.target.closest("[data-session-id]");
    if (sessionButton) {
        switchSession(sessionButton.dataset.sessionId);
        return;
    }

    const routeButton = event.target.closest("[data-route]");
    if (routeButton && state.profile) {
        setRoute(routeButton.dataset.route);
        return;
    }

    const lockedAnimalButton = event.target.closest("[data-locked-animal]");
    if (lockedAnimalButton && state.profile) {
        showLockedAnimalHint(lockedAnimalButton);
        return;
    }

    const animalButton = event.target.closest("[data-animal]");
    if (animalButton && state.profile) {
        selectAnimal(animalButton.dataset.animal);
        return;
    }

    const fillQuestion = event.target.closest("[data-fill-question]");
    if (fillQuestion) {
        const input = document.getElementById("qaQuestion");
        if (input) input.value = fillQuestion.dataset.fillQuestion;
        return;
    }

    const quizChoice = event.target.closest("[data-quiz-choice]");
    if (quizChoice) {
        await handleQuiz(Number(quizChoice.dataset.quizChoice));
        return;
    }

    const bodyButton = event.target.closest("[data-creature-body]");
    if (bodyButton) {
        updateCreatureDraft();
        applyCreaturePart("body", bodyButton.dataset.creatureBody);
        return;
    }

    const wingButton = event.target.closest("[data-creature-wing]");
    if (wingButton) {
        updateCreatureDraft();
        applyCreaturePart("wing", wingButton.dataset.creatureWing);
        return;
    }

    const tailButton = event.target.closest("[data-creature-tail]");
    if (tailButton) {
        updateCreatureDraft();
        applyCreaturePart("tail", tailButton.dataset.creatureTail);
        return;
    }

    const partButton = event.target.closest("[data-creature-part]");
    if (partButton) {
        updateCreatureDraft();
        if (!Array.isArray(state.draftCreature.parts)) state.draftCreature.parts = [];
        const part = partButton.dataset.creaturePart;
        if (state.draftCreature.parts.includes(part)) {
            state.draftCreature.parts = state.draftCreature.parts.filter((item) => item !== part);
            state.draftCreature.selectedPart = "body";
        } else {
            state.draftCreature.parts.push(part);
            state.draftCreature.selectedPart = part;
        }
        saveState();
        renderImagineWithoutJump();
        return;
    }

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;

    if (action === "toggle-settings") {
        state.settingsOpen = !state.settingsOpen;
        render();
        return;
    }
    if (action === "logout") {
        logoutCurrentSession();
        return;
    }
    if (action === "reset-quiz") {
        moveToNextAnimalQuiz(getAnimal());
        saveState();
        render();
        return;
    }
    if (action === "ask-qa") await handleAskQa();
    if (action === "refresh-quick-question") await handleRefreshQuickQuestion();
    if (action === "fill-quick-question") handleFillQuickQuestion();
    if (action === "ask-doctor") await handleAskDoctor();
    if (action === "reset-part-transform") resetCreaturePartTransform();
    if (action === "select-animal") {
        const animalId = event.target.closest("[data-animal-id]")?.dataset.animalId;
        if (animalId) {
            const animal = animals.find(a => a.id === animalId);
            state.selectedAnimal = animalId;
            state.qaStage = 'loading';
            // 更新当前备用问题
            state.currentQuickQuestion = {
                animalId: animalId,
                question: animal.quick?.[0] || `${animal.name}有什么特别的地方？`,
                isGenerating: false
            };
            state.lastQuiz = null;
            saveState();
            render();
            // Simulate loading animation for 2.5 seconds
            setTimeout(() => {
                state.qaStage = 'care';
                saveState();
                render();
            }, 2500);
        }
        return;
    }
    if (action === "change-animal") {
        state.qaStage = 'selection';
        saveState();
        render();
        return;
    }
    if (action === "toggle-animal-state") {
        const animalId = state.selectedAnimal || state.selectedAnimalId;
        if (animalId) {
            toggleAnimalState(animalId);
        }
        return;
    }
    if (action === "open-doctor") {
        state.qaStage = 'doctor';
        saveState();
        render();
        return;
    }
    if (action === "close-doctor") {
        state.qaStage = 'care';
        saveState();
        render();
        return;
    }
    if (action === "ask-doctor-consultation") await handleAskDoctorConsultation();
    if (action === "toggle-voice-input-doctor") toggleVoiceInputDoctor(event.target.closest("button"));
    if (action === "read-doctor-answer") readDoctorAnswer();
    if (action === "read-qa-answer") readQaAnswer();
    if (action === "save-nickname") {
        const input = document.getElementById('animalNickname');
        if (input) {
            const nickname = input.value.trim();
            const animal = getAnimal();
            if (nickname && nickname !== animal.name) {
                state.animalNicknames[animal.id] = nickname;
                saveState();
                showToast(`已将${animal.name}改名为 ${nickname}`);
            } else if (!nickname) {
                delete state.animalNicknames[animal.id];
                saveState();
                showToast(`已恢复为 ${animal.name}`);
            }
            render();
        }
        return;
    }
    if (action === "save-creature") saveCreature();
    if (action === "random-creature") randomCreature();
    if (action === "clear-creature-parts") clearCreatureParts();
    if (action === "make-story") await makeStory();
    if (action === "continue-story") await continueStory();
    if (action === "read-story") readStory();
    if (action === "toggle-favorite") toggleFavorite();
    if (action === "toggle-voice-input") toggleVoiceInput(event.target.closest("button"));
    if (action === "toggle-voice-input-qa") toggleVoiceInputQa(event.target.closest("button"));
    if (action === "export-data") exportData();
    if (action === "print-report") window.print();
    if (action === "reset-progress") resetProgress();
});

document.addEventListener("dragstart", (event) => {
    const partButton = event.target.closest("[data-creature-part-type]");
    if (!partButton) return;
    event.dataTransfer.setData("text/plain", JSON.stringify({
        type: partButton.dataset.creaturePartType,
        id: partButton.dataset.creaturePartId
    }));
    event.dataTransfer.effectAllowed = "copy";
});

document.addEventListener("dragover", (event) => {
    const dropZone = event.target.closest("[data-creature-drop-zone]");
    if (!dropZone) return;
    event.preventDefault();
    dropZone.classList.add("drag-over");
    event.dataTransfer.dropEffect = "copy";
});

document.addEventListener("dragleave", (event) => {
    const dropZone = event.target.closest("[data-creature-drop-zone]");
    if (dropZone && !dropZone.contains(event.relatedTarget)) {
        dropZone.classList.remove("drag-over");
    }
});

document.addEventListener("drop", (event) => {
    const dropZone = event.target.closest("[data-creature-drop-zone]");
    if (!dropZone) return;
    event.preventDefault();
    dropZone.classList.remove("drag-over");
    try {
        const part = JSON.parse(event.dataTransfer.getData("text/plain"));
        updateCreatureDraft();
        applyCreaturePart(part.type, part.id);
    } catch (error) {
        showToast("这个素材暂时放不上去");
    }
});

document.addEventListener("submit", (event) => {
    if (event.target.id !== "loginForm") return;
    event.preventDefault();
    const name = document.getElementById("childName").value.trim() || "小探险家";
    const age = Number(document.getElementById("childAge").value || 6);
    const role = state.pendingRole || "child";
    createSession({ name, age, role, createdAt: Date.now() });
    render();
});

document.addEventListener("change", (event) => {
    if (["qaModel", "doctorModel", "storyModel"].includes(event.target.id)) {
        state.model = event.target.value;
        saveState();
    }
});

document.addEventListener("pointerdown", (event) => {
    const asset = event.target.closest("[data-edit-part]");
    if (!asset) return;
    const part = asset.dataset.editPart;
    state.draftCreature.selectedPart = part;
    const transform = creatureTransform(part);
    creaturePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    draggedCreaturePart = {
        part,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: transform.x,
        originY: transform.y
    };
    if (creaturePointers.size === 2) beginCreatureGesture(part);
    asset.setPointerCapture?.(event.pointerId);
    document.querySelectorAll(".selected-part").forEach((item) => item.classList.remove("selected-part"));
    asset.classList.add("selected-part");
    event.preventDefault();
});

document.addEventListener("pointermove", (event) => {
    if (!creaturePointers.has(event.pointerId)) return;
    creaturePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (creatureGesture && creaturePointers.size >= 2) {
        updateCreatureGesture();
        event.preventDefault();
        return;
    }

    if (!draggedCreaturePart || event.pointerId !== draggedCreaturePart.pointerId || draggedCreaturePart.part === "body") return;
    const transform = creatureTransform(draggedCreaturePart.part);
    transform.x = Math.max(-120, Math.min(120, Math.round(draggedCreaturePart.originX + event.clientX - draggedCreaturePart.startX)));
    transform.y = Math.max(-100, Math.min(100, Math.round(draggedCreaturePart.originY + event.clientY - draggedCreaturePart.startY)));
    applyCreatureTransformToStage(draggedCreaturePart.part);
    event.preventDefault();
});

document.addEventListener("pointerup", finishCreaturePartDrag);
document.addEventListener("pointercancel", finishCreaturePartDrag);

document.addEventListener("wheel", (event) => {
    const asset = event.target.closest("[data-edit-part]");
    if (!asset) return;
    const part = asset.dataset.editPart;
    const transform = creatureTransform(part);
    state.draftCreature.selectedPart = part;

    if (event.shiftKey && part !== "body") {
        transform.rotation = Math.max(-180, Math.min(180, transform.rotation + (event.deltaY > 0 ? 6 : -6)));
    } else {
        transform.scale = Math.max(40, Math.min(180, transform.scale + (event.deltaY > 0 ? -5 : 5)));
    }
    applyCreatureTransformToStage(part);
    saveState();
    event.preventDefault();
}, { passive: false });
