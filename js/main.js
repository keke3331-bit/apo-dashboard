import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCVpNsLGXG3jiXA-qJOA7srTwyvsvJAA7s",
  authDomain: "apo-dashboard.firebaseapp.com",
  databaseURL: "https://apo-dashboard-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "apo-dashboard",
  storageBucket: "apo-dashboard.firebasestorage.app",
  messagingSenderId: "609387249406",
  appId: "1:609387249406:web:d196a510ebec4868256faf"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

const STAFF = ['井戸', '関根', '柴', '片桐', '入江', '金', '玉井', '新田', '菊池'];
const METRICS = [
  { key: 'call_phone', label: '架電(電話)', color: '#2563EB' },
  { key: 'call_line',  label: '架電(LINE)', color: '#7C3AED' },
  { key: 'talk',       label: '通話数',     color: '#0891B2' },
  { key: 'appo',       label: 'アポ数',     color: '#10B981' },
  { key: 'asset',      label: '見込みasset', color: '#F59E0B' },
];

/* ─── Date helpers ─── */
function toISO(date) { return date.toISOString().slice(0, 10); }
function parseISO(str) { const [y,m,d] = str.split('-').map(Number); return new Date(y, m-1, d); }
function getWeekStart(date) { const d = new Date(date); d.setDate(d.getDate() - d.getDay()); return d; }
function getWeekDates(ws) {
  return Array.from({length:7}, (_,i) => { const d = new Date(ws); d.setDate(d.getDate()+i); return toISO(d); });
}
function getMonthDates(y, m) {
  const days = new Date(y, m, 0).getDate();
  return Array.from({length:days}, (_,i) =>
    `${y}-${String(m).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`);
}

/* ─── Aggregate ─── */
function aggregate(allData, dates) {
  const result = {};
  STAFF.forEach(n => { result[n] = {call_phone:0, call_line:0, talk:0, appo:0, asset:0}; });
  if (!allData) return result;
  dates.forEach(dateStr => {
    const day = allData[dateStr];
    if (!day) return;
    STAFF.forEach(name => {
      if (!day[name]) return;
      METRICS.forEach(({key}) => { result[name][key] += Number(day[name][key] || 0); });
    });
  });
  return result;
}

