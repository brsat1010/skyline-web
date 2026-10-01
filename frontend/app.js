// ============================================================
//  СПРАВОЧНИКИ
// ============================================================

const AIRPORT_COUNTRY = {
    ITKO: "jp", IPPH: "au", ILKL: "np", IRFD: "us", IMLR: "us",
    IGAR: "us", IBLT: "us", ITRC: "us", ILAR: "cy", IPAP: "cy",
    IBAR: "gb", IHEN: "gb", IIAB: "us", IZOL: "tr", IJAF: "iq",
    IGRV: "is", IBTH: "fr", ISAU: "us", ISCM: "gb", IDCS: "jp", ISKP: "gr",
};

const AIRLINE_ICONS = {
    "Air France": "https://cdn.simpleicons.org/airfrance/002157",
    "Aeroflot": "https://cdn.simpleicons.org/aeroflot/df0000",
    "British Airways": "https://cdn.simpleicons.org/britishairways/075aaa",
    "Emirates": "https://cdn.simpleicons.org/emirates/d71921",
    "Lufthansa": "https://cdn.simpleicons.org/lufthansa/05164d",
    "Qantas": "https://cdn.simpleicons.org/qantas/e40000",
    "Ryanair": "https://cdn.simpleicons.org/ryanair/073590",
    "Singapore Airlines": "https://cdn.simpleicons.org/singaporeairlines/f99f02",
    "Turkish Airlines": "https://cdn.simpleicons.org/turkishairlines/c70a0a",
    "Delta": "https://cdn.simpleicons.org/delta/003366",
    "United Airlines": "https://cdn.simpleicons.org/unitedairlines/002244",
    "American Airlines": "https://cdn.simpleicons.org/americanairlines/0078d2",
    "KLM": "https://cdn.simpleicons.org/klm/00a1de",
    "Iberia": "https://cdn.simpleicons.org/iberia/d7192b",
    "Air Canada": "https://cdn.simpleicons.org/aircanada/f01428",
    "Qatar Airways": "https://cdn.simpleicons.org/qatarairways/5c0632",
    "Cathay Pacific": "https://cdn.simpleicons.org/cathaypacific/006564",
    "FedEx": "https://cdn.simpleicons.org/fedex/4d148c",
    "DHL": "https://cdn.simpleicons.org/dhl/ffcc00",
    "UPS": "https://cdn.simpleicons.org/ups/351c15",
};

// ============================================================
//  УТИЛИТЫ
// ============================================================

function getAircraftCategory(name) {
    const n = (name || "").toLowerCase();
    if (n.match(/cargo|an-|beluga|dreamlifter|kc-|c-17|c-130/)) return "cargo";
    if (n.match(/^f-|b-2|b-29|su-|mig|a-10|hawk|eurofighter|sr-71|vulcan|lightning|hurricane|corsair|zero|mustang|p-51|p-8|e-3/)) return "military";
    if (n.match(/bell|chinook|black hawk|h135|s-92/)) return "helicopter";
    if (n.match(/cessna|piper|cirrus|learjet|extra|caravan|cub|paratrike|walrus|wright/)) return "private";
    if (n.match(/747|777|787|a330|a340|a350|a380|md-11|an-225/)) return "wide";
    return "narrow";
}

function getAircraftIcon(name) {
    const emojis = { narrow: "🛫", wide: "🛬", cargo: "📦", private: "🛩️", military: "🛦", helicopter: "🚁" };
    return '<span style="font-size:18px;vertical-align:-2px;">' + (emojis[getAircraftCategory(name)] || "✈️") + '</span>';
}

function getAirportFlag(icao) {
    const cc = AIRPORT_COUNTRY[icao];
    return cc ? '<span class="fi fi-' + cc + '" style="vertical-align:-2px;margin-right:6px;border-radius:2px;"></span>' : "";
}

function getAirlineIcon(airline) {
    const url = AIRLINE_ICONS[airline];
    return url ? '<img src="' + url + '" width="16" height="16" style="vertical-align:-3px;margin-right:4px;" onerror="this.style.display=\'none\'">' : '<span style="opacity:0.5;">🏢</span>';
}

// ============================================================
//  STATE
// ============================================================

let currentUser = null;
let liveData = { flights: {}, shifts: {}, atis: {}, stats: {} };
let ws = null;

// ============================================================
//  UI УТИЛИТЫ
// ============================================================

