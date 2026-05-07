import {
  savePopularityOnline,
  loadPopularityOnline,
  saveSavingOnline,
  loadSavingsOnline,
  hasSubmittedTodayOnline,
  markSubmittedTodayOnline,
  getCurrentUID
} from "./firebase.js";
/* ============================================================
   물방울 급식 알리미 — 영신여자고등학교 script.js
   NEIS API: ATPT_OFCDC_SC_CODE=B10, SD_SCHUL_CODE=7010215
   ============================================================ */

// ── 학교 정보 ──────────────────────────────────────────────
// NEIS API는 브라우저에서 직접 호출 시 CORS 오류 발생
// → Vercel 서버리스 함수(/api/meal)를 프록시로 사용
const SCHOOL_CONFIG = {
  ATPT: 'B10',
  CODE: '7010215',
  KEY:  '4b167196e8cb474ab525e6f844749e87',
  API_PROXY: '/api/meal'   // Vercel 서버리스 프록시 엔드포인트
};

// ── 음식별 정화 필요 수자원 추정량 (리터) ─────────────────
const WATER_PER_FOOD = {
  '밥': 45, '쌀': 45, '잡곡밥': 50, '현미밥': 50, '콩밥': 55,
  '비빔밥': 120, '볶음밥': 100, '덮밥': 110, '죽': 60,
  '국수': 95, '우동': 90, '라면': 110, '스파게티': 105, '파스타': 105,
  '빵': 70, '토스트': 75, '샌드위치': 90, '피자': 130,
  '국': 30, '찌개': 80, '된장찌개': 90, '김치찌개': 85,
  '부대찌개': 100, '순두부찌개': 85, '미역국': 35,
  '탕': 80, '해장국': 75, '갈비탕': 110, '설렁탕': 100,
  '냉국': 25, '콩나물국': 30,
  '돈까스': 250, '돈카츠': 250, '불고기': 200, '갈비': 220,
  '제육볶음': 180, '삼겹살': 230, '닭갈비': 190, '치킨': 210,
  '햄버거스테이크': 220, '미트볼': 160, '너겟': 170,
  '삼계탕': 180, '닭볶음탕': 190, '찜닭': 185,
  '떡갈비': 195, '육전': 170, '동그랑땡': 150,
  '생선': 130, '고등어': 140, '갈치': 135, '연어': 150,
  '새우': 160, '오징어': 155, '낙지': 160, '조개': 140,
  '명란': 120, '어묵': 90, '맛살': 80,
  '두부': 80, '순두부': 75, '계란': 60, '달걀': 60,
  '계란후라이': 65, '계란볶음': 68, '스크램블': 65,
  '김치': 35, '깍두기': 33, '총각김치': 34, '백김치': 30,
  '깻잎절임': 28, '장아찌': 30, '피클': 25,
  '나물': 40, '시금치': 35, '콩나물': 30, '무': 28,
  '샐러드': 55, '겉절이': 40, '상추': 30, '오이': 28,
  '떡볶이': 120, '순대': 110, '튀김': 130, '만두': 105,
  '핫도그': 120, '와플': 85, '크레페': 80,
  '요구르트': 40, '우유': 30, '과일': 25, '주스': 20,
  '아이스크림': 60, '케이크': 80, '쿠키': 55,
  'DEFAULT': 80
};

// ── 절약 수자원 비유 ──────────────────────────────────────
const WATER_EQUIV = [
  { min: 1,    max: 10,   text: (v) => `양치질 약 ${Math.round(v/0.6)}회 분량에 해당합니다. 학생 여러분의 실천이 환경 보호에 큰 힘이 됩니다.` },
  { min: 10,   max: 50,   text: (v) => `세면대 세수 약 ${Math.round(v/5)}회 분량의 수자원입니다.` },
  { min: 50,   max: 100,  text: (v) => `변기 물 내림 약 ${Math.round(v/6)}회에 해당하는 수자원입니다.` },
  { min: 100,  max: 200,  text: (v) => `4분 샤워 약 ${Math.round(v/48)}회 분량에 해당합니다.` },
  { min: 200,  max: 500,  text: (v) => `화분 ${Math.round(v/2)}개에 공급할 수 있는 수자원입니다.` },
  { min: 500,  max: 1000, text: (v) => `세탁기 ${(v/60).toFixed(1)}회를 가동할 수 있는 수자원입니다.` },
  { min: 1000, max: 3000, text: (v) => `약 ${(v/1000).toFixed(1)}m² 크기의 농지에 공급 가능한 수량입니다.` },
  { min: 3000, max: Infinity, text: (v) => `표준 욕조 ${(v/150).toFixed(1)}개를 가득 채울 수 있는 수자원입니다. 훌륭한 실천입니다.` }
];

