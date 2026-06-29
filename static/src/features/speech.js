function toggleVoiceInput(button) {
    // 优先检查 Chrome 浏览器
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    // 检查浏览器兼容性
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast("您的浏览器不支持语音识别。\n请使用 Google Chrome 浏览器以获得最佳体验。\n其他支持的浏览器：Edge、Safari");
        return;
    }

    // 检查是否在安全上下文（HTTPS或localhost）
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        showToast('语音识别需要HTTPS协议，请使用https://访问或在本地测试');
        return;
    }

    if (isRecording) {
        stopVoiceInput();
    } else {
        startVoiceInput(button);
    }
}

function startVoiceInput(button) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    // 检测浏览器类型以优化配置
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);

    // 检查是否已经有实例在运行
    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            // 忽略停止错误
        }
        recognition = null;
    }

    recognition = new SpeechRecognition();

    // 优化的语音识别配置 - 优先为 Chrome 优化，其他浏览器兼容
    recognition.lang = 'zh-CN';

    if (useSimpleMode) {
        // 简化模式：适用于网络受限或非 Chrome 浏览器
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
    } else if (isChrome || isEdge) {
        // Chrome/Edge 标准模式：连续识别，最佳体验
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
    } else {
        // 其他浏览器：保守配置
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
    }

    const voiceStatus = document.getElementById('voiceStatus');
    const voiceIcon = document.getElementById('voiceIcon');
    const storyPrompt = document.getElementById('storyPrompt');
    const voiceButton = button || document.getElementById('voiceInputBtn');

    if (!voiceStatus || !voiceIcon || !storyPrompt || !voiceButton) {
        showToast('页面元素加载异常，请刷新页面');
        return;
    }

    // 清空文本框，准备接收语音输入
    if (storyPrompt.value === '今天想知道什么故事呀？试试点击话筒说出来...' ||
        storyPrompt.value.trim() === '') {
        storyPrompt.value = '';
    }

    voiceButton.classList.add('recording');
    voiceIcon.textContent = '🎙️';
    voiceStatus.style.display = 'block';
    document.getElementById('voiceStatusText').textContent = '正在聆听...开始说话吧';
    isRecording = true;
    restartAttempts = 0;

    finalTranscript = '';
    interimTranscript = '';

    // 清除之前的超时定时器
    if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
        recognitionTimeout = null;
    }

    recognition.onstart = () => {
        isRecording = true;
        restartAttempts = 0;

        voiceButton.classList.add('recording');
        voiceIcon.textContent = '🎙️';
        voiceStatus.style.display = 'block';
        document.getElementById('voiceStatusText').textContent = '正在聆听...';
    };

    recognition.onresult = (event) => {
        // 重置超时定时器
        if (recognitionTimeout) {
            clearTimeout(recognitionTimeout);
        }

        // 重新构建完整的识别文本
        let newFinalTranscript = '';
        let newInterimTranscript = '';

        // 遍历所有结果
        for (let i = 0; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;

            if (event.results[i].isFinal) {
                newFinalTranscript += transcript;
            } else {
                newInterimTranscript += transcript;
            }
        }

        // 更新全局变量
        finalTranscript = newFinalTranscript;
        interimTranscript = newInterimTranscript;

        // 实时更新文本框 - 组合最终结果和临时结果
        const displayText = finalTranscript + (interimTranscript ? interimTranscript : '');

        if (displayText.trim()) {
            storyPrompt.value = displayText;
            const statusText = interimTranscript ?
                `正在识别: ${interimTranscript}` :
                `已识别 ${finalTranscript.length} 字`;
            document.getElementById('voiceStatusText').textContent = statusText;
        }

        // 设置新的超时定时器（6秒无新输入自动停止）
        recognitionTimeout = setTimeout(() => {
            if (isRecording && finalTranscript.trim()) {
                stopVoiceInput(true);
            }
        }, 6000);
    };

    recognition.onspeechstart = () => {
        document.getElementById('voiceStatusText').textContent = '正在识别中...';
    };

    recognition.onerror = (event) => {
        // 清除超时定时器
        if (recognitionTimeout) {
            clearTimeout(recognitionTimeout);
            recognitionTimeout = null;
        }

        if (event.error === 'no-speech') {
            if (restartAttempts < MAX_RESTART_ATTEMPTS) {
                restartAttempts++;
                // 不显示错误提示，自动重启
                if (isRecording) {
                    setTimeout(() => {
                        try {
                            recognition.start();
                        } catch (e) {
                            showToast('没有听到声音，请靠近麦克风说话');
                            stopVoiceInput();
                        }
                    }, 100);
                }
                return;
            } else {
                showToast('没有检测到声音，请检查麦克风并靠近说话');
            }
        } else if (event.error === 'network') {
            // 第一次网络错误：切换到简化模式重试
            if (!useSimpleMode && restartAttempts < 2) {
                useSimpleMode = true;
                restartAttempts++;

                if (isRecording) {
                    setTimeout(() => {
                        try {
                            stopVoiceInput();
                            showToast('切换到简化模式，请再次点击话筒并说话');
                        } catch (e) {
                            stopVoiceInput();
                        }
                    }, 500);
                }
                return;
            }

            // 简化模式也失败：给出详细建议
            const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
            if (!isChrome) {
                showToast('网络错误。建议使用 Google Chrome 浏览器获得最佳体验。\n当前浏览器的语音识别功能可能受限。');
            } else {
                showToast('网络问题导致无法识别。解决方法：\n1. 检查网络连接是否稳定\n2. 如开启VPN建议暂时关闭\n3. 刷新页面后重试');
            }
        } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
            showToast('请在浏览器设置中允许使用麦克风：点击地址栏左侧图标→网站设置→麦克风→允许');
        } else if (event.error === 'aborted') {
            // 主动停止，不提示错误
            return;
        } else if (event.error === 'audio-capture') {
            showToast('无法访问麦克风，请检查：\n1. 麦克风是否被其他应用占用\n2. 浏览器是否有麦克风权限\n建议使用 Chrome 浏览器');
        } else if (event.error === 'service-not-allowed') {
            showToast('语音服务不可用。\n强烈建议使用 Google Chrome 浏览器以获得最佳体验。\nChrome 对语音识别的支持最完善。');
        } else {
            showToast(`识别出错(${event.error})。\n建议使用 Google Chrome 浏览器获得最佳体验。`);
        }
        stopVoiceInput();
    };

    recognition.onend = () => {
        // 简化模式下：单次识别完成后立即显示结果
        if (useSimpleMode && finalTranscript.trim()) {
            stopVoiceInput(true);
            return;
        }

        // 标准模式：自动重启保持连续识别
        if (isRecording && !useSimpleMode && restartAttempts < MAX_RESTART_ATTEMPTS) {
            // 如果还在录音状态且未达到重试上限，自动重启
            try {
                setTimeout(() => {
                    if (isRecording) {
                        recognition.start();
                    }
                }, 100);
            } catch (e) {
                stopVoiceInput();
            }
        } else if (!isRecording) {
            // 已经手动停止，清理状态
            stopVoiceInput();
        }
    };

    try {
        recognition.start();
    } catch (error) {
        showToast('无法启动语音识别，请检查麦克风权限');
        stopVoiceInput();
    }
}