function toast(text, type = "success") {
    const t = document.getElementById("toast");
    const icons = { success: "✅", error: "❌", info: "ℹ️" };
    t.className = "toast " + type + " show";
    t.innerHTML = `<span class="toast-icon">${icons[type] || "✅"}</span><span>${text}</span>`;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 3000);
}

function showError(el, message) {
    el.innerHTML = `
        <div class="error-box">
            <span class="icon">⚠️</span>
            <div>
                <strong>Ошибка</strong><br>
                <span style="font-size:13px;opacity:0.8;">${message}</span>
            </div>
        </div>
    `;
}

function showEmpty(el, emoji, title, subtitle = "") {
    el.innerHTML = `
        <div class="empty-state">
            <div class="emoji">${emoji}</div>
            <div class="title">${title}</div>
            ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ""}
        </div>
    `;
}

function skeletonTable(rows = 4) {
    let html = '<div style="padding:20px;">';
    for (let i = 0; i < rows; i++) {
        html += '<div class="skeleton skeleton-line"></div>';
    }
    html += '</div>';
    return html;
}

// ============================================================
//  NAV
// ============================================================

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        document.getElementById('page-title').textContent = item.querySelector('span').textContent;
        renderPage(item.dataset.page);
    });
});

async function apiGet(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(r.statusText || "HTTP " + r.status);
    return r.json();
}

async function loadUser() {
    try {
        const data = await apiGet('/auth/me');
        if (data.id) {
            currentUser = data;
            const name = data.global_name || data.username;
            document.getElementById('user-box').innerHTML = `
                <div class="user-badge">
                    <div class="avatar">${name[0].toUpperCase()}</div>
                    <span>${name}</span>
                    <a href="/auth/logout" class="btn btn-secondary" style="padding:4px 12px;font-size:12px;">Выйти</a>
                </div>
            `;
        }
    } catch (e) { console.error(e); }
}

function connectWS() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(proto + '://' + location.host + '/ws');
            ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'update') {
            liveData = msg.data;
            checkFlightUpdates();
            checkVoiceAutoJoin();  // ← АВТОПОДКЛЮЧЕНИЕ К ВОЙСУ
            const active = document.querySelector('.nav-item.active');
            if (active) renderPage(active.dataset.page);
        }
    };
    ws.onclose = () => setTimeout(connectWS, 3000);
    setInterval(() => ws.readyState === 1 && ws.send('ping'), 25000);
}

// ============================================================
//  ROUTER
// ============================================================

async function renderPage(page) {
    const el = document.getElementById('content');
    el.innerHTML = skeletonTable(4);
    el.classList.remove('page-fade');
    void el.offsetWidth;
    el.classList.add('page-fade');

    try {
        if (page === 'dashboard') return renderDashboard(el);
        if (page === 'flights') return renderFlights(el);
        if (page === 'atc') return renderATC(el);
        if (page === 'profile') return renderProfile(el);
        if (page === 'academy') return renderAcademy(el);
        if (page === 'atis') return renderATIS(el);
        if (page === 'top') return renderTop(el);
    } catch (e) {
        showError(el, e.message);
    }
}

// ============================================================
//  DASHBOARD
// ============================================================

async function renderDashboard(el) {
    const stats = await apiGet('/api/stats');
    let my = { flights: 0, hours: 0 };
    if (currentUser) my = await apiGet('/api/pilot/' + currentUser.id);

    const flights = Object.values(liveData.flights || {});

    el.innerHTML = `
        <div class="grid">
            <div class="stat">
                <div class="stat-label">✈️ Мои рейсы</div>
                <div class="stat-value blue">${my.flights || 0}</div>
            </div>
            <div class="stat">
                <div class="stat-label">🕒 Мой налёт</div>
                <div class="stat-value green">${(my.hours || 0).toFixed(1)} ч</div>
            </div>
            <div class="stat">
                <div class="stat-label">🎯 Активных рейсов</div>
                <div class="stat-value orange">${stats.active_flights || 0}</div>
            </div>
            <div class="stat">
                <div class="stat-label">🎙️ Открытых смен</div>
                <div class="stat-value purple">${stats.active_shifts || 0}</div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>📈 Активность за неделю</h3>
            </div>
            <canvas id="chart-weekly" style="max-height:220px;"></canvas>
        </div>

        <div class="card">
            <div class="card-header">
                <h3>🔴 Активные рейсы</h3>
                <span class="badge badge-blue">Live</span>
            </div>
            ${flights.length ? flightsTable(flights) : '<div class="empty-state"><div class="emoji">✈️</div><div class="title">Нет активных рейсов</div></div>'}
        </div>
    `;

        setTimeout(() => renderWeeklyChart(), 100);
}

