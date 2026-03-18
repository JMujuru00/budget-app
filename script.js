  const STORAGE_KEY = 'budget-planner-v1';
  let uid = 100;

  const defaults = {
    freq: '1',
    income: [
      { id: uid++, name: 'Salary', amount: '' }
    ],
    outgoing: [
      { id: uid++, name: 'Rent / mortgage', amount: '' },
      { id: uid++, name: 'Groceries', amount: '' },
      { id: uid++, name: 'Utilities', amount: '' }
    ]
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        // find max id to avoid collisions
        const allIds = [...(data.income||[]), ...(data.outgoing||[])].map(i => i.id || 0);
        uid = Math.max(uid, ...allIds) + 1;
        return data;
      }
    } catch(e) {}
    return JSON.parse(JSON.stringify(defaults));
  }

  function save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
  }

  let state = load();

  function getState() { return state; }

  function fmt(val) {
    const freq = parseFloat(document.getElementById('freq').value) || 1;
    const scaled = val * freq;
    return '£' + scaled.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function renderList(type) {
    const list = document.getElementById(type + '-list');
    list.innerHTML = '';
    state[type].forEach(item => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <input type="text" placeholder="${type === 'income' ? 'Source name' : 'Expense name'}"
          value="${escHtml(item.name)}"
          oninput="update('${type}',${item.id},'name',this.value)" />
        <div class="input-prefix">
          <span>£</span>
          <input type="number" placeholder="0" min="0" step="0.01"
            value="${item.amount !== '' ? item.amount : ''}"
            oninput="update('${type}',${item.id},'amount',this.value)" />
        </div>
        <button class="del-btn" onclick="remove('${type}',${item.id})" title="Remove">×</button>
      `;
      list.appendChild(row);
    });
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function update(type, id, field, value) {
    const item = state[type].find(i => i.id === id);
    if (item) item[field] = field === 'amount' ? value : value;
    recalc();
    save(state);
  }

  function addItem(type) {
    state[type].push({ id: uid++, name: '', amount: '' });
    renderList(type);
    recalc();
    save(state);
    // focus the new name input
    const list = document.getElementById(type + '-list');
    const inputs = list.querySelectorAll('input[type="text"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }

  function remove(type, id) {
    state[type] = state[type].filter(i => i.id !== id);
    renderList(type);
    recalc();
    save(state);
  }

  function recalc() {
    const totalIn  = state.income.reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
    const totalOut = state.outgoing.reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
    const left     = totalIn - totalOut;
    const max      = Math.max(totalIn, 0.01);

    document.getElementById('total-income').textContent  = fmt(totalIn);
    document.getElementById('total-outgoing').textContent = fmt(totalOut);
    document.getElementById('sec-income').textContent    = fmt(totalIn);
    document.getElementById('sec-outgoing').textContent  = fmt(totalOut);

    const leftEl = document.getElementById('left-over');
    leftEl.textContent = fmt(left);
    leftEl.className = 'card-value' + (left > 0 ? ' positive' : left < 0 ? ' negative' : '');

    const iPct = Math.min(100, Math.round((totalIn  / max) * 100));
    const oPct = Math.min(100, Math.round((totalOut / max) * 100));
    const lPct = left >= 0 ? Math.min(100, Math.round((left / max) * 100)) : 0;

    document.getElementById('bar-i').style.width = iPct + '%';
    document.getElementById('bar-o').style.width = oPct + '%';
    document.getElementById('bar-l').style.width = lPct + '%';

    if (totalIn > 0) {
      document.getElementById('pct-i').textContent = '100%';
      document.getElementById('pct-o').textContent = Math.round((totalOut / totalIn) * 100) + '%';
      document.getElementById('pct-l').textContent = Math.round((Math.max(0, left) / totalIn) * 100) + '%';
    } else {
      document.getElementById('pct-i').textContent = '—';
      document.getElementById('pct-o').textContent = '—';
      document.getElementById('pct-l').textContent = '—';
    }
  }

  // Frequency change
  document.getElementById('freq').addEventListener('change', function() {
    state.freq = this.value;
    save(state);
    recalc();
  });

  // Init
  document.getElementById('freq').value = state.freq || '1';
  renderList('income');
  renderList('outgoing');
  recalc();