function stopVoiceInput(autoStop = false) {
    // 清除超时定时器
    if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
        recognitionTimeout = null;
    }

    isRecording = false;

    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            // 忽略停止错误
        }
        recognition = null;
    }

    const voiceStatus = document.getElementById('voiceStatus');
    const voiceIcon = document.getElementById('voiceIcon');
    const button = document.getElementById('voiceInputBtn');
    const storyPrompt = document.getElementById('storyPrompt');

    if (button) button.classList.remove('recording');
    if (voiceIcon) voiceIcon.textContent = '🎤';
    if (voiceStatus) voiceStatus.style.display = 'none';

    // 处理识别结果
    if (finalTranscript && storyPrompt) {
        const text = finalTranscript.trim();
        if (text) {
            storyPrompt.value = text;
        }
    } else if (!autoStop && !finalTranscript) {
        // 恢复默认文案
        if (storyPrompt && !storyPrompt.value.trim()) {
            storyPrompt.placeholder = '今天想知道什么故事呀？试试点击话筒说出来...';
        }
    }

    finalTranscript = '';
    interimTranscript = '';
    restartAttempts = 0;
}

// QA问答的语音输入功能
let recognitionQa = null;
let isRecordingQa = false;
let finalTranscriptQa = '';
let interimTranscriptQa = '';
let recognitionTimeoutQa = null;
let restartAttemptsQa = 0;
let useSimpleModeQa = false;

function toggleVoiceInputQa(button) {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast("您的浏览器不支持语音识别。\n请使用 Google Chrome 浏览器以获得最佳体验。\n其他支持的浏览器：Edge、Safari");
        return;
    }

    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        showToast('语音识别需要HTTPS协议，请使用https://访问或在本地测试');
        return;
    }

    if (isRecordingQa) {
        stopVoiceInputQa();
    } else {
        startVoiceInputQa(button);
    }
}