function flightsTable(flights) {
    return '<table>' +
        '<thead><tr><th>Пилот</th><th>Маршрут</th><th>ВС</th><th>Этап</th></tr></thead>' +
        '<tbody>' +
        flights.map(f => `
            <tr>
                <td>${f.pilot_name || f.pilot_id}</td>
                <td>${getAirportFlag(f.departure)}<strong>${f.departure}</strong>
                    <span style="color:#6b7280;margin:0 6px;">→</span>
                    ${getAirportFlag(f.arrival)}<strong>${f.arrival}</strong></td>
                <td>${getAircraftIcon(f.aircraft)} ${f.aircraft}</td>
                <td><span class="badge badge-yellow">${f.status}</span></td>
            </tr>
        `).join('') +
        '</tbody></table>';
}

// ============================================================
//  FLIGHTS
// ============================================================

async function renderFlights(el) {
    const flights = Object.values(liveData.flights || {});
    el.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3>✈️ Активные рейсы</h3>
                <span class="badge badge-green">${flights.length}</span>
            </div>
            ${flights.length ? flightsTable(flights) : '<div class="empty-state"><div class="emoji">🛫</div><div class="title">Пусто</div><div class="subtitle">Подай план из Discord</div></div>'}
        </div>
    `;
}

// ============================================================
//  ATC
// ============================================================

async function renderATC(el) {
    const shifts = Object.entries(liveData.shifts || {});
    el.innerHTML = `
        <div class="card">
            <h3 style="margin-bottom:16px;">🎙️ Активные смены</h3>
            ${shifts.length ? `
                <table><thead><tr><th>Аэропорт</th><th>Диспетчер</th><th>Начало</th></tr></thead>
                <tbody>
                    ${shifts.map(([icao, s]) => `
                        <tr>
                            <td>${getAirportFlag(icao)}<strong>${icao}</strong></td>
                            <td>${s.user_name || s.user_id}</td>
                            <td>${new Date(s.started_ts * 1000).toLocaleTimeString()}</td>
                        </tr>
                    `).join('')}
                </tbody></table>
            ` : '<div class="empty-state"><div class="emoji">🎙️</div><div class="title">Никто не на смене</div></div>'}
        </div>
    `;
}

// ============================================================
//  PROFILE
// ============================================================

function getRank(flights) {
    const RANKS = [
        { min: 0, name: "Стажёр", emoji: "🪖" },
        { min: 5, name: "Второй пилот", emoji: "✈️" },
        { min: 20, name: "КВС", emoji: "🎖️" },
        { min: 50, name: "Капитан-инструктор", emoji: "👑" },
    ];
    let cur = RANKS[0];
    let next = null;
    for (let i = 0; i < RANKS.length; i++) {
        if (flights >= RANKS[i].min) {
            cur = RANKS[i];
            next = RANKS[i + 1] || null;
        }
    }
    return { ...cur, next };
}

async function renderProfile(el) {
    if (!currentUser) {
        return showEmpty(el, "🔒", "Войдите через Discord", "Чтобы увидеть профиль");
    }

    const data = await apiGet('/api/pilot/' + currentUser.id + '/extended');
    const history = await apiGet('/api/pilot/' + currentUser.id + '/history');
    const name = currentUser.global_name || currentUser.username;
    const rank = getRank(data.flights || 0);

    // Аватар Discord (если есть)
    let avatarUrl = null;
    if (currentUser.avatar) {
        avatarUrl = `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png?size=128`;
    } else {
        // Дефолтный аватар Discord
        const defaultIndex = Number(BigInt(currentUser.id) >> 22n) % 6;
        avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
    }

    // Ачивки
    const achievementsHtml = data.achievements.map(a => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:${a.unlocked ? 'var(--bg-hover)' : 'transparent'};border:1px solid ${a.unlocked ? 'var(--accent)' : 'var(--border)'};border-radius:10px;${a.unlocked ? '' : 'opacity:0.4;'}">
            <span style="font-size:28px;">${a.emoji}</span>
            <div style="flex:1;">
                <div style="font-weight:600;color:${a.unlocked ? 'var(--text-main)' : 'var(--text-dim)'};">${a.name}</div>
                <div style="font-size:12px;color:var(--text-dim);">${a.description}</div>
            </div>
            ${a.unlocked ? '<span style="color:var(--success);font-size:20px;">✓</span>' : ''}
        </div>
    `).join('');

    // Топ аэропортов
    const airportsHtml = data.top_airports.length ? data.top_airports.map(([icao, count]) => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
            <span>${getAirportFlag(icao)} <strong>${icao}</strong></span>
            <span style="color:var(--accent-soft);">${count}×</span>
        </div>
    `).join('') : '<div style="color:var(--text-dim);font-size:13px;">Нет данных</div>';

    el.innerHTML = `
        <div class="card">
            <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
                <img src="${avatarUrl}" alt="Avatar" style="width:100px;height:100px;border-radius:50%;border:3px solid var(--accent);box-shadow:0 0 20px rgba(0,175,244,0.4);" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                <div style="flex:1;">
                    <h2 style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                        ${name}
                        <span style="font-size:11px;background:#5865F2;color:white;padding:2px 8px;border-radius:4px;font-weight:600;">DISCORD</span>
                    </h2>
                    <p style="color:var(--text-muted);margin-top:6px;">${rank.emoji} <strong>${rank.name}</strong></p>
                    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
                        <a href="https://discord.com/users/${currentUser.id}" target="_blank" class="btn btn-discord" style="padding:6px 14px;font-size:12px;">
                            <svg class="icon" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                                <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                            </svg>
                            Открыть в Discord
                        </a>
                    </div>
                </div>
            </div>

            <div class="grid" style="margin-top:24px;">
                <div class="stat"><div class="stat-label">✈️ Рейсов</div>
                    <div class="stat-value blue">${data.flights || 0}</div></div>
                <div class="stat"><div class="stat-label">🕒 Налёт</div>
                    <div class="stat-value green">${(data.hours || 0).toFixed(1)} ч</div></div>
                <div class="stat"><div class="stat-label">🛫 Маршрутов</div>
                    <div class="stat-value orange">${data.routes_count || 0}</div></div>
                <div class="stat"><div class="stat-label">📅 Первый рейс</div>
                    <div class="stat-value" style="font-size:16px;">${data.first_flight || "—"}</div></div>
            </div>

            ${rank.next ? `
                <div style="margin-top:20px;">
                    <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-muted);margin-bottom:8px;">
                        <span>До <strong>${rank.next.name}</strong></span>
                        <span>${data.flights || 0} / ${rank.next.need}</span>
                    </div>
                    <div style="background:var(--bg-main);height:8px;border-radius:4px;overflow:hidden;">
                        <div style="width:${Math.min(100, ((data.flights || 0) / rank.next.need) * 100)}%;height:100%;background:linear-gradient(90deg,#00AFF4,#58a6ff);transition:width 0.5s;"></div>
                    </div>
                </div>
            ` : ""}
        </div>

        <div class="card">
            <h3 style="margin-bottom:16px;">🏆 Ачивки (${data.achievements.filter(a => a.unlocked).length}/${data.achievements.length})</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;">
                ${achievementsHtml}
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <h3 style="margin-bottom:16px;">🛫 Топ аэропортов</h3>
                ${airportsHtml}
            </div>

            <div class="card">
                <h3 style="margin-bottom:16px;">🛬 Любимый маршрут</h3>
                ${data.favorite_route ? `
                    <div style="font-size:18px;font-weight:600;color:var(--accent-soft);text-align:center;padding:20px 0;">
                        ${data.favorite_route}
                    </div>
                    <div style="text-align:center;color:var(--text-dim);font-size:13px;">
                        Выполнен ${data.favorite_route_count} раз
                    </div>
                ` : '<div style="color:var(--text-dim);text-align:center;padding:20px;">Нет данных</div>'}
            </div>
        </div>

        <div class="card">
            <h3 style="margin-bottom:16px;">📊 Последние рейсы</h3>
            ${history.length ? `
                <table><thead><tr><th>Маршрут</th><th>Налёт</th><th>Дата</th></tr></thead>
                <tbody>
                    ${history.map(h => `
                        <tr>
                            <td>${getAirportFlag(h.dep)}<strong>${h.dep}</strong>
                                <span style="color:var(--text-dim);">→</span>
                                ${getAirportFlag(h.arr)}<strong>${h.arr}</strong></td>
                            <td>${h.hours} ч</td>
                            <td style="color:var(--text-muted);font-size:13px;">${h.at}</td>
                        </tr>
                    `).join('')}
                </tbody></table>
            ` : '<div class="empty-state"><div class="emoji">📋</div><div class="title">Нет рейсов</div></div>'}
        </div>
    `;
}

// ============================================================
//  ACADEMY
// ============================================================

async function renderAcademy(el) {
    if (!currentUser) return showEmpty(el, "🔒", "Войдите через Discord");

    const students = await apiGet('/api/students');
    const me = students[currentUser.id];
    if (!me) return showEmpty(el, "🎓", "Ты не курсант", "Поступить в Discord: /поступить");

    const stages = {
        theory: "📖 Теория", test: "📝 Тест", practice: "🏋️ Практика",
        exam: "🎯 Экзамен", graduated: "🎖️ Выпуск",
    };
    const stageLabel = stages[me.stage] || me.stage;
    const isPilot = me.type === "pilot";
    const minPractice = 3;
    const passScore = isPilot ? 8 : 9;

    el.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3>🎓 Академия Skyline</h3>
                <span class="badge badge-blue">${isPilot ? "✈️ Пилот" : "🎙️ УВД"}</span>
            </div>
            <div class="grid">
                <div class="stat"><div class="stat-label">Стадия</div>
                    <div class="stat-value" style="font-size:20px;">${stageLabel}</div></div>
                <div class="stat"><div class="stat-label">Тест</div>
                    <div class="stat-value ${(me.test_score || 0) >= passScore ? 'green' : 'orange'}">${me.test_score || "—"}/10</div></div>
                <div class="stat"><div class="stat-label">Практика</div>
                    <div class="stat-value ${(me.practice_done || 0) >= minPractice ? 'green' : 'orange'}">${me.practice_done || 0}/${minPractice}</div></div>
            </div>
            <div style="margin-top:20px;">
                <div style="display:flex;justify-content:space-between;font-size:13px;color:#9ca3af;margin-bottom:8px;">
                    <span>Прогресс практики</span><span>${me.practice_done || 0} / ${minPractice}</span>
                </div>
                <div style="background:#0d1117;height:8px;border-radius:4px;overflow:hidden;">
                    <div style="width:${Math.min(100, ((me.practice_done || 0) / minPractice) * 100)}%;height:100%;background:linear-gradient(90deg,#00AFF4,#58a6ff);"></div>
                </div>
            </div>
        </div>
    `;
}

