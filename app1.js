const STORAGE_KEY = "gogo-app-local-v1";
const APP_NAME = "GOGO";
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAY_CHIPS = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 0, label: "周日" },
];
const KID_COLORS = ["#0b2d78", "#2a67ca", "#f7d35c", "#3ea5db", "#6b7fa8"];
const DEFAULT_SUBJECTS = [];
const SUBJECT_EMOJIS = ["🥋", "🏊", "⚽", "🎨", "🎹", "🏀", "💃", "📚"];
const CATALOG = [];

const $ = (id) => document.getElementById(id);
const overlay = $("overlay");
const sheet = $("sheet");

let state = emptyState();
let weekOffset = 0;
let activeTab = "schedule";
let enrollKidId = "";
let enrollSubjectId = "";
let enrollPeriod = "weekday";

function slot(subjectId, weekday, startTime, endTime) {
  return {
    id: `${subjectId}-${weekday}-${startTime.replace(":", "")}`,
    subjectId,
    weekday,
    startTime,
    endTime,
  };
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function todayISO() {
  return formatISO(new Date());
}

function formatISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function weekDates() {
  const start = addDays(startOfWeek(new Date()), weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function minutesNow() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function kidById(id) {
  return state.kids.find((k) => k.id === id);
}

function allSubjects() {
  return [...DEFAULT_SUBJECTS.filter((s) => !(state.removedSubjectIds || []).includes(s.id)), ...(state.extraSubjects || [])];
}

function subjectById(id) {
  return allSubjects().find((s) => s.id === id);
}

function allSlots() {
  return [...CATALOG.filter((s) => !(state.removedSlotIds || []).includes(s.id)), ...(state.extraSlots || [])];
}

function slotById(id) {
  const found = allSlots().find((s) => s.id === id);
  if (!found) return null;
  return { ...found, ...(state.slotOverrides?.[id] || {}) };
}

function sameSlot(a, b) {
  return a.subjectId === b.subjectId && a.weekday === b.weekday && a.startTime === b.startTime && a.endTime === b.endTime;
}

function selectedKids() {
  const selected = state.kids.filter((k) => k.selected);
  return selected.length ? selected : state.kids;
}

function currentEnrollKid() {
  return kidById(enrollKidId) || selectedKids()[0] || state.kids[0];
}

function enrollmentsForKid(kidId) {
  return state.enrollments.filter((e) => e.kidId === kidId);
}

function enrollmentById(id) {
  return state.enrollments.find((e) => e.id === id);
}

function emptyState() {
  return {
    kids: [],
    enrollments: [],
    extraSlots: [],
    extraSubjects: [],
    removedSubjectIds: [],
    removedSlotIds: [],
    slotOverrides: {},
    lessons: [],
    setupDone: true,
  };
}


function defaultRange() {
  const start = formatISO(startOfWeek(new Date()));
  const end = formatISO(addDays(parseISO(start), 7 * 12 - 1));
  return { start, end };
}

function generateEnrollmentLessons(enrollment) {
  const courseSlot = slotById(enrollment.slotId);
  if (!courseSlot) return [];
  const subject = subjectById(courseSlot.subjectId);
  const lessons = [];
  const start = parseISO(enrollment.startDate);
  const end = parseISO(enrollment.endDate);
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    if (d.getDay() !== courseSlot.weekday) continue;
    lessons.push({
      id: uid("lesson"),
      enrollmentId: enrollment.id,
      slotId: enrollment.slotId,
      kidId: enrollment.kidId,
      name: subject?.name || "",
      date: formatISO(d),
      startTime: courseSlot.startTime,
      endTime: courseSlot.endTime,
      place: enrollment.place,
      pickup: enrollment.pickup,
      note: enrollment.note || "",
      skipped: false,
      oneOff: false,
    });
  }
  return lessons;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const kids = (parsed.kids || []).map((kid, i) => ({
      ...kid,
      color: KID_COLORS[i % KID_COLORS.length],
    }));
    return {
      kids,
      enrollments: parsed.enrollments || [],
      extraSlots: parsed.extraSlots || [],
      extraSubjects: parsed.extraSubjects || [],
      removedSubjectIds: parsed.removedSubjectIds || [],
      removedSlotIds: parsed.removedSlotIds || [],
      slotOverrides: parsed.slotOverrides || {},
      lessons: parsed.lessons || [],
      setupDone: true,
    };
  } catch {
    return emptyState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function closeSheet() {
  overlay.hidden = true;
  sheet.innerHTML = "";
  sheet.classList.remove("full");
}

function openSheet(html, full = false) {
  sheet.classList.toggle("full", full);
  sheet.innerHTML = `<div class="sheet-handle"></div>${html}`;
  overlay.hidden = false;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function weekdayName(value) {
  return WEEKDAY_CHIPS.find((d) => d.value === value)?.label || "";
}

function render() {
  if (!enrollKidId || !kidById(enrollKidId)) {
    enrollKidId = selectedKids()[0]?.id || state.kids[0]?.id || "";
  }
  if (!enrollSubjectId || !allSubjects().some((s) => s.id === enrollSubjectId)) {
    enrollSubjectId = allSubjects()[0]?.id || "";
  }
  document.querySelector(".week-nav").hidden = activeTab !== "schedule";
  renderKidFilter();
  renderWeekHeader();
  if (activeTab === "schedule") renderSchedule();
  else renderCourses();
}

function renderKidFilter() {
  const chips = state.kids
    .map((kid) => {
      const checked = kid.selected ? "checked" : "";
      const on = kid.selected ? "is-on" : "";
      return `<label class="chip ${on}"><input type="checkbox" data-kid="${kid.id}" ${checked} /><span class="dot" style="background:${kid.color}"></span>${escapeHtml(kid.name)}<button type="button" class="chip-edit" data-edit-kid="${kid.id}" aria-label="编辑${escapeHtml(kid.name)}">✎</button></label>`;
    })
    .join("");
  $("kidFilter").innerHTML = `${chips}<button class="chip add" id="addKidBtn">👶 + 孩子</button>`;
}

function brandTitle() {
  const kids = selectedKids();
  if (!kids.length) return APP_NAME;
  if (kids.length === 1) return `${APP_NAME}${kids[0].name}`;
  if (kids.length === 2) return `${APP_NAME}${kids[0].name} & ${kids[1].name}`;
  return `${APP_NAME}家`;
}

function renderWeekHeader() {
  const date3 = weekDates();
  const start = dates[0];
  const end = dates[6];
  $("weekLabel").textContent = brandTitle();
  const weekHint = weekOffset === 0 ? "本周" : weekOffset > 0 ? `往后第 ${weekOffset} 周` : `往前第 ${-weekOffset} 周`;
  $("weekRange").textContent = `${weekHint}  ${start.getMonth() + 1}/${start.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`;
  document.title = brandTitle();
}

function visibleLessons() {
  const ids = new Set(selectedKids().map((k) => k.id));
  return state.lessons.filter((l) => ids.has(l.kidId) && !l.skipped);
}

const DAY_THEMES = [
  { bg: "#d8c4ff", color: "#1b1230", dark: false },
  { bg: "#d4f06a", color: "#1a2408", dark: false },
  { bg: "#3554d1", color: "#ffffff", dark: true },
  { bg: "#ff6b4a", color: "#ffffff", dark: true },
  { bg: "#c9b6ff", color: "#1b1230", dark: false },
  { bg: "#7ad7f0", color: "#082430", dark: false },
  { bg: "#ffd15c", color: "#2a2108", dark: false },
];

function renderSchedule() {
  const dates = weekDates();
  const lessons = visibleLessons();
  if (!state.kids.length) {
    $("weekList").innerHTML = `<div class="empty">🧺 还没有课程<br />先添加孩子，再去选课或增加课程</div>`;
    return;
  }
  $("weekList").innerHTML = `<div class="week-stack">${dates
    .map((date, i) => {
      const iso = formatISO(date);
      const dayLessons = lessons
        .filter((l) => l.date === iso)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      return renderDayCard(date, iso, dayLessons, DAY_THEMES[i % DAY_THEMES.length], i);
    })
    .join("")}</div>`;
}

function cardArrow() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h12"/><path d="M13 6l6 6-6 6"/></svg>`;