/* ─── Hamburger ─── */
function initHamburger() {
  const btn = document.querySelector('.hamburger');
  const nav = document.querySelector('.header__nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => { btn.classList.toggle('open'); nav.classList.toggle('open'); });
}

/* ─── Toast ─── */
function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

/* ─── Dashboard ─── */
function initDashboard() {
  if (!document.getElementById('chart-canvas')) return;

  let periodType  = 'daily';
  let currentDate = new Date();
  let chartInstance = null;
  let activeMetric  = 'call_phone';
  let cachedData    = null;

  const periodSelect = document.getElementById('period-select');
  const dateInput    = document.getElementById('date-input');
  const btnPrev      = document.getElementById('btn-prev');
  const btnNext      = document.getElementById('btn-next');
  dateInput.value    = toISO(currentDate);

  function getDates() {
    if (periodType === 'daily')   return [toISO(currentDate)];
    if (periodType === 'weekly')  return getWeekDates(getWeekStart(currentDate));
    return getMonthDates(currentDate.getFullYear(), currentDate.getMonth()+1);
  }
  function getPeriodLabel() {
    if (periodType === 'daily')  return toISO(currentDate);
    if (periodType === 'weekly') {
      const ws = getWeekStart(currentDate);
      const we = new Date(ws); we.setDate(we.getDate()+6);
      return `${toISO(ws)} 〜 ${toISO(we)}`;
    }
    return `${currentDate.getFullYear()}年${currentDate.getMonth()+1}月`;
  }
  function move(dir) {
    if (periodType === 'daily')   currentDate.setDate(currentDate.getDate()+dir);
    if (periodType === 'weekly')  currentDate.setDate(currentDate.getDate()+dir*7);
    if (periodType === 'monthly') currentDate.setMonth(currentDate.getMonth()+dir);
    dateInput.value = toISO(currentDate);
    render();
  }

  function render() {
    const dates = getDates();
    const agg   = aggregate(cachedData, dates);

    METRICS.forEach(({key}) => {
      const el = document.getElementById(`sum-${key}`);
      if (el) el.textContent = STAFF.reduce((s,n) => s+agg[n][key], 0).toLocaleString();
    });
    const label = document.getElementById('period-label');
    if (label) label.textContent = getPeriodLabel();

    const metric = METRICS.find(m => m.key === activeMetric);
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(document.getElementById('chart-canvas'), {
      type: 'bar',
      data: {
        labels: STAFF,
        datasets: [{ label: metric.label, data: STAFF.map(n => agg[n][activeMetric]),
          backgroundColor: metric.color+'CC', borderColor: metric.color,
          borderWidth:1, borderRadius:4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero:true, ticks:{stepSize:1}, grid:{color:'#F1F5F9'} },
          x: { grid:{ display:false } }
        }
      }
    });

    const tbody = document.getElementById('table-body');
    const tfoot = document.getElementById('table-foot');
    if (!tbody) return;
    tbody.innerHTML = '';
    const totals = {call_phone:0, call_line:0, talk:0, appo:0, asset:0};
    STAFF.forEach(name => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${name}</td>` +
        METRICS.map(({key}) => { totals[key]+=agg[name][key]; return `<td>${agg[name][key]||0}</td>`; }).join('');
      tbody.appendChild(row);
    });
    if (tfoot) {
      tfoot.innerHTML = `<tr><td>合計</td>` +
        METRICS.map(({key}) => `<td><strong>${totals[key]}</strong></td>`).join('') + `</tr>`;
    }
  }

  // リアルタイム同期
  onValue(ref(db, 'apo_data'), snapshot => {
    cachedData = snapshot.val() || {};
    render();
  });

  periodSelect.addEventListener('change', e => { periodType = e.target.value; render(); });
  dateInput.addEventListener('change',   e => { currentDate = parseISO(e.target.value); render(); });
  btnPrev.addEventListener('click', () => move(-1));
  btnNext.addEventListener('click', () => move(1));
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeMetric = btn.dataset.metric;
      render();
    });
  });
}

/* ─── Input page ─── */
async function loadEntryToForm(date, staff) {
  const snap  = await get(ref(db, `apo_data/${date}/${staff}`));
  if (!snap.exists()) return false;
  const entry = snap.val();
  METRICS.forEach(({key}) => { const el = document.getElementById(key); if (el) el.value = entry[key]||0; });
  return true;
}

function setEditMode(active, label) {
  const banner = document.getElementById('edit-banner');
  const text   = document.getElementById('edit-banner-text');
  if (!banner) return;
  banner.classList.toggle('show', active);
  if (text && label) text.textContent = label;
}

async function checkAndFill() {
  const staff = document.getElementById('staff-select').value;
  const date  = document.getElementById('date-input').value;
  if (!staff || !date) { setEditMode(false); return; }
  const found = await loadEntryToForm(date, staff);
  setEditMode(found, `${staff}（${date}）`);
}

function initInput() {
  const form = document.getElementById('input-form');
  if (!form) return;

  document.getElementById('date-input').value = toISO(new Date());
  renderHistory();

  document.getElementById('staff-select').addEventListener('change', checkAndFill);
  document.getElementById('date-input').addEventListener('change',   checkAndFill);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const staff   = document.getElementById('staff-select').value;
    const date    = document.getElementById('date-input').value;
    if (!staff || !date) { showToast('担当者と日付を選択してください'); return; }

    const saveBtn = form.querySelector('button[type="submit"]');
    saveBtn.textContent = '保存中…'; saveBtn.disabled = true;
    try {
      await set(ref(db, `apo_data/${date}/${staff}`), {
        call_phone: Number(document.getElementById('call_phone').value) || 0,
        call_line:  Number(document.getElementById('call_line').value)  || 0,
        talk:       Number(document.getElementById('talk').value)       || 0,
        appo:       Number(document.getElementById('appo').value)       || 0,
        asset:      Number(document.getElementById('asset').value)      || 0,
      });
      showToast('✅ 保存しました');
      setEditMode(true, `${staff}（${date}）`);
      renderHistory();
    } catch { showToast('⚠️ 保存に失敗しました'); }
    finally  { saveBtn.textContent = '保存する'; saveBtn.disabled = false; }
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    METRICS.forEach(({key}) => { const el = document.getElementById(key); if (el) el.value = ''; });
    setEditMode(false);
  });
}

async function renderHistory() {
  const tbody = document.getElementById('history-body');
  if (!tbody) return;
  const snap = await get(ref(db, 'apo_data'));
  const data = snap.val() || {};
  const rows = [];
  Object.keys(data).sort().reverse().forEach(date => {
    Object.keys(data[date]).forEach(name => rows.push({date, name, ...data[date][name]}));
  });
  tbody.innerHTML = '';
  rows.slice(0, 5).forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.date}</td><td>${r.name}</td>` +
      METRICS.map(({key}) => `<td>${r[key]||0}</td>`).join('') +
      `<td><button class="btn-edit" data-date="${r.date}" data-name="${r.name}">編集</button></td>`;
    tbody.appendChild(tr);
  });
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#9CA3AF;padding:20px">データがありません</td></tr>';
  }
  tbody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const {date, name} = btn.dataset;
      document.getElementById('staff-select').value = name;
      document.getElementById('date-input').value   = date;
      await loadEntryToForm(date, name);
      setEditMode(true, `${name}（${date}）`);
      document.getElementById('input-form').scrollIntoView({behavior:'smooth'});
    });
  });
}

/* ─── Init ─── */
document.addEventListener('DOMContentLoaded', () => {
  initHamburger();
  initDashboard();
  initInput();
});
