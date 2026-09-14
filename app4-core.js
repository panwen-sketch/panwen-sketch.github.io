function deleteSubject(subjectId) {
  const subject = subjectById(subjectId);
  if (!subject) return;
  const slotIds = allSlots().map((s) => slotById(s.id)).filter((s) => s.subjectId === subjectId).map((s) => s.id);
  const used = state.enrollments.some((e) => slotIds.includes(e.slotId));
  if (!confirm(used ? `删除「${subject.name}」？这个类型下的班次和未上课次会一起去掉。` : `删除「${subject.name}」？`)) return;
  slotIds.forEach((id) => {
    const courseSlot = slotById(id);
    if (courseSlot) {
      const inExtra = state.extraSlots.some((s) => s.id === id);
      if (inExtra) state.extraSlots = state.extraSlots.filter((s) => s.id !== id);
      else if (!state.removedSlotIds.includes(id)) state.removedSlotIds.push(id);
      delete state.slotOverrides[id];
    }
  });
  state.enrollments.filter((e) => slotIds.includes(e.slotId)).forEach((e) => dropEnrollment(e.id));
  const extra = (state.extraSubjects || []).some((s) => s.id === subjectId);
  if (extra) state.extraSubjects = state.extraSubjects.filter((s) => s.id !== subjectId);
  else if (!state.removedSubjectIds.includes(subjectId)) state.removedSubjectIds.push(subjectId);
  const left = allSubjects();
  if (!left.some((s) => s.id === enrollSubjectId)) enrollSubjectId = left[0]?.id || "";
  saveState();
  closeSheet();
  render();
}

function openAddSubject() {
  openSheet(`
    <h2>📚 增加课程类型</h2>
    <div class="field"><label>课程名</label><input id="subName" placeholder="比如绘画课" maxlength="12" /></div>
    <p class="warn" id="formWarn"></p>
    <div class="actions">
      <button class="btn ghost" id="cancelSheet">取消</button>
      <button class="btn primary" id="saveSubject">保存</button>
    </div>
  `, true);
  $("cancelSheet").onclick = closeSheet;
  $("saveSubject").onclick = () => {
    const name = $("subName").value.trim();
    if (!name) return ($("formWarn").textContent = "填写课程名");
    if (allSubjects().some((s) => s.name === name)) return ($("formWarn").textContent = "这个课程类型已经有了");
    const emoji = SUBJECT_EMOJIS[state.extraSubjects.length % SUBJECT_EMOJIS.length];
    const subject = { id: uid("subject"), name, emoji };
    state.extraSubjects.push(subject);
    enrollSubjectId = subject.id;
    saveState();
    closeSheet();
    openSlotForm({ subjectId: subject.id });
  };
}

function openSlotForm(existing) {
  const courseSlot = existing?.id ? slotById(existing.id) : existing;
  const subjectOptions = allSubjects().map((s) => `<option value="${s.id}" ${s.id === (courseSlot?.subjectId || enrollSubjectId) ? "selected" : ""}>${s.emoji} ${s.name}</option>`).join("");
  const dayOptions = WEEKDAY_CHIPS.map((d) => `<option value="${d.value}" ${Number(courseSlot?.weekday) === d.value ? "selected" : ""}>${d.label}</option>`).join("");
  openSheet(`
    <h2>${courseSlot?.id ? "✏️ 编辑班次" : "🕒 增加班次"}</h2>
    <div class="field"><label>课程</label><select id="sSubject">${subjectOptions}</select></div>
    <div class="field"><label>星期几</label><select id="sDay">${dayOptions}</select></div>
    <div class="field"><label>开始</label><input id="sStart" type="time" value="${courseSlot?.startTime || "16:30"}" /></div>
    <div class="field"><label>结束</label><input id="sEnd" type="time" value="${courseSlot?.endTime || "17:30"}" /></div>
    <p class="warn" id="formWarn"></p>
    <div class="actions">
      ${courseSlot?.id ? `<button class="btn danger" id="deleteSlot">删除班次</button>` : `<button class="btn ghost" id="cancelSheet">取消</button>`}
      <button class="btn primary" id="saveSlot">${courseSlot?.id ? "保存" : "加入课程库"}</button>
    </div>
    ${courseSlot?.id ? `<button class="btn ghost" id="addAnotherSlot" style="width:100%;margin-top:8px">再加一个班次</button>` : ""}
  `, true);
  const cancel = $("cancelSheet");
  if (cancel) cancel.onclick = closeSheet;
  $("saveSlot").onclick = () => saveSlotForm(courseSlot);
  const del = $("deleteSlot");
  if (del) del.onclick = () => deleteSlot(courseSlot);
  const addAnother = $("addAnotherSlot");
  if (addAnother) {
    addAnother.onclick = () => {
      const saved = saveSlotForm(courseSlot, { keepOpen: true });
      if (saved) openSlotForm({ subjectId: saved.subjectId, weekday: saved.weekday, startTime: saved.startTime, endTime: saved.endTime });
    };
  }
}