// ── 상태 ──────────────────────────────────────────────────
let todayMealData = [];
let checkedItems = new Set();
let calCheckedItems = new Set();
let savedToday = 0;

// ── 날짜 유틸 ─────────────────────────────────────────────
function getToday() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}
function getTodayDisplay() {
  const d = new Date();
  const weeks = ['일','월','화','수','목','금','토'];
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${weeks[d.getDay()]})`;
}
function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const mon = new Date(today);
  mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const key = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    return { key, date: d, label: `${d.getMonth()+1}/${d.getDate()}` };
  });
}
function getCurrentMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

// ── 절약량 캐시 (Firestore에서 불러온 값을 메모리에 보관) ──
// Firestore는 비동기이므로 최초 로드 후 메모리에 캐시합니다.
let savingsCache = null;

async function loadSavings() {
  if (savingsCache) return savingsCache;
  savingsCache = await loadSavingsOnline();
  return savingsCache;
}

async function saveSaving(dateKey, liters) {
  // 기존 값에 누적 합산
  const current = savingsCache ? (savingsCache[dateKey] || 0) : 0;
  const newVal  = current + liters;
  // Firestore에 저장
  await saveSavingOnline(dateKey, newVal);
  // 캐시 갱신
  if (savingsCache) savingsCache[dateKey] = newVal;
}

// ── 수자원 추정 ───────────────────────────────────────────
function estimateWater(menuName) {
  const clean = menuName.replace(/[\d.]+/g, '').trim();
  for (const [key, val] of Object.entries(WATER_PER_FOOD)) {
    if (key === 'DEFAULT') continue;
    if (clean.includes(key)) return val;
  }
  return WATER_PER_FOOD['DEFAULT'];
}

function parseCalInfo(calInfoStr) {
  if (!calInfoStr) return 0;
  const match = calInfoStr.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

// ── NEIS API 호출 ─────────────────────────────────────────
// Vercel 서버리스 함수(/api/meal)를 경유하여 CORS 없이 호출
async function fetchMeal(dateStr) {
  const proxyUrl = `${SCHOOL_CONFIG.API_PROXY}?date=${dateStr}`;

  try {
    const res  = await fetch(proxyUrl);
    const json = await res.json();
    if (!json.mealServiceDietInfo) return null;
    const rows = json.mealServiceDietInfo[1]?.row;
    if (!rows || rows.length === 0) return null;
    return rows.find(r => r.MMEAL_SC_CODE === '2') || rows[0];
  } catch (e) {
    console.warn('NEIS API 연동 오류:', e);
    return null;
  }
}

function parseMealNames(ddishNm) {
  return ddishNm
    .split('<br/>')
    .map(s => s
      .replace(/[\d.]+/g, '')       // 알레르기 번호(숫자·점) 제거
      .replace(/\([^)]*\)/g, '')    // 괄호 및 괄호 안 내용 제거 (원산지 등)
      .replace(/\s+/g, ' ')         // 연속 공백 정리
      .trim()
    )
    .filter(s => s.length > 0);
}

// ── 초기화 ────────────────────────────────────────────────
async function initApp() {
  document.getElementById('cover-date-text').textContent = getTodayDisplay();
  await updateRecordChips();
  await updateStatMini();

  const meal = await fetchMeal(getToday());

  if (!meal) {
    document.getElementById('cover-menu-list').innerHTML = `
      <div style="text-align:center;padding:2rem;color:var(--text-sub);font-size:0.95rem;line-height:1.8;">
        <i class="fa-solid fa-utensils" style="font-size:2rem;display:block;margin-bottom:0.8rem;opacity:0.3;"></i>
        금일은 급식 정보가 존재하지 않습니다.<br/>
        <small>주말, 방학, 공휴일이거나 아직 식단이 등록되지 않았습니다.</small>
      </div>`;
    todayMealData = [];
    return;
  }

  const calInfo = parseCalInfo(meal.CAL_INFO);
  if (calInfo) document.getElementById('cover-cal').textContent = `${calInfo} kcal`;

  const names = parseMealNames(meal.DDISH_NM);
  todayMealData = names.map(name => ({
    name,
    waterL: estimateWater(name),
    calPer: calInfo > 0 ? Math.round(calInfo / names.length) : 0
  }));

  renderCoverMenu();
  renderAnalyze();
  await renderCheck();
  renderCalorie(calInfo);
}

// ── 커버 메뉴 렌더 ────────────────────────────────────────
function renderCoverMenu() {
  const container = document.getElementById('cover-menu-list');
  if (!todayMealData.length) return;
  container.innerHTML = todayMealData.map(item => `
    <div class="menu-item-cover">
      <div class="menu-dot"></div>
      <span class="menu-name-text">${item.name}</span>
    </div>
  `).join('');
}

// ── 분석 렌더 ─────────────────────────────────────────────
function renderAnalyze() {
  const container = document.getElementById('analyze-list');
  if (!todayMealData.length) return;
  const sorted = [...todayMealData].sort((a,b) => b.waterL - a.waterL);
  const maxW = sorted[0].waterL;
  const total = sorted.reduce((s,i) => s + i.waterL, 0);

  container.innerHTML = sorted.map((item, idx) => `
    <div class="analyze-item" style="--i:${idx}">
      <div class="analyze-rank">
        <div class="rank-num">${idx+1}</div>
        <div class="rank-name">${item.name}</div>
        <div class="rank-water"><i class="fa-solid fa-droplet" style="margin-right:3px"></i>${item.waterL.toLocaleString()}L</div>
      </div>
      <div class="analyze-bar-track">
        <div class="analyze-bar-fill" data-w="${(item.waterL/maxW*100).toFixed(1)}"></div>
      </div>
    </div>
  `).join('');

  document.getElementById('analyze-total-box').innerHTML = `
    <div class="total-label">전체 잔반 발생 시 요구되는 정화 수자원 총량</div>
    <div class="total-val"><i class="fa-solid fa-droplet" style="color:var(--primary);margin-right:8px"></i>${total.toLocaleString()} L</div>
  `;

  setTimeout(() => {
    document.querySelectorAll('.analyze-bar-fill').forEach(el => {
      el.style.width = el.dataset.w + '%';
    });
  }, 100);
}

// ── 체크 렌더 ─────────────────────────────────────────────
async function renderCheck() {
  const container = document.getElementById('check-list');
  if (!todayMealData.length) return;

  const popularity = await loadPopularityOnline(getToday());
  const pop = popularity[getToday()] || {};

  container.innerHTML = todayMealData.map((item, idx) => {
    const count = pop[item.name] || 0;
    return `
      <div class="check-item ${checkedItems.has(idx) ? 'checked' : ''}"
           onclick="toggleCheck(${idx})" id="chk-item-${idx}">
        <div class="check-box"></div>
        <span class="check-item-name">${item.name}</span>
        <span class="check-item-pop">
          ${count > 0 ? `<i class="fa-solid fa-user"></i> ${count}명 완료` : ''}
        </span>
      </div>
    `;
  }).join('');
}

function toggleCheck(idx) {
  if (checkedItems.has(idx)) checkedItems.delete(idx);
  else checkedItems.add(idx);
  document.getElementById(`chk-item-${idx}`).classList.toggle('checked', checkedItems.has(idx));
}

// ── 1인 1회 제출 확인 (Firebase 익명 인증 기반) ───────────
// 익명 로그인으로 기기당 고유 UID를 발급받아
// Firestore에 당일 제출 여부를 저장합니다.
// 브라우저가 달라도 같은 기기라면 동일 UID가 유지됩니다.

// ── 확인 ──────────────────────────────────────────────────
async function confirmCheck() {
  if (!todayMealData.length) return;

  const btn = document.getElementById('btn-check-confirm');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 확인 중...';

  // Firebase에서 당일 제출 여부 조회
  const alreadySubmitted = await hasSubmittedTodayOnline(getToday());
  if (alreadySubmitted) {
    alert('금일 식단 제출은 이미 완료되었습니다.\n중복 제출은 허용되지 않습니다.');
    btn.disabled = true;
    btn.style.opacity = '0.45';
    btn.style.cursor = 'not-allowed';
    btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> 금일 제출 완료';
    return;
  }

  const totalWater = todayMealData.reduce((s,i) => s + i.waterL, 0);
  const leftoverWater = todayMealData
    .filter((_, idx) => !checkedItems.has(idx))
    .reduce((s,i) => s + i.waterL, 0);
  savedToday = totalWater - leftoverWater;

  // 인기도 저장 및 제출 완료 기록을 병렬 처리
  const popularityPromises = [...checkedItems]
    .map(idx => todayMealData[idx].name)
    .map(name => savePopularityOnline(getToday(), name));

  await Promise.all([
    ...popularityPromises,
    markSubmittedTodayOnline(getToday())
  ]);

  if (savedToday > 0) await saveSaving(getToday(), savedToday);
  await updateRecords();
  await updateStatMini();
  renderResult(savedToday, totalWater, leftoverWater);
  openPage('result');
}

// ── 결과 렌더 ─────────────────────────────────────────────
function renderResult(saved, total, leftover) {
  const savedBox = document.getElementById('result-saved-box');
  savedBox.innerHTML = saved <= 0
    ? `<div class="saved-volume">0</div>
       <div class="saved-unit">L — 금일은 음식을 남겼습니다.</div>
       <div style="margin-top:0.8rem;font-size:0.9rem;color:var(--text-sub)">다음에는 조금 더 남기지 않도록 노력해 봅시다.</div>`
    : `<div class="saved-volume">${saved.toLocaleString()}</div>
       <div class="saved-unit">L의 수자원을 절약하셨습니다.</div>`;

  const equivBox = document.getElementById('result-equiv-box');
  if (saved > 0) {
    const equiv = WATER_EQUIV.find(e => saved >= e.min && saved < e.max);
    equivBox.innerHTML = `<i class="fa-solid fa-lightbulb"></i> ${equiv ? equiv.text(saved) : '매우 우수한 절약량입니다.'}`;
    equivBox.style.display = '';
  } else {
    equivBox.style.display = 'none';
  }

  document.getElementById('result-detail').innerHTML = `
    전체 식단 기준 정화 요구량: <strong style="color:var(--primary)">${total.toLocaleString()}L</strong><br/>
    발생 잔반 기준 정화 요구량: <strong style="color:var(--accent)">${leftover.toLocaleString()}L</strong><br/>
    <small>※ 해당 수치는 음식물 BOD(생물화학적 산소요구량) 희석 기준으로 추정한 값입니다.</small>
  `;
}

// ── 칼로리 렌더 ───────────────────────────────────────────
function renderCalorie(totalCal) {
  document.getElementById('cal-total-box').innerHTML = `
    <span class="cal-total-label">금일 식단 총 열량</span>
    <span class="cal-total-val" style="color:var(--accent)">${totalCal > 0 ? totalCal + ' kcal' : '정보 없음'}</span>
  `;
  const container = document.getElementById('cal-check-list');
  if (!todayMealData.length) return;
  container.innerHTML = todayMealData.map((item, idx) => `
    <div class="check-item ${calCheckedItems.has(idx) ? 'checked' : ''}"
         onclick="toggleCalCheck(${idx}, ${totalCal})" id="cal-chk-${idx}">
      <div class="check-box"></div>
      <span class="check-item-name">${item.name}</span>
      <span class="check-item-pop">${item.calPer > 0 ? `약 ${item.calPer} kcal` : ''}</span>
    </div>
  `).join('');
  updateCalResult(totalCal);
}

function toggleCalCheck(idx, totalCal) {
  if (calCheckedItems.has(idx)) calCheckedItems.delete(idx);
  else calCheckedItems.add(idx);
  document.getElementById(`cal-chk-${idx}`).classList.toggle('checked', calCheckedItems.has(idx));
  updateCalResult(totalCal);
}

function updateCalResult(totalCal) {
  const eaten = [...calCheckedItems].reduce((s, idx) => s + (todayMealData[idx]?.calPer || 0), 0);
  const box = document.getElementById('cal-result-box');
  if (!calCheckedItems.size) {
    box.className = 'cal-result-box';
    box.innerHTML = '<span style="color:var(--text-sub)">식단을 선택하시면 열량이 자동 산출됩니다.</span>';
    return;
  }
  const pct = totalCal > 0 ? Math.round(eaten / totalCal * 100) : 0;
  const daily = Math.round(eaten / 2000 * 100);
  box.className = 'cal-result-box has-data';
  box.innerHTML = `
    <span class="cal-result-num" style="color:var(--accent);font-size:1.5rem;font-weight:bold;">${eaten.toLocaleString()} kcal</span>
    <div style="color:var(--text-main);margin-top:0.5rem;">금일 급식의 약 ${pct}% / 1일 권장량의 약 ${daily}% 해당</div>
  `;
}

// ── 수자원 절약 기록 (저금통) ─────────────────────────────
async function renderPiggyWeekly() {
  const savings = await loadSavings();
  const weekDates = getWeekDates();
  const todayKey = getToday();
  const headers = ['월','화','수','목','금','토','일'];
  let html = headers.map(h => `<div class="cal-header-cell">${h}</div>`).join('');
  let weekTotal = 0;
  weekDates.forEach(d => {
    const val = savings[d.key] || 0;
    weekTotal += val;
    const isToday = d.key === todayKey;
    html += `
      <div class="cal-cell ${val > 0 ? 'has-data' : ''} ${isToday ? 'today-cell' : ''}">
        <div class="cal-day">${d.date.getDate()}</div>
        ${val > 0 ? `<div class="cal-drop"><i class="fa-solid fa-droplet"></i>${val >= 1000 ? (val/1000).toFixed(1)+'k' : val}L</div>` : ''}
      </div>`;
  });
  document.getElementById('piggy-weekly-calendar').innerHTML = html;
  document.getElementById('piggy-weekly-summary').innerHTML = `
    <div class="piggy-sum-item">
      <div class="piggy-sum-label">이번 주 합계</div>
      <div class="piggy-sum-val">${weekTotal.toLocaleString()} L</div>
    </div>
    <div class="piggy-sum-item">
      <div class="piggy-sum-label">일 평균</div>
      <div class="piggy-sum-val">${(weekTotal / 7).toFixed(0)} L</div>
    </div>
    <div class="piggy-sum-item">
      <div class="piggy-sum-label">주간 누적</div>
      <div class="piggy-sum-val">${weekTotal.toLocaleString()} L</div>
    </div>
  `;
}

async function renderPiggyDaily() {
  const savings = await loadSavings();
  const { year, month } = getCurrentMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const todayKey = getToday();
  const headers = ['일','월','화','수','목','금','토'];
  let html = headers.map(h => `<div class="cal-header-cell">${h}</div>`).join('');
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-cell empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}${String(month+1).padStart(2,'0')}${String(d).padStart(2,'0')}`;
    const val = savings[key] || 0;
    const isToday = key === todayKey;
    html += `
      <div class="cal-cell ${val > 0 ? 'has-data' : ''} ${isToday ? 'today-cell' : ''}">
        <div class="cal-day">${d}</div>
        ${val > 0 ? `<div class="cal-drop"><i class="fa-solid fa-droplet"></i>${val >= 1000 ? (val/1000).toFixed(1)+'k' : val}L</div>` : ''}
      </div>`;
  }
  document.getElementById('piggy-daily-calendar').innerHTML = html;
}

