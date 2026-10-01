// ============================================================
//  PUSH-УВЕДОМЛЕНИЯ
// ============================================================

let notificationsEnabled = false;
let previousFlights = {};

async function initNotifications() {
    if (!("Notification" in window)) {
        console.log("[NOTIF] Браузер не поддерживает уведомления");
        return;
    }

    // Проверяем сохранённое разрешение
    if (Notification.permission === "granted") {
        notificationsEnabled = true;
        updateNotifButton();
        console.log("[NOTIF] Уведомления уже разрешены");
    }
}

async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        toast("Браузер не поддерживает уведомления", "error");
        return;
    }

    if (Notification.permission === "granted") {
        notificationsEnabled = !notificationsEnabled;
        updateNotifButton();
        toast(notificationsEnabled ? "Уведомления включены" : "Уведомления выключены", "info");
        return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
        notificationsEnabled = true;
        updateNotifButton();
        toast("Уведомления включены ✅", "success");
        showNotification("Skyline", "Уведомления активированы! 🔔");
    } else {
        toast("Уведомления заблокированы", "error");
    }
}

function updateNotifButton() {
    const btn = document.getElementById("notif-btn");
    if (!btn) return;
    if (notificationsEnabled) {
        btn.classList.add("active");
        btn.title = "Уведомления включены";
    } else {
        btn.classList.remove("active");
        btn.title = "Уведомления выключены";
    }
}

function showNotification(title, body, options = {}) {
    if (!notificationsEnabled) return;
    if (Notification.permission !== "granted") return;

    try {
        const notif = new Notification(title, {
            body: body,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: options.tag || "skyline",
            requireInteraction: false,
            silent: false,
        });

        notif.onclick = () => {
            window.focus();
            notif.close();
        };

        setTimeout(() => notif.close(), 8000);
    } catch (e) {
        console.error("[NOTIF]", e);
    }
}

function checkFlightUpdates() {
    if (!notificationsEnabled) return;
    if (!liveData || !liveData.flights) return;

    const current = liveData.flights;

    // Новые рейсы
    for (const [pilotId, flight] of Object.entries(current)) {
        const prev = previousFlights[pilotId];
        if (!prev) {
            // Рейс только что появился
            showNotification(
                "✈️ Новый рейс",
                `${flight.pilot_name || "Пилот"}: ${flight.departure} → ${flight.arrival} (${flight.aircraft})`,
                { tag: `new-${pilotId}` }
            );
        } else if (prev.status !== flight.status) {
            // Статус изменился
            const statusLabels = {
                approved: "✅ План одобрен",
                radio: "📻 Радиоэфир открыт",
                taxiing: "🚕 Руление",
                takeoff_cleared: "🛫 Взлёт разрешён",
                airborne: "✈️ В воздухе",
                approaching: "🛬 На заходе",
                landing_cleared: "🛬 Посадка разрешена",
                landed: "✅ Сел",
                completed: "🏁 Завершён",
                cancelled: "❌ Отменён",
                rejected: "❌ Отклонён",
            };
            const label = statusLabels[flight.status] || flight.status;
            showNotification(
                `${label}`,
                `${flight.pilot_name || "Пилот"}: ${flight.departure} → ${flight.arrival}`,
                { tag: `status-${pilotId}` }
            );
        }
    }

    // Завершённые рейсы (удалить из памяти)
    for (const pilotId of Object.keys(previousFlights)) {
        if (!(pilotId in current)) {
            delete previousFlights[pilotId];
        }
    }

    previousFlights = { ...current };
}