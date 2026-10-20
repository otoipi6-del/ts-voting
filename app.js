/**
 * app.js — фронтенд системы голосования ТС.
 */

const API_URL = 'https://lingering-sea-f8d6.otoipi6.workers.dev';

const App = {
  state: {
    session: null,
    page: 'login',
    params: {},
    data: null,
    loading: false
  },

  call(action, payload) {
    const body = {
      action: action,
      payload: payload || {},
      token: this.state.session ? this.state.session.token : null
    };
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(r => r.json())
      .then(res => {
        if (res && res.ok) return res.data;
        throw new Error(res && res.error || 'Ошибка сервера');
      });
  },

  callPublic(action, payload) {
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, payload: payload || {} })
    })
      .then(r => r.json())
      .then(res => {
        if (res && res.ok) return res.data;
        throw new Error(res && res.error || 'Ошибка сервера');
      });
  },

  saveToken(token) { try { localStorage.setItem('ts_token', token); } catch (e) {} },
  loadToken() { try { return localStorage.getItem('ts_token'); } catch (e) { return null; } },
  clearToken() { try { localStorage.removeItem('ts_token'); } catch (e) {} },

  navigate(page, params) {
    this.state.page = page;
    this.state.params = params || {};
    this.render();
  },

  async init() {
    const token = this.loadToken();
    if (token) {
      this.state.session = { token };
      try {
        const info = await this.call('auth.checkSession');
        this.state.session = Object.assign(this.state.session, info);
        if (info.status === 'active' || info.role === 'admin') {
          await this.goHome();
        } else {
          this.navigate('register');
        }
        return;
      } catch (e) {
        this.clearToken();
        this.state.session = null;
      }
    }
    this.navigate('login');
  },

  async goHome() {
    const role = this.state.session.role;
    if (role === 'admin') {
      this.state.data = await this.call('admin.dashboard');
      this.navigate('admin');
    } else if (role === 'initiator') {
      this.state.data = await this.call('initiator.listVotings');
      this.navigate('initiator');
    } else {
      this.state.data = await this.call('dashboard.get');
      this.navigate('dashboard');
    }
  },

  render() {
    const app = document.getElementById('app');
    if (this.state.loading) {
      app.innerHTML = '<div class="container center" style="padding-top:100px;"><div class="spinner"></div></div>';
      return;
    }
    const pages = {
      login: this.renderLogin,
      register: this.renderRegister,
      registerStatus: this.renderRegisterStatus,
      dashboard: this.renderDashboard,
      voting: this.renderVoting,
      ballot: this.renderBallot,
      confirm: this.renderConfirm,
      success: this.renderSuccess,
      results: this.renderResults,
      initiator: this.renderInitiator,
      initiatorCreate: this.renderInitiatorCreate,
      monitor: this.renderMonitor,
      admin: this.renderAdmin,
      adminRequests: this.renderAdminRequests,
      adminProperties: this.renderAdminProperties,
      adminUsers: this.renderAdminUsers,
      adminSettings: this.renderAdminSettings,
      adminLogs: this.renderAdminLogs,
      adminVotings: this.renderAdminVotings
    };
    const fn = pages[this.state.page] || this.renderLogin;
    app.innerHTML = fn.call(this);
    this.bindEvents();
  },

  renderLogin() {
    return `
      <div class="container" style="max-width: 440px; margin-top: 60px;">
        <div class="card center">
          <h1>Голосование ТС</h1>
          <p class="muted mb">Вход в систему голосования</p>
          <div id="telegram-widget-container"><div class="spinner"></div></div>
          <p class="muted mt">Войдите через Telegram, чтобы продолжить</p>
          <div id="loginError" class="error"></div>
        </div>
      </div>
    `;
  },

  renderRegister() {
    return `
      <div class="container" style="max-width: 520px; margin-top: 40px;">
        <div class="card">
          <h1>Подтверждение права собственности</h1>
          <p class="muted mb">Заполните данные — администратор проверит заявку.</p>
          <label class="label">ФИО</label>
          <input class="input" id="regFio" placeholder="Иванов Иван Иванович">
          <label class="label">Номер квартиры</label>
          <input class="input" id="regProperty" placeholder="45">
          <div id="regError" class="error"></div>
          <button class="btn btn-primary btn-block mt" data-action="register">Отправить заявку</button>
          <button class="btn btn-secondary btn-block mt" data-action="logout">Выйти</button>
        </div>
      </div>
    `;
  },

  renderRegisterStatus() {
    return `
      <div class="container" style="max-width: 520px; margin-top: 60px;">
        <div class="card center">
          <h1>⏳ Заявка на рассмотрении</h1>
          <p class="muted">Администратор проверит ваши данные. Мы пришлём уведомление в Telegram.</p>
          <button class="btn btn-primary btn-block mt" data-action="refreshStatus">Обновить статус</button>
          <button class="btn btn-secondary btn-block mt" data-action="logout">Выйти</button>
        </div>
      </div>
    `;
  },

  renderDashboard() {
    const d = this.state.data || {};
    const active = (d.active || []).map(v => {
      const percent = v.totalUsers ? Math.round(v.votedCount / v.totalUsers * 100) : 0;
      return `
        <div class="card">
          <h3>${this.esc(v.title)}</h3>
          <p class="muted">До ${this.formatDate(v.end_date)}</p>
          <div class="progress mt mb"><div class="progress-bar" style="width:${percent}%"></div></div>
          <p class="muted mb">Проголосовало ${v.votedCount} из ${v.totalUsers}</p>
          <button class="btn ${v.voted ? 'btn-secondary' : 'btn-primary'} btn-block" data-action="${v.voted ? 'results' : 'vote'}" data-id="${v.id}">
            ${v.voted ? 'Посмотреть результаты' : 'Перейти к голосованию'}
          </button>
        </div>
      `;
    }).join('') || '<p class="muted">Активных голосований нет</p>';

    return `
      ${this.renderNav()}
      <div class="container">
        <h1>Здравствуйте, ${this.esc(d.user ? d.user.fio : '')}!</h1>
        <h2>Активные голосования</h2>
        ${active}
      </div>
    `;
  },

  renderVoting() {
    const v = this.state.data;
    if (!v) return '<div class="container"><p>Загрузка...</p></div>';
    const questions = v.questions.map(q => `
      <div class="card">
        <h3>${q.order}. ${this.esc(q.text)}</h3>
        ${q.project ? '<p class="muted">Проект: ' + this.esc(q.project) + '</p>' : ''}
      </div>
    `).join('');
    return `
      ${this.renderNav()}
      <div class="container">
        <button class="btn btn-secondary btn-sm mb" data-action="back">← Назад</button>
        <h1>${this.esc(v.title)}</h1>
        <p class="muted mb">До ${this.formatDate(v.end_date)}</p>
        <h2>Повестка дня</h2>
        ${questions}
        ${v.voted
          ? '<button class="btn btn-secondary btn-block mt" data-action="results" data-id="' + v.id + '">Посмотреть результаты</button>'
          : '<button class="btn btn-primary btn-block mt" data-action="startBallot" data-id="' + v.id + '">Перейти к голосованию</button>'}
      </div>
    `;
  },

  renderBallot() {
    const b = this.state.data;
    if (!b) return '<div class="container"><p>Загрузка...</p></div>';
    const idx = this.state.params.idx || 0;
    const q = b.questions[idx];
    const total = b.questions.length;
    const answers = this.state.params.answers || {};
    const current = answers[q.id];
    return `
      ${this.renderNav()}
      <div class="container">
        <h2>${this.esc(b.voting.title)}</h2>
        <p class="muted mb">Вы ответили на ${Object.keys(answers).length} из ${total}</p>
        <div class="progress mb"><div class="progress-bar" style="width:${Object.keys(answers).length / total * 100}%"></div></div>
        <div class="card">
          <p class="muted">ВОПРОС ${idx + 1} ИЗ ${total}</p>
          <h3 class="mt">${this.esc(q.text)}</h3>
          ${q.project ? '<p class="muted mt">Проект решения: ' + this.esc(q.project) + '</p>' : ''}
          <div class="row mt">
            <button class="btn btn-vote for ${current === 'for' ? 'selected' : ''}" data-vote="for" data-qid="${q.id}">✅ ЗА</button>
            <button class="btn btn-vote against ${current === 'against' ? 'selected' : ''}" data-vote="against" data-qid="${q.id}">❌ ПРОТИВ</button>
            <button class="btn btn-vote abstain ${current === 'abstain' ? 'selected' : ''}" data-vote="abstain" data-qid="${q.id}">⬜ ВОЗД.</button>
          </div>
        </div>
        <div class="flex between">
          <button class="btn btn-secondary" data-action="ballotPrev" ${idx === 0 ? 'disabled' : ''}>← Назад</button>
          ${idx < total - 1
            ? `<button class="btn btn-primary" data-action="ballotNext" ${!current ? 'disabled' : ''}>Далее →</button>`
            : `<button class="btn btn-primary" data-action="ballotFinish" ${!current ? 'disabled' : ''}>Проверить и отправить</button>`}
        </div>
      </div>
    `;
  },

  renderConfirm() {
    const { answers, questions } = this.state.params;
    const rows = questions.map((q, i) => {
      const a = answers[q.id];
      const label = a === 'for' ? '✅ ЗА' : a === 'against' ? '❌ ПРОТИВ' : '⬜ ВОЗД.';
      return `<tr><td>${i + 1}</td><td>${this.esc(q.text)}</td><td>${label}</td></tr>`;
    }).join('');
    return `
      ${this.renderNav()}
      <div class="container">
        <h1>Проверьте ваш бюллетень</h1>
        <div class="card table-wrap">
          <table class="table">
            <thead><tr><th>№</th><th>Вопрос</th><th>Ваш ответ</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p class="error">⚠️ После подписания изменить ответы будет невозможно</p>
        <div class="flex mt">
          <button class="btn btn-secondary" data-action="confirmBack">Вернуться</button>
          <button class="btn btn-primary" data-action="confirmSubmit">Подписать и отправить</button>
        </div>
      </div>
      ${this.state.params.showCodeModal ? this.renderCodeModal() : ''}
    `;
  },

  renderCodeModal() {
    return `
      <div class="modal-overlay">
        <div class="modal">
          <h2>Подтверждение голоса</h2>
          <p class="muted mb">Мы отправили код в ваш Telegram-бот. Введите его ниже:</p>
          <input class="input code-input" id="confirmCode" maxlength="4" inputmode="numeric" placeholder="0000">
          <p class="muted">Код действует 5 минут</p>
          <div class="flex mt">
            <button class="btn btn-secondary" data-action="codeCancel">Отмена</button>
            <button class="btn btn-primary" data-action="codeSubmit">Подтвердить</button>
          </div>
          <div id="codeError" class="error"></div>
        </div>
      </div>
    `;
  },

  renderSuccess() {
    const d = this.state.data || {};
    return `
      ${this.renderNav()}
      <div class="container center" style="max-width: 520px; margin-top: 60px;">
        <div class="card">
          <h1 class="success">✅ Ваш голос учтён</h1>
          <p class="muted mt">${this.formatDate(d.signedAt || new Date().toISOString())}</p>
          <p class="muted mt">Хэш бюллетеня:</p>
          <code style="word-break:break-all; font-size:12px;">${this.esc(d.hash || '')}</code>
          <button class="btn btn-secondary btn-block mt" data-action="backToDashboard">К списку голосований</button>
        </div>
      </div>
    `;
  },

  renderResults() {
    const r = this.state.data;
    if (!r) return '<div class="container"><p>Загрузка...</p></div>';
    const blocks = r.results.map(q => `
      <div class="card">
        <h3>Вопрос ${q.order}</h3>
        <p>${this.esc(q.text)}</p>
        <div class="mt">
          <p>✅ За: ${q.counts.for} (${q.areas.for} м²) — ${q.forPercent}%</p>
          <div class="progress mb"><div class="progress-bar" style="width:${q.forPercent}%; background:#16A34A;"></div></div>
          <p>❌ Против: ${q.counts.against} (${q.areas.against} м²)</p>
          <p>⬜ Воздержался: ${q.counts.abstain} (${q.areas.abstain} м²)</p>
        </div>
        <p class="mt"><span class="badge ${q.accepted ? 'badge-success' : 'badge-danger'}">${q.accepted ? 'ПРИНЯТО' : 'НЕ ПРИНЯТО'}</span></p>
      </div>
    `).join('');
    return `
      ${this.renderNav()}
      <div class="container">
        <button class="btn btn-secondary btn-sm mb" data-action="back">← Назад</button>
        <h1>Результаты: ${this.esc(r.voting.title)}</h1>
        <div class="card">
          <p>Кворум: ${r.quorum.percent}% (порог ${r.quorum.threshold}%) <span class="badge ${r.quorum.reached ? 'badge-success' : 'badge-danger'}">${r.quorum.reached ? 'ДОСТИГНУТ' : 'НЕ ДОСТИГНУТ'}</span></p>
          <p class="muted">Проголосовало: ${r.votedCount} из ${r.totalProperties} помещений</p>
        </div>
        ${blocks}
      </div>
    `;
  },

  renderInitiator() {
    const list = this.state.data || [];
    const items = list.map(v => `
      <div class="card">
        <h3>${this.esc(v.title)} <span class="badge ${v.status === 'active' ? 'badge-success' : v.status === 'draft' ? 'badge-muted' : 'badge-warn'}">${v.status}</span></h3>
        <p class="muted">${this.formatDate(v.start_date)} — ${this.formatDate(v.end_date)}</p>
        <p class="muted">Проголосовало: ${v.votedCount} из ${v.totalUsers}</p>
        <div class="flex mt">
          ${v.status === 'draft' ? `<button class="btn btn-primary btn-sm" data-action="publish" data-id="${v.id}">Опубликовать</button>` : ''}
          ${v.status === 'active' ? `<button class="btn btn-primary btn-sm" data-action="monitor" data-id="${v.id}">Мониторинг</button>` : ''}
          ${v.status === 'finished' ? `<button class="btn btn-secondary btn-sm" data-action="protocol" data-id="${v.id}">Протокол</button>` : ''}
        </div>
      </div>
    `).join('');
    return `
      ${this.renderNav()}
      <div class="container">
        <h1>Панель инициатора</h1>
        <button class="btn btn-primary btn-block mb" data-action="createVoting">+ Создать голосование</button>
        ${items || '<p class="muted">Нет голосований</p>'}
      </div>
    `;
  },

  renderInitiatorCreate() {
    const qs = (this.state.data && this.state.data.questions) || [];
    const qHtml = qs.map((q, i) => `
      <div class="card" style="background:#F9FAFB;">
        <div class="flex between mb">
          <strong>Вопрос ${i + 1}</strong>
          <button class="btn btn-danger btn-sm" data-action="removeQuestion" data-idx="${i}">×</button>
        </div>
        <label class="label">Текст вопроса</label>
        <textarea class="textarea" data-qfield="text" data-idx="${i}">${this.esc(q.text || '')}</textarea>
        <label class="label">Проект решения</label>
        <textarea class="textarea" data-qfield="project" data-idx="${i}">${this.esc(q.project || '')}</textarea>
      </div>
    `).join('');
    return `
      ${this.renderNav()}
      <div class="container">
        <button class="btn btn-secondary btn-sm mb" data-action="adminBack">← Назад</button>
        <h1>Создание голосования</h1>
        <div class="card">
          <label class="label">Название</label>
          <input class="input" id="vTitle" placeholder="Утверждение сметы на 2026 год">
          <label class="label">Дата начала</label>
          <input class="input" id="vStart" type="datetime-local">
          <label class="label">Дата окончания</label>
          <input class="input" id="vEnd" type="datetime-local">
          <label class="label">Дата подсчёта</label>
          <input class="input" id="vCount" type="datetime-local">
        </div>
        <div class="card">
          <h3>Вопросы повестки</h3>
          <div id="questionsList">${qHtml}</div>
          <button class="btn btn-secondary mt" data-action="addQuestion">+ Добавить вопрос</button>
        </div>
        <div id="createError" class="error"></div>
        <button class="btn btn-primary btn-block mt" data-action="saveVoting">Сохранить как черновик</button>
      </div>
    `;
  },

  renderMonitor() {
    const m = this.state.data;
    if (!m) return '<div class="container"><p>Загрузка...</p></div>';
    const rows = m.voters.map(v => `
      <tr>
        <td>${this.esc(v.property_number)}</td>
        <td>${this.esc(v.fio)}</td>
        <td>${v.property_area} м²</td>
        <td>${v.voted ? '✅' : '⏳'}</td>
      </tr>
    `).join('');
    return `
      ${this.renderNav()}
      <div class="container">
        <button class="btn btn-secondary btn-sm mb" data-action="navInitiator">← Назад</button>
        <h1>${this.esc(m.voting.title)}</h1>
        <div class="card">
          <p>Проголосовало: ${m.stats.votedCount} из ${m.stats.totalUsers}</p>
          <div class="progress mb"><div class="progress-bar" style="width:${m.stats.totalArea ? m.stats.votedArea / m.stats.totalArea * 100 : 0}%"></div></div>
          <p>Площадь: ${m.stats.votedArea.toFixed(1)} из ${m.stats.totalArea.toFixed(1)} м²</p>
          <p>Кворум: <span class="badge ${m.stats.quorumReached ? 'badge-success' : 'badge-warn'}">${m.stats.quorumReached ? 'достигнут' : 'не достигнут'}</span></p>
          <div class="flex mt">
            <button class="btn btn-secondary" data-action="remindAll" data-id="${m.voting.id}">Напомнить всем</button>
            <button class="btn btn-primary" data-action="finalize" data-id="${m.voting.id}">Завершить</button>
          </div>
        </div>
        <div class="card table-wrap">
          <table class="table">
            <thead><tr><th>Кв.</th><th>Собственник</th><th>Площадь</th><th>Статус</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderAdmin() {
    const d = this.state.data || {};
    return `
      ${this.renderNav()}
      <div class="container">
        <h1>Админ-панель</h1>
        <div class="row mb">
          <div class="card center"><h2>${d.propertiesCount || 0}</h2><p class="muted">квартир</p></div>
          <div class="card center"><h2>${d.usersCount || 0}</h2><p class="muted">пользователей</p></div>
          <div class="card center"><h2>${d.activeUsers || 0}</h2><p class="muted">подтверждено</p></div>
          <div class="card center"><h2>${d.pendingRequests || 0}</h2><p class="muted">заявок</p></div>
        </div>
        <div class="card">
          <button class="btn btn-primary btn-block mb" data-action="adminRequests">Заявки</button>
          <button class="btn btn-secondary btn-block mb" data-action="adminProperties">Квартиры</button>
          <button class="btn btn-secondary btn-block mb" data-action="adminUsers">Пользователи</button>
          <button class="btn btn-secondary btn-block mb" data-action="adminVotings">Голосования</button>
          <button class="btn btn-secondary btn-block mb" data-action="adminLogs">Журнал</button>
          <button class="btn btn-secondary btn-block" data-action="adminSettings">Настройки</button>
        </div>
      </div>
    `;
  },

  renderAdminVotings() {
    const list = this.state.data || [];
    const items = list.map(v => `
      <div class="card">
        <h3>${this.esc(v.title)} <span class="badge ${v.status === 'active' ? 'badge-success' : v.status === 'draft' ? 'badge-muted' : 'badge-warn'}">${v.status}</span></h3>
        <p class="muted">${this.formatDate(v.start_date)} — ${this.formatDate(v.end_date)}</p>
        <p class="muted">Проголосовало: ${v.votedCount} из ${v.totalUsers}</p>
        <div class="flex mt">
          ${v.status === 'draft' ? `<button class="btn btn-primary btn-sm" data-action="publish" data-id="${v.id}">Опубликовать</button>` : ''}
          ${v.status === 'active' ? `<button class="btn btn-primary btn-sm" data-action="monitor" data-id="${v.id}">Мониторинг</button>` : ''}
          ${v.status === 'finished' ? `<button class="btn btn-secondary btn-sm" data-action="protocol" data-id="${v.id}">Протокол</button>` : ''}
        </div>
      </div>
    `).join('');
    return `
      ${this.renderNav()}
      <div class="container">
        <button class="btn btn-secondary btn-sm mb" data-action="adminBack">← Назад</button>
        <h1>Голосования</h1>
        <button class="btn btn-primary btn-block mb" data-action="createVoting">+ Создать голосование</button>
        ${items || '<p class="muted">Нет голосований</p>'}
      </div>
    `;
  },

  renderAdminRequests() {
    const list = this.state.data || [];
    const rows = list.map(r => `
      <tr>
        <td>${this.esc(r.fio)}</td>
        <td>${this.esc(r.property_number)}</td>
        <td>${r.property_area}</td>
        <td>
          <button class="btn btn-primary btn-sm" data-action="approve" data-id="${r.id}">✓</button>
          <button class="btn btn-danger btn-sm" data-action="reject" data-id="${r.id}">✗</button>
        </td>
      </tr>
    `).join('');
    return `
      ${this.renderNav()}
      <div class="container">
        <button class="btn btn-secondary btn-sm mb" data-action="adminBack">← Назад</button>
        <h1>Заявки на регистрацию</h1>
        <div class="card table-wrap">
          <table class="table">
            <thead><tr><th>ФИО</th><th>Кв.</th><th>Площадь</th><th>Действия</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4" class="muted">Нет заявок</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderAdminProperties() {
    const list = this.state.data || [];
    const rows = list.map(p => `
      <tr>
        <td>${this.esc(p.number)}</td>
        <td>${p.area}</td>
        <td>${this.esc(p.share)}</td>
        <td>${p.owners_count}</td>
        <td>${p.status}</td>
        <td>
          <button class="btn btn-secondary btn-sm" data-action="editProperty" data-id="${p.id}">✎</button>
          <button class="btn btn-danger btn-sm" data-action="deleteProperty" data-id="${p.id}">×</button>
        </td>
      </tr>
    `).join('');
    return `
      ${this.renderNav()}
      <div class="container">
        <button class="btn btn-secondary btn-sm mb" data-action="adminBack">← Назад</button>
        <div class="flex between mb">
          <h1>База квартир</h1>
          <button class="btn btn-primary btn-sm" data-action="editProperty" data-id="">+ Добавить</button>
        </div>
        <div class="card table-wrap">
          <table class="table">
            <thead><tr><th>№</th><th>Площадь</th><th>Доля</th><th>Собств.</th><th>Статус</th><th></th></tr></thead>
            <tbody>${rows || '<tr><td colspan="6" class="muted">Нет данных</td></tr>'}</tbody>
          </table>
        </div>
        <button class="btn btn-secondary btn-block mt" data-action="exportProperties">Экспорт CSV</button>
      </div>
      ${this.state.params.editProperty ? this.renderPropertyModal() : ''}
    `;
  },

  renderPropertyModal() {
    const p = this.state.params.editProperty;
    return `
      <div class="modal-overlay">
        <div class="modal">
          <h2>${p.id ? 'Редактирование' : 'Новая'} квартира</h2>
          <label class="label">Номер</label>
          <input class="input" id="pNumber" value="${this.esc(p.number || '')}">
          <label class="label">Площадь, м²</label>
          <input class="input" id="pArea" type="number" step="0.01" value="${p.area || ''}">
          <label class="label">Доля</label>
          <input class="input" id="pShare" value="${this.esc(p.share || '')}">
          <label class="label">Собственников</label>
          <input class="input" id="pOwners" type="number" value="${p.owners_count || 1}">
          <div id="propError" class="error"></div>
          <div class="flex mt">
            <button class="btn btn-secondary" data-action="propCancel">Отмена</button>
            <button class="btn btn-primary" data-action="propSave" data-id="${p.id || ''}">Сохранить</button>
          </div>
        </div>
      </div>
    `;
  },

  renderAdminUsers() {
    const list = this.state.data || [];
    const rows = list.map(u => `
      <tr>
        <td>${this.esc(u.fio)}</td>
        <td>${u.username ? '@' + this.esc(u.username) : ''}</td>
        <td>${u.role}</td>
        <td>${u.status}</td>
      </tr>
    `).join('');
    return `
      ${this.renderNav()}
      <div class="container">
        <button class="btn btn-secondary btn-sm mb" data-action="adminBack">← Назад</button>
        <h1>Пользователи</h1>
        <div class="card table-wrap">
          <table class="table">
            <thead><tr><th>ФИО</th><th>Telegram</th><th>Роль</th><th>Статус</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4" class="muted">Нет данных</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderAdminSettings() {
    const s = this.state.data || {};
    return `
      ${this.renderNav()}
      <div class="container">
        <button class="btn btn-secondary btn-sm mb" data-action="adminBack">← Назад</button>
        <h1>Настройки</h1>
        <div class="card">
          <label class="label">Название системы</label>
          <input class="input" id="setTitle" value="${this.esc(s.app_title || '')}">
          <label class="label">Порог кворума, %</label>
          <input class="input" id="setQuorum" type="number" value="${s.quorum_threshold || 50}">
          <label class="label">Порог принятия, %</label>
          <input class="input" id="setApproval" type="number" value="${s.approval_threshold || 50}">
          <label class="label">Провайдер подписи</label>
          <select class="input" id="setSignProvider">
            <option value="telegram" ${s.signature_provider === 'telegram' ? 'selected' : ''}>Telegram (простая ЭП)</option>
            <option value="gossuok" ${s.signature_provider === 'gossuok' ? 'selected' : ''}>ГосСУОК (Этап 2)</option>
          </select>
          <label class="label">Токен Telegram-бота</label>
          <input class="input" id="setTgToken" type="password" placeholder="${s.telegram_bot_token ? '*** (оставьте пустым, чтобы не менять)' : 'вставьте токен'}">
          <label class="label">Username бота (без @)</label>
          <input class="input" id="setTgUsername" value="${this.esc(s.telegram_bot_username || '')}">
          <label class="label">Секрет webhook</label>
          <input class="input" id="setTgSecret" type="password" placeholder="опционально">
          <button class="btn btn-primary btn-block mt" data-action="saveSettings">Сохранить</button>
        </div>
      </div>
    `;
  },

  renderAdminLogs() {
    const list = this.state.data || [];
    const rows = list.map(l => `
      <tr>
        <td>${this.formatDate(l.timestamp)}</td>
        <td>${this.esc(l.user_id)}</td>
        <td>${this.esc(l.action)}</td>
        <td>${this.esc(l.object)}</td>
      </tr>
    `).join('');
    return `
      ${this.renderNav()}
      <div class="container">
        <button class="btn btn-secondary btn-sm mb" data-action="adminBack">← Назад</button>
        <h1>
