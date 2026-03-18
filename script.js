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
  ],
  groups: [] // { id, name, collapsed, items: [{id, name, amount}] }
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (!data.groups) data.groups = [];
      const allIds = [
        ...(data.income || []),
        ...(data.outgoing || []),
        ...(data.groups || []).flatMap(g => [g, ...(g.items || [])])
      ].map(i => i.id || 0);
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

function fmt(val) {
  const freq = parseFloat(document.getElementById('freq').value) || 1;
  const scaled = val * freq;
  return '£' + scaled.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Flat items (income + ungrouped outgoings) ── */
function renderList(type) {
  const list = document.getElementById(type + '-list');
  list.innerHTML = '';
  state[type].forEach(item => {
    list.appendChild(makeItemRow(type, item, null));
  });
  if (type === 'outgoing') renderGroups();
}

function makeItemRow(type, item, groupId) {
  const row = document.createElement('div');
  row.className = 'row' + (groupId !== null ? ' group-item' : '');
  row.dataset.id = item.id;
  const namePh = type === 'income' ? 'Source name' : 'Expense name';
  row.innerHTML = `
    <input type="text" placeholder="${namePh}"
      value="${escHtml(item.name)}"
      oninput="${groupId !== null
        ? `updateGroupItem(${groupId},${item.id},'name',this.value)`
        : `update('${type}',${item.id},'name',this.value)`}" />
    <div class="input-prefix">
      <span>£</span>
      <input type="number" placeholder="0" min="0" step="0.01"
        value="${item.amount !== '' ? item.amount : ''}"
        oninput="${groupId !== null
          ? `updateGroupItem(${groupId},${item.id},'amount',this.value)`
          : `update('${type}',${item.id},'amount',this.value)`}" />
    </div>
    <button class="del-btn" title="Remove"
      onclick="${groupId !== null
        ? `removeGroupItem(${groupId},${item.id})`
        : `remove('${type}',${item.id})`}">×</button>
  `;
  return row;
}

/* ── Groups ── */
function renderGroups() {
  // remove existing group blocks from the outgoing list area
  const container = document.getElementById('outgoing-list');
  container.querySelectorAll('.group-block').forEach(el => el.remove());

  state.groups.forEach(group => {
    const total = group.items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const block = document.createElement('div');
    block.className = 'group-block';
    block.dataset.gid = group.id;

    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `
      <button class="group-toggle" onclick="toggleGroup(${group.id})" title="${group.collapsed ? 'Expand' : 'Collapse'}">
        <svg class="chevron ${group.collapsed ? 'collapsed' : ''}" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <input type="text" class="group-name-input" placeholder="Group name"
        value="${escHtml(group.name)}"
        oninput="updateGroupName(${group.id}, this.value)" />
      <span class="group-total">${fmt(total)}</span>
      <button class="del-btn" onclick="removeGroup(${group.id})" title="Remove group">×</button>
    `;
    block.appendChild(header);

    const body = document.createElement('div');
    body.className = 'group-body' + (group.collapsed ? ' hidden' : '');

    group.items.forEach(item => {
      body.appendChild(makeItemRow('outgoing', item, group.id));
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'add-btn add-btn-group';
    addBtn.textContent = '+ Add item';
    addBtn.onclick = () => addGroupItem(group.id);
    body.appendChild(addBtn);

    block.appendChild(body);
    container.appendChild(block);
  });
}

function addGroup() {
  const group = { id: uid++, name: '', collapsed: false, items: [{ id: uid++, name: '', amount: '' }] };
  state.groups.push(group);
  renderList('outgoing');
  recalc();
  save(state);
  // focus the group name input
  const container = document.getElementById('outgoing-list');
  const blocks = container.querySelectorAll('.group-block');
  const last = blocks[blocks.length - 1];
  if (last) last.querySelector('.group-name-input').focus();
}

function removeGroup(gid) {
  state.groups = state.groups.filter(g => g.id !== gid);
  renderList('outgoing');
  recalc();
  save(state);
}

function toggleGroup(gid) {
  const group = state.groups.find(g => g.id === gid);
  if (group) {
    group.collapsed = !group.collapsed;
    save(state);
    renderGroups();
  }
}

function updateGroupName(gid, value) {
  const group = state.groups.find(g => g.id === gid);
  if (group) { group.name = value; save(state); }
}

function addGroupItem(gid) {
  const group = state.groups.find(g => g.id === gid);
  if (!group) return;
  group.items.push({ id: uid++, name: '', amount: '' });
  renderGroups();
  recalc();
  save(state);
  // focus last item name input in this group
  const block = document.querySelector(`.group-block[data-gid="${gid}"]`);
  if (block) {
    const inputs = block.querySelectorAll('.group-item input[type="text"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }
}

function removeGroupItem(gid, itemId) {
  const group = state.groups.find(g => g.id === gid);
  if (group) {
    group.items = group.items.filter(i => i.id !== itemId);
    renderGroups();
    recalc();
    save(state);
  }
}

function updateGroupItem(gid, itemId, field, value) {
  const group = state.groups.find(g => g.id === gid);
  if (group) {
    const item = group.items.find(i => i.id === itemId);
    if (item) item[field] = value;
    recalc();
    save(state);
    // update group total in header without full re-render
    const total = group.items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const block = document.querySelector(`.group-block[data-gid="${gid}"]`);
    if (block) {
      const totalEl = block.querySelector('.group-total');
      if (totalEl) totalEl.textContent = fmt(total);
    }
  }
}

/* ── Flat item CRUD ── */
function update(type, id, field, value) {
  const item = state[type].find(i => i.id === id);
  if (item) item[field] = value;
  recalc();
  save(state);
}

function addItem(type) {
  state[type].push({ id: uid++, name: '', amount: '' });
  renderList(type);
  recalc();
  save(state);
  const list = document.getElementById(type + '-list');
  const inputs = list.querySelectorAll(':scope > .row input[type="text"]');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

function remove(type, id) {
  state[type] = state[type].filter(i => i.id !== id);
  renderList(type);
  recalc();
  save(state);
}

/* ── Recalc ── */
function recalc() {
  const totalIn  = state.income.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const flatOut  = state.outgoing.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const groupOut = state.groups.reduce((s, g) =>
    s + g.items.reduce((gs, i) => gs + (parseFloat(i.amount) || 0), 0), 0);
  const totalOut = flatOut + groupOut;
  const left     = totalIn - totalOut;
  const max      = Math.max(totalIn, 0.01);

  document.getElementById('total-income').textContent   = fmt(totalIn);
  document.getElementById('total-outgoing').textContent = fmt(totalOut);
  document.getElementById('sec-income').textContent     = fmt(totalIn);
  document.getElementById('sec-outgoing').textContent   = fmt(totalOut);

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
    ['pct-i','pct-o','pct-l'].forEach(id => document.getElementById(id).textContent = '—');
  }
}

/* ── Frequency ── */
document.getElementById('freq').addEventListener('change', function() {
  state.freq = this.value;
  save(state);
  recalc();
  // re-render group totals with new freq
  renderGroups();
});

/* ── Init ── */
document.getElementById('freq').value = state.freq || '1';
renderList('income');
renderList('outgoing');
recalc();