// ============================================================
//  ATIS
// ============================================================

async function renderATIS(el) {
    const list = Object.entries(liveData.atis || {});
    el.innerHTML = `
        <div class="card">
            <h3 style="margin-bottom:16px;">📡 Текущие ATIS</h3>
            ${list.length ? `
                <div class="grid">
                    ${list.map(([icao, a]) => `
                        <div class="card" style="margin-bottom:0;">
                            <div class="card-header">
                                <h3>${getAirportFlag(icao)} ${icao}</h3>
                                <span class="badge badge-blue">${a.letter}</span>
                            </div>
                            <div style="font-size:13px;line-height:2;">
                                <div>🌀 Ветер: <strong>${a.wind}</strong></div>
                                <div>✈️ ВПП: <strong>${a.runway}</strong></div>
                                <div>👁 Видимость: <strong>${a.visibility}</strong></div>
                                <div style="color:#9ca3af;font-size:12px;margin-top:8px;">${a.by} · ${a.updated_at}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '<div class="empty-state"><div class="emoji">📡</div><div class="title">ATIS не установлены</div></div>'}
        </div>
    `;
}

// ============================================================
//  TOP
// ============================================================

async function renderTop(el) {
    const pilots = await apiGet('/api/top/pilots');
    const atc = await apiGet('/api/top/atc');
    const medals = ["🥇", "🥈", "🥉"];

    el.innerHTML = `
        <div class="grid">
            <div class="card">
                <h3 style="margin-bottom:16px;">🏆 Топ пилотов</h3>
                ${pilots.length ? pilots.map((p, i) => `
                    <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#161b22;border-radius:8px;margin-bottom:8px;">
                        <span style="font-size:24px;">${medals[i] || "#" + (i + 1)}</span>
                        <div style="flex:1;">
                            <div style="font-weight:600;">${p.display_name || p.user_id}</div>
                            <div style="font-size:12px;color:#6b7280;">${p.flights} рейсов · ${(p.hours || 0).toFixed(1)} ч</div>
                        </div>
                    </div>
                `).join('') : '<div class="empty-state"><div class="emoji">🏆</div><div class="title">Пусто</div></div>'}
            </div>

            <div class="card">
                <h3 style="margin-bottom:16px;">🎙️ Топ УВД</h3>
                ${atc.length ? atc.map((s, i) => `
                    <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#161b22;border-radius:8px;margin-bottom:8px;">
                        <span style="font-size:24px;">${medals[i] || "#" + (i + 1)}</span>
                        <div style="flex:1;">
                            <div style="font-weight:600;">${s.user_name || s.user_id}</div>
                            <div style="font-size:12px;color:#6b7280;">${s.reviewed} проверок · ✅${s.approved} ❌${s.rejected}</div>
                        </div>
                    </div>
                `).join('') : '<div class="empty-state"><div class="emoji">🎙️</div><div class="title">Пусто</div></div>'}
            </div>
        </div>
    `;
}

// ============================================================
//  CHART
// ============================================================

async function renderWeeklyChart() {
    const canvas = document.getElementById("chart-weekly");
    if (!canvas) return;

    let weekly;
    try {
        weekly = await apiGet('/api/chart/weekly');
    } catch (e) {
        weekly = [];
    }

    // Если данных нет — показываем честные нули
    const labels = weekly.length ? weekly.map(d => d.day) : ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    const data = weekly.length ? weekly.map(d => d.count) : [0, 0, 0, 0, 0, 0, 0];
    const total = data.reduce((a, b) => a + b, 0);

    const ctx = canvas.getContext("2d");

    // Уничтожаем старый график если есть
    if (canvas._chart) canvas._chart.destroy();

    canvas._chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Рейсы",
                data: data,
                borderColor: "#00AFF4",
                backgroundColor: "rgba(0, 175, 244, 0.15)",
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointBackgroundColor: "#00AFF4",
                pointBorderColor: "#0d1117",
                pointBorderWidth: 2,
                pointRadius: 5,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Рейсов: ${ctx.parsed.y}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#6b7280",
                        stepSize: 1,
                        precision: 0,
                    },
                    grid: { color: "#1f2937" }
                },
                x: {
                    ticks: { color: "#6b7280" },
                    grid: { display: false }
                }
            }
        }
    });

    // Показываем "итого" над графиком
    const header = canvas.parentElement.querySelector('.card-header');
    if (header && !header.querySelector('.chart-total')) {
        const totalEl = document.createElement('span');
        totalEl.className = 'chart-total';
        totalEl.style.cssText = 'font-size:13px;color:#9ca3af;';
        totalEl.textContent = `Всего за неделю: ${total}`;
        header.appendChild(totalEl);
    } else if (header && header.querySelector('.chart-total')) {
        header.querySelector('.chart-total').textContent = `Всего за неделю: ${total}`;
    }
}

