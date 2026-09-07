}

function renderDayCard(date, iso, dayLessons, theme, index) {
  const isToday = iso === todayISO();
  const isLead = (weekOffset === 0 && isToday) || (weekOffset !== 0 && index === 0);
  const weekday = `周${WEEKDAY_LABELS[date.getDay()]}`;
  const title = isToday ? "今天" : `${date.getMonth() + 1}月${date.getDate()}日`;
  const count = dayLessons.length ? `${dayLessons.length} 节` : "休息";
  const rows = dayLessons.length
    ? dayLessons.map((l) => {
        const kid = kidById(l.kidId);
        const who = selectedKids().length > 1 ? `${kid?.name || ""} · ` : "";
        return `
          <div class="day-lesson">
            <div class="day-lesson-name">${l.startTime}  ${escapeHtml(who)}${escapeHtml(l.name)}</div>
            <div class="day-lesson-meta">📍 ${escapeHtml(l.place || "地点待填")}　🚗 ${escapeHtml(l.pickup || "待定")}接</div>
          </div>
        `;
      }).join("")
    : `<div class="day-lesson"><div class="day-lesson-name">休息</div><div class="day-lesson-meta">这天没有课</div></div>`;
  return `
    <button class="day-card ${theme.dark ? "is-dark" : ""} ${isLead ? "is-lead" : ""}" data-open-day="${iso}" style="background:${theme.bg};color:${theme.color};z-index:${index + 1}">
      <div class="day-top">
        <div class="day-title">${title}</div>
        <div class="day-top-right">
          <div class="day-count">${weekday} · ${count}</div>
          <span class="day-arrow" aria-hidden="true">${cardArrow()}</span>
        </div>
      </div>
      <div class="day-lessons">${rows}</div>
    </button>
  `;
}

function lessonStatus(lesson) {
  if (isPast(lesson)) return "is-past";
  const today = todayISO();
  if (lesson.date !== today) return "";
  const now = minutesNow();
  return toMinutes(lesson.startTime) <= now ? "is-current" : "";
}

function renderLessonRow(lesson) {
  const kid = kidById(lesson.kidId);
  const status = lessonStatus(lesson);
  return `
    <button class="lesson-row ${status}" data-open-lesson="${lesson.id}">
      <div class="lesson-time">${lesson.startTime}</div>
      <div class="lesson-main">
        <div class="lesson-name"><span class="dot" style="background:${kid?.color || "#999"}"></span>${escapeHtml(kid?.name || "")} · ${escapeHtml(lesson.name)}</div>
        <div class="lesson-sub">${escapeHtml(lesson.place || "地点待填")}</div>
      </div>
      <div class="pickup">🚗 ${escapeHtml(lesson.pickup || "待定")}</div>
    </button>
  `;
}

function isPast(lesson) {
  const today = todayISO();
  if (lesson.date < today) return true;
  if (lesson.date > today) return false;
  return toMinutes(lesson.endTime) <= minutesNow();
}