function saveSlotForm(existing, opts = {}) {
  const subjectId = $("sSubject").value;
  const weekday = Number($("sDay").value);
  const startTime = $("sStart").value;
  const endTime = $("sEnd").value;
  if (!subjectId) {
    $("formWarn").textContent = "选择课程";
    return null;
  }
  if (!startTime || !endTime) {
    $("formWarn").textContent = "填写时间";
    return null;
  }
  if (endTime <= startTime) {
    $("formWarn").textContent = "结束时间要晚于开始时间";
    return null;
  }
  const next = { subjectId, weekday, startTime, endTime };
  const duplicate = allSlots()
    .map((s) => slotById(s.id))
    .some((s) => s.id !== existing?.id && sameSlot(s, next));
  if (duplicate) {
    $("formWarn").textContent = "这个班次已经在课程库里了";
    return null;
  }

  if (!existing?.id) {
    const extra = slot(subjectId, weekday, startTime, endTime);
    extra.id = uid("slot");
    state.extraSlots.push(extra);
    enrollSubjectId = subjectId;
    enrollPeriod = periodOf(extra);
  } else {
    applySlotChange(existing.id, next);
    enrollSubjectId = subjectId;
    enrollPeriod = periodOf(next);
  }
  saveState();
  if (!opts.keepOpen) {
    closeSheet();
    activeTab = "courses";
    syncTabs();
    render();
  }
  return next;
}

function applySlotChange(slotId, next) {
  const inExtra = state.extraSlots.find((s) => s.id === slotId);
  if (inExtra) Object.assign(inExtra, next);
  else state.slotOverrides[slotId] = next;
  const today = todayISO();
  const courseSlot = slotById(slotId);
  const subject = subjectById(courseSlot.subjectId);
  state.lessons.forEach((lesson) => {
    if (lesson.slotId !== slotId || lesson.skipped || lesson.date < today) return;
    lesson.name = subject?.name || lesson.name;
    lesson.startTime = next.startTime;
    lesson.endTime = next.endTime;
    const date = parseISO(lesson.date);
    if (date.getDay() !== next.weekday) lesson.skipped = true;
  });
  state.enrollments
    .filter((e) => e.slotId === slotId)
    .forEach((enrollment) => {
      const extraLessons = generateEnrollmentLessons(enrollment).filter((l) => l.date >= today && !state.lessons.some((old) => old.enrollmentId === enrollment.id && old.date === l.date && !old.skipped));
      state.lessons.push(...extraLessons);
    });
}