// ============================================================
//  INIT
// ============================================================

(async () => {
    initTheme();              // ← ТЕМА СНАЧАЛА
    await loadUser();
    await initNotifications();
    await renderPage("dashboard");
    connectWS();
    setInterval(() => {
        const active = document.querySelector(".nav-item.active");
        if (active) renderPage(active.dataset.page);
    }, 15000);
})();;

// ============================================================
//  ТЕМА (светлая / тёмная)
// ============================================================

function applyTheme(theme) {
    const body = document.body;
    const btn = document.getElementById("theme-btn");
    if (theme === "light") {
        body.classList.add("light");
        if (btn) btn.textContent = "☀️";
    } else {
        body.classList.remove("light");
        if (btn) btn.textContent = "🌙";
    }
    localStorage.setItem("skyline-theme", theme);
}

function toggleTheme() {
    const current = document.body.classList.contains("light") ? "light" : "dark";
    const next = current === "light" ? "dark" : "light";
    applyTheme(next);
    toast(next === "light" ? "☀️ Светлая тема" : "🌙 Тёмная тема", "info");
}

function initTheme() {
    let saved = localStorage.getItem("skyline-theme");
    if (!saved) {
        // Первый раз — смотрим на системную тему
        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
            saved = "light";
        } else {
            saved = "dark";
        }
    }
    applyTheme(saved);
}