function startVoiceInputQa(button) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);

    if (recognitionQa) {
        try {
            recognitionQa.stop();
        } catch (e) {
            // 忽略停止错误
        }
        recognitionQa = null;
    }

    recognitionQa = new SpeechRecognition();
    recognitionQa.lang = 'zh-CN';

    if (useSimpleModeQa) {
        recognitionQa.continuous = false;
        recognitionQa.interimResults = false;
        recognitionQa.maxAlternatives = 1;
    } else if (isChrome || isEdge) {
        recognitionQa.continuous = true;
        recognitionQa.interimResults = true;
        recognitionQa.maxAlternatives = 1;
    } else {
        recognitionQa.continuous = true;
        recognitionQa.interimResults = true;
        recognitionQa.maxAlternatives = 1;
    }

    const voiceStatus = document.getElementById('voiceStatusQa');
    const voiceIcon = document.getElementById('voiceIconQa');
    const qaQuestion = document.getElementById('qaQuestion');
    const voiceButton = button || document.getElementById('voiceInputBtnQa');

    if (!voiceStatus || !voiceIcon || !qaQuestion || !voiceButton) {
        showToast('页面元素加载异常，请刷新页面');
        return;
    }

    if (qaQuestion.value === '想问什么问题呢？试试点击话筒说出来...' ||
        qaQuestion.value.trim() === '') {
        qaQuestion.value = '';
    }

    voiceButton.classList.add('recording');
    voiceIcon.textContent = '🎙️';
    voiceStatus.style.display = 'block';
    document.getElementById('voiceStatusTextQa').textContent = '正在聆听...开始说话吧';
    isRecordingQa = true;
    restartAttemptsQa = 0;

    finalTranscriptQa = '';
    interimTranscriptQa = '';

    if (recognitionTimeoutQa) {
        clearTimeout(recognitionTimeoutQa);
        recognitionTimeoutQa = null;
    }

    recognitionQa.onstart = () => {
        isRecordingQa = true;
        restartAttemptsQa = 0;
        voiceButton.classList.add('recording');
        voiceIcon.textContent = '🎙️';
        voiceStatus.style.display = 'block';
        document.getElementById('voiceStatusTextQa').textContent = '正在聆听...';
    };

    recognitionQa.onresult = (event) => {
        if (recognitionTimeoutQa) {
            clearTimeout(recognitionTimeoutQa);
        }

        let newFinalTranscript = '';
        let newInterimTranscript = '';

        for (let i = 0; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                newFinalTranscript += transcript;
            } else {
                newInterimTranscript += transcript;
            }
        }

        finalTranscriptQa = newFinalTranscript;
        interimTranscriptQa = newInterimTranscript;

        const displayText = finalTranscriptQa + (interimTranscriptQa ? interimTranscriptQa : '');

        if (displayText.trim()) {
            qaQuestion.value = displayText;
            const statusText = interimTranscriptQa ?
                `正在识别: ${interimTranscriptQa}` :
                `已识别 ${finalTranscriptQa.length} 字`;
            document.getElementById('voiceStatusTextQa').textContent = statusText;
        }

        recognitionTimeoutQa = setTimeout(() => {
            if (isRecordingQa && finalTranscriptQa.trim()) {
                stopVoiceInputQa(true);
            }
        }, 6000);
    };

    recognitionQa.onspeechstart = () => {
        document.getElementById('voiceStatusTextQa').textContent = '正在识别中...';
    };

    recognitionQa.onerror = (event) => {
        if (recognitionTimeoutQa) {
            clearTimeout(recognitionTimeoutQa);
            recognitionTimeoutQa = null;
        }

        if (event.error === 'no-speech') {
            if (restartAttemptsQa < MAX_RESTART_ATTEMPTS) {
                restartAttemptsQa++;
                if (isRecordingQa) {
                    setTimeout(() => {
                        try {
                            recognitionQa.start();
                        } catch (e) {
                            showToast('没有听到声音，请靠近麦克风说话');
                            stopVoiceInputQa();
                        }
                    }, 100);
                }
                return;
            } else {
                showToast('没有检测到声音，请检查麦克风并靠近说话');
            }
        } else if (event.error === 'network') {
            if (!useSimpleModeQa && restartAttemptsQa < 2) {
                useSimpleModeQa = true;
                restartAttemptsQa++;
                if (isRecordingQa) {
                    setTimeout(() => {
                        try {
                            stopVoiceInputQa();
                            showToast('切换到简化模式，请再次点击话筒并说话');
                        } catch (e) {
                            stopVoiceInputQa();
                        }
                    }, 500);
                }
                return;
            }
            showToast('网络错误。建议使用 Google Chrome 浏览器获得最佳体验。\n当前浏览器的语音识别功能可能受限。');
        } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
            showToast('麦克风权限被拒绝，请在浏览器设置中允许使用麦克风');
        } else if (event.error === 'aborted') {
            // 主动停止，不提示错误
        } else if (event.error === 'audio-capture') {
            showToast('无法访问麦克风，请检查设备连接');
        } else if (event.error === 'service-not-allowed') {
            showToast('浏览器不允许使用语音识别服务');
        } else {
            showToast(`识别出错(${event.error})。\n建议使用 Google Chrome 浏览器获得最佳体验。`);
        }

        stopVoiceInputQa();
    };

    recognitionQa.onend = () => {
        if (useSimpleModeQa && finalTranscriptQa.trim()) {
            stopVoiceInputQa(true);
            return;
        }

        if (isRecordingQa && !useSimpleModeQa && restartAttemptsQa < MAX_RESTART_ATTEMPTS) {
            try {
                setTimeout(() => {
                    if (isRecordingQa) {
                        recognitionQa.start();
                    }
                }, 100);
            } catch (e) {
                stopVoiceInputQa();
            }
        } else if (!isRecordingQa) {
            stopVoiceInputQa();
        }
    };

    try {
        recognitionQa.start();
    } catch (error) {
        showToast('无法启动语音识别，请检查麦克风权限');
        stopVoiceInputQa();
    }
}