function dayLessonsOf(iso) {
  return visibleLessons()
    .filter((l) => l.date === iso)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function dayShareText(iso, dayLessons) {
  const date = parseISO(iso);
  const head = `${brandTitle()}  ${date.getMonth() + 1}月${date.getDate()}日 周${WEEKDAY_LABELS[date.getDay()]}`;
  if (!dayLessons.length) return `${head}\n今天没课`;
  const lines = dayLessons.map((l) => {
    const kid = kidById(l.kidId);
    return `${l.startTime}–${l.endTime}  ${kid?.name || ""} ${l.name}\n${l.place || "地点待填"} · ${l.pickup || "待定"}接`;
  });
  return [head, ...lines].join("\n\n");
}

function openDayShare(iso) {
  const date = parseISO(iso);
  const dayLessons = dayLessonsOf(iso);
  const title = iso === todayISO() ? "今天" : `${date.getMonth() + 1}月${date.getDate()}日`;
  openSheet(`
    <h2>${title} · 周${WEEKDAY_LABELS[date.getDay()]}</h2>
    <img class="share-preview" id="sharePreview" alt="当天课表卡" />
    <div class="share-hint">长按图片也可保存</div>
    <div class="actions">
      <button class="btn ghost" id="copyDay">复制文字</button>
      <button class="btn primary" id="saveDay">保存图片</button>
    </div>
    <div class="choice-list" style="margin-top:12px">
      ${dayLessons.length ? dayLessons.map((l) => `
        <button data-open-lesson="${l.id}">
          ${l.startTime}–${l.endTime}  ${escapeHtml(kidById(l.kidId)?.name || "")} · ${escapeHtml(l.name)}
          <small>${escapeHtml(l.place || "地点待填")} · ${escapeHtml(l.pickup || "待定")}接</small>
        </button>
      `).join("") : "<div class='empty'>🍃 这天没课</div>"}
    </div>
  `, true);
  drawShareCard(iso, dayLessons).then((url) => {
    const img = $("sharePreview");
    if (img) img.src = url;
    $("saveDay").onclick = () => downloadShare(url, iso);
    $("copyDay").onclick = async () => {
      const text = dayShareText(iso, dayLessons);
      try {
        await navigator.clipboard.writeText(text);
        $("copyDay").textContent = "已复制";
      } catch {
        window.prompt("复制下面的文字", text);
      }
    };
  });
}

function downloadShare(url, iso) {
  const a = document.createElement("a");
  a.href = url;
  a.download = `GOGO-${iso}.png`;
  a.click();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function drawShareCard(iso, dayLessons) {
  const date = parseISO(iso);
  const canvas = document.createElement("canvas");
  const width = 720;
  const rowH = 118;
  const height = 220 + Math.max(1, dayLessons.length) * rowH + 70;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const theme = DAY_THEMES[date.getDay() === 0 ? 6 : date.getDay() - 1];
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = theme.bg;
  roundRect(ctx, 36, 36, width - 72, height - 72, 42);
  ctx.fill();
  ctx.fillStyle = theme.color;
  ctx.font = "700 28px sans-serif";
  ctx.fillText(brandTitle(), 72, 100);
  ctx.font = "800 56px sans-serif";
  const title = iso === todayISO() ? "今天" : `${date.getMonth() + 1}月${date.getDate()}日`;
  ctx.fillText(title, 72, 168);
  ctx.font = "600 26px sans-serif";
  ctx.globalAlpha = 0.72;
  ctx.fillText(`周${WEEKDAY_LABELS[date.getDay()]} · ${dayLessons.length ? dayLessons.length + " 节课" : "休息"}`, 72, 206);
  ctx.globalAlpha = 1;
  const rows = dayLessons.length ? dayLessons : [null];
  rows.forEach((lesson, i) => {
    const y = 236 + i * rowH;
    ctx.fillStyle = theme.dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.5)";
    roundRect(ctx, 72, y, width - 144, 100, 24);
    ctx.fill();
    ctx.fillStyle = theme.color;
    if (!lesson) {
      ctx.font = "700 30px sans-serif";
      ctx.fillText("今天没课，可以休息一下", 96, y + 60);
      return;
    }
    const kid = kidById(lesson.kidId);
    ctx.font = "800 30px sans-serif";
    ctx.fillText(`${lesson.startTime}–${lesson.endTime}`, 96, y + 42);
    ctx.font = "700 28px sans-serif";
    ctx.fillText(`${kid?.name || ""} · ${lesson.name}`, 96, y + 80);
  });
  return canvas.toDataURL("image/png");
}

function sortSlots(slots) {
  return [...slots].sort((a, b) => {
    const dayA = a.weekday === 0 ? 7 : a.weekday;
    const dayB = b.weekday === 0 ? 7 : b.weekday;
    return dayA - dayB || a.startTime.localeCompare(b.startTime);
  });
}

function periodOf(slotItem) {
  return slotItem.weekday === 0 || slotItem.weekday === 6 ? "weekend" : "weekday";
}

function renderCourses() {
  if (!state.kids.length) {
    $("courseGroups").innerHTML = `<div class="empty">👶 先添加孩子<br />再增加课程类型和班次</div>`;
    return;
  }
  const kid = currentEnrollKid();
  const pickedList = enrollmentsForKid(kid.id);
  const pickedIds = new Set(pickedList.map((e) => e.slotId));
  const kidSwitch = state.kids
    .map((k) => `<button class="chip ${k.id === kid.id ? "is-on" : ""}" data-enroll-kid="${k.id}"><span class="dot" style="background:${k.color}"></span>${escapeHtml(k.name)}</button>`)
    .join("");
  const subjects = allSubjects();
  if (!subjects.length) {
    $("courseGroups").innerHTML = `
      <div class="kid-switch">${kidSwitch}</div>
      <div class="empty">📚 还没有课程类型<br />点右下角增加课程，先建类型再加班次</div>
    `;
    return;
  }
  if (!subjects.some((s) => s.id === enrollSubjectId)) enrollSubjectId = subjects[0]?.id || "";
  const subjectPills = subjects.map((s) => `<button class="choice-pill ${s.id === enrollSubjectId ? "is-on" : ""}" data-enroll-subject="${s.id}">${s.emoji} ${s.name}</button>`).join("");
  const periodPills = [
    ["weekday", "📅 工作日"],
    ["weekend", "🌤️ 周末"],
  ].map(([id, label]) => `<button class="choice-pill ${id === enrollPeriod ? "is-on" : ""}" data-enroll-period="${id}">${label}</button>`).join("");

  const filtered = sortSlots(allSlots().filter((s) => s.subjectId === enrollSubjectId && periodOf(s) === enrollPeriod));
  const slotOptions = filtered.length
    ? filtered.map((s) => `<option value="${s.id}">${weekdayName(s.weekday)} ${s.startTime}–${s.endTime}${pickedIds.has(s.id) ? " · 已选" : ""}</option>`).join("")
    : `<option value="">这个时段没有班次</option>`;
  const firstSlot = filtered[0];
  const firstPicked = firstSlot && pickedIds.has(firstSlot.id);
  const actionLabel = firstPicked ? "查看已选" : "加入课表";

  const pickedCards = pickedList.length
    ? pickedList.map((enrollment) => {
        const courseSlot = slotById(enrollment.slotId);
        const subject = subjectById(courseSlot?.subjectId);
        return `
          <button class="picked-row" data-open-enrollment="${enrollment.id}">
            <div>
              <div class="slot-time">${subject?.emoji || ""} ${escapeHtml(subject?.name || "")}</div>
              <div class="slot-meta">${courseSlot ? `${weekdayName(courseSlot.weekday)} ${courseSlot.startTime}–${courseSlot.endTime}` : ""} · ${escapeHtml(enrollment.pickup)}</div>
            </div>
            <span class="slot-tag">已选</span>
          </button>
        `;
      }).join("")
    : `<div class="empty" style="padding:16px 0">还没选课，下面挑一个班次加入</div>`;

  $("courseGroups").innerHTML = `
    <div class="kid-switch">${kidSwitch}</div>
    <section class="enroll-card">
      <h3>给 ${escapeHtml(kid.name)} 选课</h3>
      <div class="field"><label>课程</label><div class="pill-row">${subjectPills}<button class="choice-pill ghost-pill" id="manageSubjectsBtn">管理</button></div></div>
      <div class="field"><label>星期</label><div class="pill-row">${periodPills}</div></div>
      <div class="field"><label>班次</label><select id="enrollSlot">${slotOptions}</select></div>
      <div class="actions" style="margin-top:8px">
        <button class="btn ghost" id="editSlotBtn" ${filtered.length ? "" : "disabled"}>编辑班次</button>
        <button class="btn primary" id="enrollGo" ${filtered.length ? "" : "disabled"}>${actionLabel}</button>
      </div>
    </section>
    <section class="picked-block">
      <h3>已选课程</h3>
      ${pickedCards}
    </section>
  `;
}

function openSetup() {
  openSheet(`
    <h2>👶 这个课表是给谁的？</h2>
    <div class="field"><label>孩子称呼</label><input id="setupName" placeholder="比如豆豆" maxlength="8" /></div>
    <p class="warn" id="formWarn"></p>
    <div class="actions"><button class="btn primary" id="setupSave">开始选课</button></div>
  `, true);
  $("setupSave").onclick = () => {
    const name = $("setupName").value.trim();
    if (!name) return ($("formWarn").textContent = "先给孩子起个名字");
    const kid = { id: uid("kid"), name, color: KID_COLORS[0], selected: true };
    state.kids.push(kid);
    enrollKidId = kid.id;
    saveState();
    closeSheet();
    activeTab = "courses";
    syncTabs();
    render();
  };
}

function openAddKid() {
  openSheet(`
    <h2>👶 添加孩子</h2>
    <div class="field"><label>称呼</label><input id="kidName" placeholder="比如点点" maxlength="8" /></div>
    <p class="warn" id="formWarn"></p>
    <div class="actions">
      <button class="btn ghost" id="cancelSheet">取消</button>
      <button class="btn primary" id="saveKid">添加</button>
    </div>
  `);
  $("cancelSheet").onclick = closeSheet;
  $("saveKid").onclick = () => {
    const name = $("kidName").value.trim();
    if (!name) return ($("formWarn").textContent = "填写称呼");
    const color = KID_COLORS[state.kids.length % KID_COLORS.length];
    const kid = { id: uid("kid"), name, color, selected: true };
    state.kids.push(kid);
    enrollKidId = kid.id;
    saveState();
    closeSheet();
    render();
  };
}

function openEditKid(kidId) {
  const kid = kidById(kidId);
  if (!kid) return;
  openSheet(`