async function switchPiggyTab(tab) {
  document.getElementById('tab-weekly-btn').classList.toggle('active', tab === 'weekly');
  document.getElementById('tab-daily-btn').classList.toggle('active', tab === 'daily');
  document.getElementById('piggy-weekly-view').style.display = tab === 'weekly' ? '' : 'none';
  document.getElementById('piggy-daily-view').style.display = tab === 'daily' ? '' : 'none';
  if (tab === 'weekly') await renderPiggyWeekly();
  else await renderPiggyDaily();
}

// ── 최고 기록 ─────────────────────────────────────────────
async function getBestWeekly() {
  const s = await loadSavings();
  return getWeekDates().reduce((total, d) => total + (s[d.key] || 0), 0);
}
async function updateRecords() {
  const s = await loadSavings();
  const todayVal  = s[getToday()] || 0;
  const weekTotal = await getBestWeekly();
  const recData   = JSON.parse(localStorage.getItem('waterRecords') || '{}');
  if (!recData.daily  || recData.daily  < todayVal)  { recData.daily  = todayVal;  recData.dailyDate = getToday(); }
  if (!recData.weekly || recData.weekly < weekTotal)  { recData.weekly = weekTotal; }
  localStorage.setItem('waterRecords', JSON.stringify(recData));
  await updateRecordChips();
}
async function updateRecordChips() {
  const s = await loadSavings();
  const todayVal  = s[getToday()] || 0;
  const weekTotal = await getBestWeekly();
  document.getElementById('rec-daily').textContent  = todayVal  > 0 ? `${todayVal.toLocaleString()}L`  : '—';
  document.getElementById('rec-weekly').textContent = weekTotal > 0 ? `${weekTotal.toLocaleString()}L` : '—';
}
async function updateStatMini() {
  const s = await loadSavings();
  const todayVal  = s[getToday()] || 0;
  const weekTotal = await getBestWeekly();
  document.getElementById('stat-mini-today').textContent = todayVal  > 0 ? `금일 절약량: ${todayVal.toLocaleString()}L`  : '금일 절약량: 기록 없음';
  document.getElementById('stat-mini-week').textContent  = weekTotal > 0 ? `금주 누적량: ${weekTotal.toLocaleString()}L` : '금주 누적량: —';
}