function stopVoiceInputQa(autoStop = false) {
    if (recognitionTimeoutQa) {
        clearTimeout(recognitionTimeoutQa);
        recognitionTimeoutQa = null;
    }

    isRecordingQa = false;

    if (recognitionQa) {
        try {
            recognitionQa.stop();
        } catch (e) {
            // 忽略停止错误
        }
        recognitionQa = null;
    }

    const voiceStatus = document.getElementById('voiceStatusQa');
    const voiceIcon = document.getElementById('voiceIconQa');
    const button = document.getElementById('voiceInputBtnQa');
    const qaQuestion = document.getElementById('qaQuestion');

    if (button) button.classList.remove('recording');
    if (voiceIcon) voiceIcon.textContent = '🎤';
    if (voiceStatus) voiceStatus.style.display = 'none';

    if (finalTranscriptQa && qaQuestion) {
        const text = finalTranscriptQa.trim();
        if (text) {
            qaQuestion.value = text;
        }
    } else if (!autoStop && !finalTranscriptQa) {
        if (qaQuestion && !qaQuestion.value.trim()) {
            qaQuestion.placeholder = '想问什么问题呢？试试点击话筒说出来...';
        }
    }

    finalTranscriptQa = '';
    interimTranscriptQa = '';
    restartAttemptsQa = 0;
}

// Voice input for doctor consultation
function toggleVoiceInputDoctor(button) {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast("您的浏览器不支持语音识别。\n请使用 Google Chrome 浏览器以获得最佳体验。");
        return;
    }

    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        showToast('语音识别需要HTTPS协议，请使用https://访问或在本地测试');
        return;
    }

    if (isRecordingDoctor) {
        stopVoiceInputDoctor();
    } else {
        startVoiceInputDoctor(button);
    }
}

let recognitionDoctor = null;
let isRecordingDoctor = false;
let finalTranscriptDoctor = '';
let interimTranscriptDoctor = '';
let recognitionTimeoutDoctor = null;
let restartAttemptsDoctor = 0;
let useSimpleModeDoctor = false;