function deleteSlot(courseSlot) {
  const used = state.enrollments.filter((e) => e.slotId === courseSlot.id).length;
  if (!confirm(used ? "删除这个班次？已选这门课的未上课次会一起去掉。" : "删除这个班次？")) return;
  const inExtra = state.extraSlots.some((s) => s.id === courseSlot.id);
  if (inExtra) state.extraSlots = state.extraSlots.filter((s) => s.id !== courseSlot.id);
  else if (!state.removedSlotIds.includes(courseSlot.id)) state.removedSlotIds.push(courseSlot.id);
  delete state.slotOverrides[courseSlot.id];
  state.enrollments.filter((e) => e.slotId === courseSlot.id).forEach((e) => dropEnrollment(e.id));
  saveState();
  closeSheet();
  render();
}

function openFabMenu() {
  openSheet(`
    <h2>➕ 增加课程</h2>
    <div class="choice-list">
      <button id="fabPick">✅ 去选课<small>从课程库里给孩子勾班次</small></button>
      <button id="fabAdd">➕ 增加课程<small>新增班次，或新增课程类型</small></button>
    </div>
  `);
  $("fabPick").onclick = () => {
    closeSheet();
    activeTab = "courses";
    syncTabs();
    render();
  };
  $("fabAdd").onclick = openAddMenu;
}

function syncTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.tab === activeTab);
  });
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === activeTab);
  });
}

document.querySelector(".tabbar").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  activeTab = tab.dataset.tab;
  syncTabs();
  render();
});

$("prevWeek").onclick = () => {
  weekOffset -= 1;
  render();
};
$("nextWeek").onclick = () => {
  weekOffset += 1;
  render();
};
$("fab").onclick = openFabMenu;

$("kidFilter").addEventListener("change", (e) => {
  const id = e.target.dataset.kid;
  if (!id) return;
  const kid = kidById(id);
  kid.selected = e.target.checked;
  if (!state.kids.some((k) => k.selected)) {
    kid.selected = true;
    e.target.checked = true;
  }
  saveState();
  render();
});

$("kidFilter").addEventListener("click", (e) => {
  if (e.target.closest("#addKidBtn")) return state.kids.length ? openAddKid() : openSetup();
  const edit = e.target.closest("[data-edit-kid]");
  if (edit) {
    e.preventDefault();
    e.stopPropagation();
    openEditKid(edit.dataset.editKid);
  }
});

document.querySelector(".screens").addEventListener("click", (e) => {
  const switchKid = e.target.closest("[data-enroll-kid]");
  if (switchKid) {
    enrollKidId = switchKid.dataset.enrollKid;
    render();
    return;
  }
  const subject = e.target.closest("[data-enroll-subject]");
  if (subject) {
    enrollSubjectId = subject.dataset.enrollSubject;
    render();
    return;
  }
  const period = e.target.closest("[data-enroll-period]");
  if (period) {
    enrollPeriod = period.dataset.enrollPeriod;
    render();
    return;
  }
  if (e.target.closest("#enrollGo")) {
    const slotId = $("enrollSlot")?.value;
    if (slotId) openSlot(slotId);
    return;
  }
  if (e.target.closest("#editSlotBtn")) {
    const slotId = $("enrollSlot")?.value;
    if (slotId) openSlotForm({ id: slotId });
    return;
  }
  if (e.target.closest("#manageSubjectsBtn")) {
    openManageSubjects();
    return;
  }
  const day = e.target.closest("[data-open-day]");
  if (day) return openDayShare(day.dataset.openDay);
  const lesson = e.target.closest("[data-open-lesson]");
  if (lesson) return openLessonDetail(lesson.dataset.openLesson);
  const enrollment = e.target.closest("[data-open-enrollment]");
  if (enrollment) return openEnrollmentDetail(enrollment.dataset.openEnrollment);
});

document.querySelector(".screens").addEventListener("change", (e) => {
  if (e.target.id !== "enrollSlot") return;
  const kid = currentEnrollKid();
  const picked = kid ? enrollmentsForKid(kid.id).some((item) => item.slotId === e.target.value) : false;
  const go = $("enrollGo");
  if (go) go.textContent = picked ? "查看已选" : "加入课表";
});

overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeSheet();
});

state = loadState();
render();