// ── 페이지 열기/닫기 ──────────────────────────────────────
async function openPage(name) {
  if ((name === 'analyze' || name === 'check') && !todayMealData.length) {
    alert('금일 급식 정보를 불러오지 못했습니다.');
    return;
  }

  // 체크 패널: Firebase에서 제출 여부 확인 후 버튼 상태 설정
  if (name === 'check') {
    const btn = document.getElementById('btn-check-confirm');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 확인 중...';
    document.getElementById('page-check')?.classList.add('open');

    const submitted = await hasSubmittedTodayOnline(getToday());
    if (submitted) {
      btn.style.opacity = '0.45';
      btn.style.cursor = 'not-allowed';
      btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> 금일 제출 완료';
    } else {
      btn.disabled = false;
      btn.style.opacity = '';
      btn.style.cursor = '';
      btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> 제출 및 확인';
    }
    return;
  }

  if (name === 'piggy') await renderPiggyWeekly();
  document.getElementById(`page-${name}`)?.classList.add('open');
}

function closePage(name) {
  document.getElementById(`page-${name}`)?.classList.remove('open');
}

// 오버레이 배경 클릭 시 닫기
document.querySelectorAll('.page-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
});

// ── 더보기 드롭다운 ───────────────────────────────────────
const btnMore = document.getElementById('btn-more-toggle');
const moreDropdown = document.getElementById('more-dropdown');
btnMore.addEventListener('click', e => {
  e.stopPropagation();
  btnMore.classList.toggle('open');
  moreDropdown.classList.toggle('open');
});
document.addEventListener('click', () => {
  btnMore.classList.remove('open');
  moreDropdown.classList.remove('open');
});

// ── ★ 전역 함수 노출 (type="module" 환경 필수) ────────────
// type="module"로 로드된 함수는 HTML onclick에서 직접 호출 불가.
// window 객체에 등록하여 전역으로 노출합니다.
window.openPage       = openPage;
window.closePage      = closePage;
window.toggleCheck    = toggleCheck;
window.toggleCalCheck = toggleCalCheck;
window.confirmCheck   = confirmCheck;
window.switchPiggyTab = switchPiggyTab;

// ── 시작 ──────────────────────────────────────────────────
initApp();