function startVoiceInputDoctor(button) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

    if (recognitionDoctor) {
        try {
            recognitionDoctor.stop();
        } catch (e) {}
        recognitionDoctor = null;
    }

    recognitionDoctor = new SpeechRecognition();
    recognitionDoctor.lang = 'zh-CN';
    recognitionDoctor.continuous = true;
    recognitionDoctor.interimResults = true;
    recognitionDoctor.maxAlternatives = 1;

    const voiceStatus = document.getElementById('voiceStatusDoctor');
    const voiceIcon = document.getElementById('voiceIconDoctor');
    const doctorQuestion = document.getElementById('doctorQuestion');
    const voiceButton = button || document.getElementById('voiceInputBtnDoctor');

    if (!voiceStatus || !voiceIcon || !doctorQuestion || !voiceButton) {
        showToast('页面元素加载异常，请刷新页面');
        return;
    }

    if (doctorQuestion.value.trim() === '' || doctorQuestion.value === doctorQuestion.placeholder) {
        doctorQuestion.value = '';
    }

    voiceButton.classList.add('recording');
    voiceIcon.textContent = '🎙️';
    voiceStatus.style.display = 'block';
    document.getElementById('voiceStatusTextDoctor').textContent = '正在聆听...';
    isRecordingDoctor = true;
    restartAttemptsDoctor = 0;
    finalTranscriptDoctor = '';
    interimTranscriptDoctor = '';

    if (recognitionTimeoutDoctor) {
        clearTimeout(recognitionTimeoutDoctor);
        recognitionTimeoutDoctor = null;
    }

    recognitionDoctor.onstart = () => {
        isRecordingDoctor = true;
        voiceButton.classList.add('recording');
        voiceIcon.textContent = '🎙️';
        voiceStatus.style.display = 'block';
    };

    recognitionDoctor.onresult = (event) => {
        if (recognitionTimeoutDoctor) {
            clearTimeout(recognitionTimeoutDoctor);
        }

        let newFinalTranscript = '';
        let newInterimTranscript = '';

        for (let i = 0; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                newFinalTranscript += transcript;
            } else {
                newInterimTranscript += transcript;
            }
        }

        finalTranscriptDoctor = newFinalTranscript;
        interimTranscriptDoctor = newInterimTranscript;

        const displayText = finalTranscriptDoctor + (interimTranscriptDoctor ? interimTranscriptDoctor : '');
        if (displayText.trim()) {
            doctorQuestion.value = displayText;
            document.getElementById('voiceStatusTextDoctor').textContent =
                interimTranscriptDoctor ? `正在识别: ${interimTranscriptDoctor}` : `已识别 ${finalTranscriptDoctor.length} 字`;
        }

        recognitionTimeoutDoctor = setTimeout(() => {
            if (isRecordingDoctor && finalTranscriptDoctor.trim()) {
                stopVoiceInputDoctor(true);
            }
        }, 6000);
    };

    recognitionDoctor.onerror = (event) => {
        if (recognitionTimeoutDoctor) {
            clearTimeout(recognitionTimeoutDoctor);
            recognitionTimeoutDoctor = null;
        }
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
            showToast(`语音识别出错: ${event.error}`);
        }
        stopVoiceInputDoctor();
    };

    recognitionDoctor.onend = () => {
        if (isRecordingDoctor && restartAttemptsDoctor < 3) {
            try {
                setTimeout(() => {
                    if (isRecordingDoctor) {
                        recognitionDoctor.start();
                    }
                }, 100);
            } catch (e) {
                stopVoiceInputDoctor();
            }
        } else if (!isRecordingDoctor) {
            stopVoiceInputDoctor();
        }
    };

    try {
        recognitionDoctor.start();
    } catch (error) {
        showToast('无法启动语音识别，请检查麦克风权限');
        stopVoiceInputDoctor();
    }
}

function stopVoiceInputDoctor(autoStop = false) {
    if (recognitionTimeoutDoctor) {
        clearTimeout(recognitionTimeoutDoctor);
        recognitionTimeoutDoctor = null;
    }

    isRecordingDoctor = false;

    if (recognitionDoctor) {
        try {
            recognitionDoctor.stop();
        } catch (e) {}
        recognitionDoctor = null;
    }

    const voiceStatus = document.getElementById('voiceStatusDoctor');
    const voiceIcon = document.getElementById('voiceIconDoctor');
    const button = document.getElementById('voiceInputBtnDoctor');
    const doctorQuestion = document.getElementById('doctorQuestion');

    if (button) button.classList.remove('recording');
    if (voiceIcon) voiceIcon.textContent = '🎤';
    if (voiceStatus) voiceStatus.style.display = 'none';

    if (finalTranscriptDoctor && doctorQuestion) {
        const text = finalTranscriptDoctor.trim();
        if (text) {
            doctorQuestion.value = text;
        }
    }

    finalTranscriptDoctor = '';
    interimTranscriptDoctor = '';
    restartAttemptsDoctor = 0;
}

