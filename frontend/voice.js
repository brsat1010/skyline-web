// ============================================================
//  WEBRTC ГОЛОСОВАЯ СВЯЗЬ
// ============================================================

const STUN_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
};

let voiceState = {
    ws: null,
    pc: null,
    localStream: null,
    remoteStream: null,
    roomId: null,
    userId: null,
    isMuted: false,
    connected: false,
    peerUserId: null,
    audioContext: null,
    analyser: null,
    dataArray: null,
};

// ==== НАЧАЛО ====
async function joinVoice(roomId, userId) {
    if (voiceState.connected) {
        console.log("[VOICE] Уже в войсе");
        return;
    }

    console.log(`[VOICE] Подключаюсь к комнате ${roomId}`);

    voiceState.roomId = roomId;
    voiceState.userId = userId;

    try {
        // 1. Запрашиваем микрофон
        voiceState.localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
            video: false,
        });
        console.log("[VOICE] Микрофон получен");

        // 2. Создаём WebSocket для сигналинга
        const proto = location.protocol === "https:" ? "wss" : "ws";
        const wsUrl = `${proto}://${location.host}/voice/${roomId}/${userId}`;
        voiceState.ws = new WebSocket(wsUrl);

        voiceState.ws.onopen = () => {
            console.log("[VOICE] WebSocket подключён");
            voiceState.connected = true;
            updateVoiceUI();
        };

        voiceState.ws.onmessage = async (event) => {
            const msg = JSON.parse(event.data);
            await handleVoiceMessage(msg);
        };

        voiceState.ws.onclose = () => {
            console.log("[VOICE] WebSocket закрыт");
            leaveVoice();
        };

        voiceState.ws.onerror = (e) => {
            console.error("[VOICE] WS error", e);
            toast("Ошибка подключения к войсу", "error");
        };

    } catch (e) {
        console.error("[VOICE]", e);
        if (e.name === "NotAllowedError") {
            toast("Нет доступа к микрофону", "error");
        } else {
            toast("Ошибка войса: " + e.message, "error");
        }
        leaveVoice();
    }
}

// ==== КОНЕЦ ====
function leaveVoice() {
    if (voiceState.pc) {
        voiceState.pc.close();
        voiceState.pc = null;
    }
    if (voiceState.localStream) {
        voiceState.localStream.getTracks().forEach(t => t.stop());
        voiceState.localStream = null;
    }
    if (voiceState.ws) {
        voiceState.ws.close();
        voiceState.ws = null;
    }
    if (voiceState.audioContext) {
        voiceState.audioContext.close();
        voiceState.audioContext = null;
    }

    voiceState.connected = false;
    voiceState.remoteStream = null;
    voiceState.peerUserId = null;
    voiceState.roomId = null;
    voiceState.isMuted = false;
    voiceState.analyser = null;

    updateVoiceUI();
    console.log("[VOICE] Отключён");
}

// ==== СОЗДАНИЕ PEER CONNECTION ====
function createPeerConnection() {
    const pc = new RTCPeerConnection(STUN_SERVERS);

    // Добавляем локальные треки
    voiceState.localStream.getTracks().forEach(track => {
        pc.addTrack(track, voiceState.localStream);
    });

    // Обработка входящего аудио
    pc.ontrack = (event) => {
        console.log("[VOICE] Получен удалённый трек");
        voiceState.remoteStream = event.streams[0];

        // Воспроизводим через Audio элемент
        let audio = document.getElementById("remote-audio");
        if (!audio) {
            audio = document.createElement("audio");
            audio.id = "remote-audio";
            audio.autoplay = true;
            document.body.appendChild(audio);
        }
        audio.srcObject = voiceState.remoteStream;
        audio.play().catch(e => console.error("[VOICE] Play error", e));
    };

    // ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate && voiceState.ws && voiceState.ws.readyState === 1) {
            voiceState.ws.send(JSON.stringify({
                type: "ice",
                candidate: event.candidate,
            }));
        }
    };

    pc.onconnectionstatechange = () => {
        console.log("[VOICE] Connection state:", pc.connectionState);
        if (pc.connectionState === "connected") {
            toast("🎙️ Голосовая связь установлена", "success");
        } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            toast("Связь потеряна", "error");
            leaveVoice();
        }
    };

    return pc;
}

