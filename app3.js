    <h2>✏️ 编辑孩子</h2>
    <div class="field"><label>称呼</label><input id="kidName" value="${escapeHtml(kid.name)}" maxlength="8" /></div>
    <p class="warn" id="formWarn"></p>
    <div class="actions">
      <button class="btn danger" id="deleteKid">删除</button>
      <button class="btn primary" id="saveKid">保存</button>
    </div>
  `);
  $("saveKid").onclick = () => {
    const name = $("kidName").value.trim();
    if (!name) return ($("formWarn").textContent = "填写称呼");
    kid.name = name;
    saveState();
    closeSheet();
    render();
  };
  $("deleteKid").onclick = () => {
    const extra = state.enrollments.some((e) => e.kidId === kidId) ? "这个孩子名下已选的课会一起去掉。" : "";
    if (!confirm(`删除 ${kid.name}？${extra}`)) return;
    state.enrollments = state.enrollments.filter((e) => e.kidId !== kidId);
    state.lessons = state.lessons.filter((l) => l.kidId !== kidId);
    state.kids = state.kids.filter((k) => k.id !== kidId);
    saveState();
    closeSheet();
    render();
  };
}

function kidOptions(selectedId) {
  return state.kids.map((k) => `<option value="${k.id}" ${k.id === selectedId ? "selected" : ""}>${escapeHtml(k.name)}</option>`).join("");
}

function openSlot(slotId) {
  if (!state.kids.length) return openSetup();
  const courseSlot = slotById(slotId);
  if (!courseSlot) return;
  const kid = currentEnrollKid();
  const existing = enrollmentsForKid(kid.id).find((e) => e.slotId === slotId);
  if (existing) return openEnrollmentDetail(existing.id);
  openEnrollForm(courseSlot, kid);
}

function openEnrollForm(courseSlot, kid) {
  const subject = subjectById(courseSlot.subjectId);
  const range = defaultRange();
  openSheet(`
    <h2>✅ 选课</h2>
    <div class="detail-block">
      <div class="k">课程</div>
      <div class="v">${subject?.emoji || ""} ${escapeHtml(subject?.name || "")}</div>
      <div class="k" style="margin-top:8px">班次</div>
      <div class="v">${weekdayName(courseSlot.weekday)} ${courseSlot.startTime}–${courseSlot.endTime}</div>
    </div>
    <div class="field"><label>孩子</label><select id="eKid">${kidOptions(kid.id)}</select></div>
    <div class="field"><label>地点</label><input id="ePlace" placeholder="场馆 / 教室" /></div>
    <div class="field"><label>接送人</label><input id="ePickup" placeholder="妈妈" /></div>
    <div class="field"><label>从哪周开始</label><input id="eFrom" type="date" value="${range.start}" /></div>
    <div class="field"><label>到哪周结束</label><input id="eTo" type="date" value="${range.end}" /></div>
    <div class="field"><label>备注</label><input id="eNote" placeholder="带装备 / 泳衣" /></div>
    <p class="warn" id="formWarn"></p>
    <div class="actions">
      <button class="btn ghost" id="cancelSheet">取消</button>
      <button class="btn primary" id="saveEnroll">加入课表</button>
    </div>
  `, true);
  $("cancelSheet").onclick = closeSheet;
  $("saveEnroll").onclick = () => {
    const kidId = $("eKid").value;
    const place = $("ePlace").value.trim();
    const pickup = $("ePickup").value.trim();
    const startDate = $("eFrom").value;
    const endDate = $("eTo").value;
    if (!place) return ($("formWarn").textContent = "填写地点");
    if (!pickup) return ($("formWarn").textContent = "填写接送人");
    if (!startDate || !endDate || endDate < startDate) return ($("formWarn").textContent = "检查起止日期");
    if (enrollmentsForKid(kidId).some((e) => e.slotId === courseSlot.id)) {
      return ($("formWarn").textContent = "这个孩子已经选过这个班次");
    }
    const enrollment = {
      id: uid("enroll"),
      kidId,
      slotId: courseSlot.id,
      place,
      pickup,
      startDate,
      endDate,
      note: $("eNote").value.trim(),
    };
    state.enrollments.push(enrollment);
    state.lessons.push(...generateEnrollmentLessons(enrollment));
    enrollKidId = kidId;
    saveState();
    closeSheet();
    activeTab = "schedule";
    syncTabs();
    render();
  };
}

function openEnrollmentDetail(enrollmentId) {
  const enrollment = enrollmentById(enrollmentId);
  if (!enrollment) return;
  const courseSlot = slotById(enrollment.slotId);
  const subject = subjectById(courseSlot?.subjectId);
  const kid = kidById(enrollment.kidId);
  openSheet(`
    <h2>📚 ${escapeHtml(kid?.name || "")} · ${escapeHtml(subject?.name || "")}</h2>
    <div class="detail-block"><div class="k">🗓️ 班次</div><div class="v">${weekdayName(courseSlot.weekday)} ${courseSlot.startTime}–${courseSlot.endTime}</div></div>
    <div class="detail-block"><div class="k">📍 地点</div><div class="v">${escapeHtml(enrollment.place)}</div></div>
    <div class="detail-block"><div class="k">🚗 默认接送人</div><div class="v">${escapeHtml(enrollment.pickup)}</div></div>
    <div class="actions">
      <button class="btn danger" id="dropCourse">退课</button>
      <button class="btn primary" id="editEnroll">改地点/接送</button>
    </div>
  `, true);
  $("editEnroll").onclick = () => openEditEnrollment(enrollment);
  $("dropCourse").onclick = () => {
    if (!confirm("退掉这门课？未上的课次会从课表里去掉。")) return;
    dropEnrollment(enrollment.id);
    closeSheet();
    render();
  };
}

function openEditEnrollment(enrollment) {
  const courseSlot = slotById(enrollment.slotId);
  const subject = subjectById(courseSlot?.subjectId);
  openSheet(`
    <h2>✏️ 改选课信息</h2>
    <div class="detail-block"><div class="v">${escapeHtml(subject?.name || "")} · ${weekdayName(courseSlot.weekday)} ${courseSlot.startTime}–${courseSlot.endTime}</div></div>
    <div class="field"><label>地点</label><input id="ePlace" value="${escapeHtml(enrollment.place)}" /></div>
    <div class="field"><label>接送人</label><input id="ePickup" value="${escapeHtml(enrollment.pickup)}" /></div>
    <div class="field"><label>备注</label><input id="eNote" value="${escapeHtml(enrollment.note || "")}" /></div>
    <p class="warn" id="formWarn"></p>
    <div class="actions">
      <button class="btn ghost" id="cancelSheet">取消</button>
      <button class="btn primary" id="saveEnroll">保存到未上课次</button>
    </div>
  `, true);
  $("cancelSheet").onclick = closeSheet;
  $("saveEnroll").onclick = () => {
    const place = $("ePlace").value.trim();
    const pickup = $("ePickup").value.trim();
    if (!place || !pickup) return ($("formWarn").textContent = "地点和接送人都要填");
    enrollment.place = place;
    enrollment.pickup = pickup;
    enrollment.note = $("eNote").value.trim();
    const today = todayISO();
    state.lessons
      .filter((l) => l.enrollmentId === enrollment.id && l.date >= today && !l.skipped)
      .forEach((l) => {
        l.place = place;
        l.pickup = pickup;
        l.note = enrollment.note;
      });
    saveState();
    closeSheet();
    render();
  };
}

function dropEnrollment(enrollmentId) {
  const today = todayISO();
  state.enrollments = state.enrollments.filter((e) => e.id !== enrollmentId);
  state.lessons = state.lessons.filter((l) => l.enrollmentId !== enrollmentId || (l.date < today && !l.skipped));
  saveState();
}

function openLessonDetail(lessonId) {
  const lesson = state.lessons.find((l) => l.id === lessonId);
  if (!lesson) return;
  const kid = kidById(lesson.kidId);
  const date = parseISO(lesson.date);
  openSheet(`
    <h2>📌 ${escapeHtml(kid?.name || "")} · ${escapeHtml(lesson.name)}</h2>
    <div class="detail-block"><div class="k">⏰ 时间</div><div class="v">${date.getMonth() + 1}月${date.getDate()}日 周${WEEKDAY_LABELS[date.getDay()]} ${lesson.startTime}–${lesson.endTime}</div></div>
    <div class="detail-block"><div class="k">📍 地点</div><div class="v">${escapeHtml(lesson.place || "地点待填")}</div></div>
    <div class="detail-block"><div class="k">🚗 接送人</div><div class="v">${escapeHtml(lesson.pickup || "待定")}</div></div>
    ${lesson.note ? `<div class="detail-block"><div class="k">备注</div><div class="v">${escapeHtml(lesson.note)}</div></div>` : ""}
    <div class="actions">
      <button class="btn danger" id="deleteLesson">删除</button>
      <button class="btn primary" id="editLesson">编辑</button>
    </div>
  `, true);
  $("editLesson").onclick = () => openLessonForm(lesson);
  $("deleteLesson").onclick = () => openDeleteLesson(lesson);
}

function openLessonForm(lesson) {
  const kid = kidById(lesson.kidId);
  openSheet(`
    <h2>✏️ 编辑这节课</h2>
    <div class="detail-block">
      <div class="k">课程</div>
      <div class="v">${escapeHtml(kid?.name || "")} · ${escapeHtml(lesson.name)} ${lesson.startTime}–${lesson.endTime}</div>
      <div class="k" style="margin-top:8px">班次时间在「选课」里退了重选才会改</div>
    </div>
    <div class="field"><label>地点</label><input id="lPlace" value="${escapeHtml(lesson.place)}" /></div>
    <div class="field"><label>接送人</label><input id="lPickup" value="${escapeHtml(lesson.pickup)}" /></div>
    <div class="field"><label>备注</label><input id="lNote" value="${escapeHtml(lesson.note || "")}" /></div>
    <p class="warn" id="formWarn"></p>
    <div class="choice-list">
      <button id="saveOne">只改这一节<small>比如今天临时换人接</small></button>
      <button id="saveSeries">改这一节及以后<small>后面课次的地点/接送人一起改</small></button>
    </div>
    <button class="btn ghost" id="cancelSheet" style="width:100%;margin-top:8px">取消</button>
  `, true);
  $("cancelSheet").onclick = closeSheet;
  const payload = () => ({
    place: $("lPlace").value.trim(),
    pickup: $("lPickup").value.trim(),
    note: $("lNote").value.trim(),
  });
  const valid = (data) => {
    if (!data.place || !data.pickup) return "地点和接送人都要填";
    return "";
  };
  $("saveOne").onclick = () => {
    const data = payload();
    const err = valid(data);
    if (err) return ($("formWarn").textContent = err);
    Object.assign(lesson, data);
    saveState();
    closeSheet();
    render();
  };
  $("saveSeries").onclick = () => {
    const data = payload();
    const err = valid(data);
    if (err) return ($("formWarn").textContent = err);
    Object.assign(lesson, data);
    const enrollment = enrollmentById(lesson.enrollmentId);
    if (enrollment) {
      enrollment.place = data.place;
      enrollment.pickup = data.pickup;
      enrollment.note = data.note;
    }
    state.lessons
      .filter((l) => l.enrollmentId === lesson.enrollmentId && l.date > lesson.date && !l.oneOff && !l.skipped)
      .forEach((l) => Object.assign(l, data));
    saveState();
    closeSheet();
    render();
  };
}

function openDeleteLesson(lesson) {
  openSheet(`
    <h2>🗑️ 删除这节课？</h2>
    <div class="choice-list">
      <button id="delOne">只删这一节<small>请假、停一次</small></button>
      <button id="delSeries">退掉这门课后面的课次<small>这门课不再出现在课表里</small></button>
    </div>
    <button class="btn ghost" id="cancelSheet" style="width:100%;margin-top:8px">取消</button>
  `);
  $("cancelSheet").onclick = closeSheet;
  $("delOne").onclick = () => {
    lesson.skipped = true;
    saveState();
    closeSheet();
    render();
  };
  $("delSeries").onclick = () => {
    dropEnrollment(lesson.enrollmentId);
    closeSheet();
    render();
  };
}

function openAddMenu() {
  openSheet(`
    <h2>➕ 增加课程</h2>
    <div class="choice-list">
      <button id="addSlot">🕒 增加班次<small>在现有课程下加一个新时间</small></button>
      <button id="addSubject">📚 增加课程类型<small>比如绘画、钢琴，先建类型再加班次</small></button>
    </div>
  `);
  $("addSlot").onclick = () => openSlotForm();
  $("addSubject").onclick = openAddSubject;
}

function openManageSubjects() {
  const list = allSubjects()
    .map((s) => `<button data-edit-subject="${s.id}">${s.emoji} ${escapeHtml(s.name)}<small>点这里改名或删除</small></button>`)
    .join("");
  openSheet(`
    <h2>📚 课程类型</h2>
    <div class="choice-list">${list || "<div class='empty'>还没有课程类型</div>"}</div>
    <button class="btn ghost" id="cancelSheet" style="width:100%;margin-top:8px">关闭</button>
  `);
  $("cancelSheet").onclick = closeSheet;
  sheet.querySelectorAll("[data-edit-subject]").forEach((btn) => {
    btn.onclick = () => openEditSubject(btn.dataset.editSubject);
  });
}

function openEditSubject(subjectId) {
  const subject = subjectById(subjectId);
  if (!subject) return;
  openSheet(`
    <h2>✏️ 编辑课程类型</h2>
    <div class="field"><label>课程名</label><input id="subName" value="${escapeHtml(subject.name)}" maxlength="12" /></div>
    <p class="warn" id="formWarn"></p>
    <div class="actions">
      <button class="btn danger" id="deleteSubject">删除类型</button>
      <button class="btn primary" id="saveSubject">保存</button>
    </div>
  `, true);
  $("saveSubject").onclick = () => {
    const name = $("subName").value.trim();
    if (!name) return ($("formWarn").textContent = "填写课程名");