// Doctor consultation handler
async function handleAskDoctorConsultation() {
    const animal = getAnimal();
    const doctorQuestion = document.getElementById('doctorQuestion');
    if (!doctorQuestion) return;

    const question = doctorQuestion.value.trim();
    if (!question) {
        showToast("请输入问题");
        return;
    }

    const answerDiv = document.getElementById('doctorAnswer');
    if (answerDiv) answerDiv.textContent = "医生正在分析...";

    try {
        const data = await BlueAnimal.chat.ask({
            mode: "doctor",
            message: question,
            animal: animal.name,
            model: state.model
        });
        const reply = data.reply || "医生暂时无法回答。";

        state.doctorLogs.unshift({
            animalId: animal.id,
            symptom: question,
            detail: question,
            reply: reply,
            source: data.model ? `模型：${data.model}` : "AI医生",
            time: Date.now()
        });

        state.progress.treatments = (state.progress.treatments || 0) + 1;
        state.progress.activities.push({
            type: "doctor",
            animal: animal.id,
            time: Date.now(),
            detail: `咨询了${animal.name}的健康问题`
        });

        saveState();
        render();
    } catch (error) {
        console.error("AI医生咨询失败:", error);
        const isNetworkError = error instanceof TypeError;
        const message = isNetworkError
            ? "无法连接到服务，请确认后端已启动"
            : (error.message || "问诊失败，请重试");
        if (answerDiv) answerDiv.textContent = message;
        showToast(message);
    }
}

// Read doctor answer aloud
function readDoctorAnswer() {
    const answerDiv = document.getElementById('doctorAnswer');
    if (!answerDiv) return;

    const text = answerDiv.textContent.trim();
    if (!text || text === "医生的诊断建议会显示在这里。") {
        showToast("暂无内容可以朗读");
        return;
    }

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();

        const cleanText = cleanTextForReading(text);
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.85;
        utterance.pitch = 1.05;
        utterance.volume = 0.95;

        // 优先选择更自然的中文女声
        const voices = window.speechSynthesis.getVoices();
        const preferredVoices = [
            'Microsoft Yunxi Online (Natural) - Chinese (Mainland)',
            'Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)',
            'Microsoft Yaoyao - Chinese (Mainland)',
            'Xiaoxiao',
            'Yaoyao',
            'Tingting'
        ];

        let selectedVoice = null;
        for (const preferred of preferredVoices) {
            selectedVoice = voices.find(v => v.name.includes(preferred));
            if (selectedVoice) break;
        }

        if (!selectedVoice) {
            selectedVoice = voices.find(v =>
                v.lang.includes('zh') &&
                (v.name.includes('Female') || v.name.includes('female'))
            );
        }

        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.includes('zh'));
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        window.speechSynthesis.speak(utterance);
    } else {
        showToast("您的浏览器不支持语音朗读");
    }
}

// Read QA answer aloud
function readQaAnswer() {
    const answerDiv = document.getElementById('qaAnswer');
    const iconSpan = document.getElementById('readQaIcon');

    if (!answerDiv) return;

    const text = answerDiv.textContent.trim();
    if (!text) {
        showToast("暂无内容可以朗读");
        return;
    }

    if ('speechSynthesis' in window) {
        // 如果正在播放，则停止
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            if (iconSpan) iconSpan.textContent = '🔊';
            return;
        }

        // 开始播放
        if (iconSpan) iconSpan.textContent = '⏸️';

        const cleanText = cleanTextForReading(text);
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.85;
        utterance.pitch = 1.05;
        utterance.volume = 0.95;

        // 优先选择更自然的中文女声
        const voices = window.speechSynthesis.getVoices();
        const preferredVoices = [
            'Microsoft Yunxi Online (Natural) - Chinese (Mainland)',
            'Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)',
            'Microsoft Yaoyao - Chinese (Mainland)',
            'Xiaoxiao',
            'Yaoyao',
            'Tingting'
        ];

        let selectedVoice = null;
        for (const preferred of preferredVoices) {
            selectedVoice = voices.find(v => v.name.includes(preferred));
            if (selectedVoice) break;
        }

        // 如果没找到偏好的，选择任何包含zh且为女声的
        if (!selectedVoice) {
            selectedVoice = voices.find(v =>
                v.lang.includes('zh') &&
                (v.name.includes('Female') || v.name.includes('female'))
            );
        }

        // 最后fallback到任何中文声音
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.includes('zh'));
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.onend = () => {
            if (iconSpan) iconSpan.textContent = '🔊';
        };

        utterance.onerror = () => {
            if (iconSpan) iconSpan.textContent = '🔊';
        };

        window.speechSynthesis.speak(utterance);
    } else {
        showToast("您的浏览器不支持语音朗读");
    }
}