// ==== ОБРАБОТКА СООБЩЕНИЙ ====
async function handleVoiceMessage(msg) {
    switch (msg.type) {
        case "peer_joined":
            console.log("[VOICE] Пришёл peer:", msg.user_id);
            voiceState.peerUserId = msg.user_id;
            updateVoiceUI();

            // Мы создаём offer (мы — инициатор)
            voiceState.pc = createPeerConnection();
            const offer = await voiceState.pc.createOffer();
            await voiceState.pc.setLocalDescription(offer);
            voiceState.ws.send(JSON.stringify({
                type: "offer",
                sdp: offer,
            }));
            break;

        case "offer":
            console.log("[VOICE] Получен offer");
            voiceState.peerUserId = msg.from;

            if (!voiceState.pc) {
                voiceState.pc = createPeerConnection();
            }
            await voiceState.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            const answer = await voiceState.pc.createAnswer();
            await voiceState.pc.setLocalDescription(answer);
            voiceState.ws.send(JSON.stringify({
                type: "answer",
                sdp: answer,
            }));
            break;

        case "answer":
            console.log("[VOICE] Получен answer");
            if (voiceState.pc) {
                await voiceState.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            }
            break;

        case "ice":
            console.log("[VOICE] Получен ICE");
            if (voiceState.pc && msg.candidate) {
                try {
                    await voiceState.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                } catch (e) {
                    console.error("[VOICE] ICE error", e);
                }
            }
            break;

        case "peer_left":
            console.log("[VOICE] Peer вышел");
            voiceState.peerUserId = null;
            if (voiceState.pc) {
                voiceState.pc.close();
                voiceState.pc = null;
            }
            updateVoiceUI();
            break;

        case "speaking":
            // Индикатор что собеседник говорит
            updateSpeakingIndicator(msg.from, msg.speaking);
            break;

        case "mute":
            updateMuteIndicator(msg.from, msg.muted);
            break;
    }
}

// ==== MUTE ====
function toggleMute() {
    if (!voiceState.localStream) return;
    const audioTrack = voiceState.localStream.getAudioTracks()[0];
    if (!audioTrack) return;

    voiceState.isMuted = !voiceState.isMuted;
    audioTrack.enabled = !voiceState.isMuted;

    if (voiceState.ws && voiceState.ws.readyState === 1) {
        voiceState.ws.send(JSON.stringify({
            type: "mute",
            muted: voiceState.isMuted,
        }));
    }

    updateVoiceUI();
    toast(voiceState.isMuted ? "🔇 Микрофон выключен" : "🎙️ Микрофон включён", "info");
}

// ==== UI ====
function updateVoiceUI() {
    const container = document.getElementById("voice-panel");
    if (!container) return;

    if (!voiceState.connected) {
        container.innerHTML = "";
        container.style.display = "none";
        return;
    }

    container.style.display = "block";

    const peerName = voiceState.peerUserId ? `Участник ${voiceState.peerUserId.slice(-4)}` : "Ожидание собеседника";

    container.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#16a34a);display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 0 15px rgba(34,197,94,0.6);animation:notif-pulse 2s infinite;">
                    🎙️
                </div>
                <div>
                    <div style="font-weight:600;color:var(--text-main);">Голосовой эфир</div>
                    <div style="font-size:12px;color:var(--text-dim);">${peerName}</div>
                </div>
            </div>
            <div style="display:flex;gap:8px;margin-left:auto;">
                <button onclick="toggleMute()" class="voice-btn ${voiceState.isMuted ? 'muted' : ''}" title="Mute">
                    ${voiceState.isMuted ? '🔇' : '🎙️'}
                </button>
                <button onclick="leaveVoice()" class="voice-btn leave" title="Выйти">
                    📞
                </button>
            </div>
        </div>
    `;
}

function updateSpeakingIndicator(userId, speaking) {
    // Пока просто подсветка (можно расширить)
}

function updateMuteIndicator(userId, muted) {
    // Пока просто
}

// ==== АВТОПОДКЛЮЧЕНИЕ ====
// Следим за liveData: если у нас есть активный рейс с войсом — подключаемся
function checkVoiceAutoJoin() {
    if (!currentUser) return;
    if (voiceState.connected) return;

    // Ищем свой рейс
    const myFlight = Object.values(liveData.flights || {}).find(
        f => String(f.pilot_id) === String(currentUser.id)
    );

    if (!myFlight) return;

    // Если статус radio/airborne и есть voice_channel_id — подключаемся
    if (myFlight.status === "radio" && myFlight.voice_channel_id) {
        console.log("[VOICE] Автоподключение");
        joinVoice(
            `flight-${myFlight.pilot_id}`,
            String(currentUser.id)
        );
    }
}