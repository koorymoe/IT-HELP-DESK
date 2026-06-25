// ═══════════════════════════════════════════════════════
//  IT HELP DESK — Google Apps Script Backend
// ═══════════════════════════════════════════════════════

var TOKEN_SECRET  = 'IT_HELP_SECRET_KEY_2024';
var SYSTEM_URL    = ScriptApp.getService().getUrl();
var AI_MODEL      = 'claude-sonnet-4-20250514';
var AI_KEY_PROP   = 'ANTHROPIC_API_KEY';

var ROLES_IT      = ['it', 'it_manager', 'admin'];
var ROLES_MGR     = ['manager', 'it_manager', 'admin'];
var ROLES_STAFF   = ['it', 'manager', 'it_manager', 'admin'];

var SH_USERS      = 'Users';
var SH_TICKETS    = 'Tickets';
var SH_DEPTS      = 'Departments';
var SH_SESSIONS   = 'Sessions';
var SH_NOTIFS     = 'Notifications';

// ───── Column indices (0-based) ─────
var UC = { id:0, name:1, empId:2, email:3, role:4, dept:5, password:6, active:7, internet:8 };
var TC = { id:0, title:1, desc:2, problemType:3, priority:4, status:5,
           requesterId:6, requesterName:7, requesterDept:8,
           assignedId:9, assignedName:10,
           createdAt:11, updatedAt:12, solvedAt:13, notes:14 };
var SC = { token:0, userId:1, expires:2 };
var NC = { id:0, userId:1, ticketId:2, message:3, read:4, createdAt:5 };

// ═══════════════════════════════════════════════════════
//  ENTRY POINTS
// ═══════════════════════════════════════════════════════

function doGet(e) {
  var p = e.parameter || {};
  var action = p.action || '';
  var tid    = p.tid    || p.ticketId || '';
  var uid    = p.uid    || p.userId   || '';
  var token  = p.token  || '';

  try {
    if (action === 'claim') {
      return handleEmailAction('claim', tid, uid, token);
    }
    if (action === 'solve') {
      return handleEmailAction('solve', tid, uid, token);
    }
    if (action === 'assign-page') {
      return handleEmailAssignPage(tid, uid, token);
    }
    if (action === 'do-assign') {
      return handleEmailDoAssignGet(p);
    }
  } catch (err) {
    return buildSimplePage('خطأ', '<p style="color:red">' + err.message + '</p>');
  }

  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('نظام بلاغات IT')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    var body   = JSON.parse(e.postData.contents);
    var action = body.action || '';
    var sess   = body.sessionToken ? getSession(body.sessionToken) : null;

    if (action === 'login')           return jsonResp(login(body));
    if (action === 'logout' && sess)  return jsonResp(logout(sess));

    if (!sess) return errResp('غير مصرح');

    switch (action) {
      // Tickets
      case 'createTicket':      return jsonResp(createTicket(body, sess));
      case 'getTickets':        return jsonResp(getTickets(body, sess));
      case 'getTicket':         return jsonResp({ticket: getTicketById(body.ticketId)});
      case 'updateTicket':      return jsonResp(updateTicket(body, sess));
      case 'claimTicket':       return jsonResp(claimTicket(body, sess));
      case 'solveTicket':       return jsonResp(solveTicket(body, sess));
      case 'assignTicket':      return jsonResp(assignTicket(body, sess));
      case 'deleteTicket':      return jsonResp(deleteTicket(body, sess));
      // Users
      case 'getUsers':          return jsonResp(getUsers(sess));
      case 'addUser':           return jsonResp(addUser(body, sess));
      case 'updateUser':        return jsonResp(updateUserAction(body, sess));
      case 'deleteUser':        return jsonResp(deleteUser(body, sess));
      case 'changePassword':    return jsonResp(changePassword(body, sess));
      // Departments
      case 'getDepts':          return jsonResp(getDepts());
      case 'addDept':           return jsonResp(addDept(body, sess));
      case 'deleteDept':        return jsonResp(deleteDept(body, sess));
      // Notifications
      case 'pollNotifs':        return jsonResp(pollNotifs(body, sess));
      case 'markRead':          return jsonResp(markNotifRead(body, sess));
      // Dashboard
      case 'getDashboard':      return jsonResp(getDashboard(sess));
      // AI
      case 'aiChat':            return jsonResp(handleAiChat(body, sess));
      // Internet user lookup
      case 'lookupInternet':    return jsonResp(lookupInternetUser(body, sess));

      default: return errResp('إجراء غير معروف: ' + action);
    }
  } catch (err) {
    return errResp('خطأ في الخادم: ' + err.message);
  }
}

// ═══════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════

function login(body) {
  var empId = (body.empId || '').trim();
  var pass  = (body.password || '').trim();
  if (!empId || !pass) throw new Error('الرجاء إدخال رقم الموظف وكلمة المرور');

  var row = findUserByEmpId(empId);
  if (!row) throw new Error('بيانات الدخول غير صحيحة');
  if (row[UC.password] !== pass) throw new Error('بيانات الدخول غير صحيحة');
  if (row[UC.active] === false || row[UC.active] === 'false' || row[UC.active] === 0)
    throw new Error('الحساب غير مفعل');

  var token   = generateId();
  var expires = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
  var ss = getSheet(SH_SESSIONS);
  ss.appendRow([token, row[UC.id], expires]);

  return {
    sessionToken: token,
    user: {
      id:     row[UC.id],
      name:   row[UC.name],
      empId:  row[UC.empId],
      email:  row[UC.email],
      role:   row[UC.role],
      dept:   row[UC.dept]
    }
  };
}

function logout(sess) {
  var ss   = getSheet(SH_SESSIONS);
  var data = ss.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][SC.token] === sess.token) {
      ss.deleteRow(i + 1);
      break;
    }
  }
  return { ok: true };
}

function getSession(token) {
  if (!token) return null;
  var ss   = getSheet(SH_SESSIONS);
  var data = ss.getDataRange().getValues();
  var now  = new Date();
  for (var i = 1; i < data.length; i++) {
    if (data[i][SC.token] === token) {
      if (new Date(data[i][SC.expires]) < now) {
        ss.deleteRow(i + 1);
        return null;
      }
      var user = findUserById(data[i][SC.userId]);
      if (!user) return null;
      return {
        token:  token,
        userId: user[UC.id],
        name:   user[UC.name],
        empId:  user[UC.empId],
        email:  user[UC.email],
        role:   user[UC.role],
        dept:   user[UC.dept]
      };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════
//  TICKETS
// ═══════════════════════════════════════════════════════

function createTicket(body, sess) {
  var title       = body.title       || '';
  var desc        = body.desc        || body.description || '';
  var problemType = body.problemType || 'عام';
  var priority    = body.priority    || 'عادية';

  var id        = 'T' + Date.now().toString().slice(-7);
  var now       = new Date().toISOString();
  var requester = sess.role === 'user'
    ? { id: sess.userId, name: sess.name, dept: sess.dept }
    : { id: body.requesterId || sess.userId,
        name: body.requesterName || sess.name,
        dept: body.requesterDept || sess.dept };

  var row = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
  row[TC.id]           = id;
  row[TC.title]        = title;
  row[TC.desc]         = desc;
  row[TC.problemType]  = problemType;
  row[TC.priority]     = priority;
  row[TC.status]       = 'مفتوحة';
  row[TC.requesterId]  = requester.id;
  row[TC.requesterName]= requester.name;
  row[TC.requesterDept]= requester.dept;
  row[TC.assignedId]   = '';
  row[TC.assignedName] = '';
  row[TC.createdAt]    = now;
  row[TC.updatedAt]    = now;
  row[TC.solvedAt]     = '';
  row[TC.notes]        = '';

  getSheet(SH_TICKETS).appendRow(row);

  var ticket = rowToTicket(row);
  try { notifyITTeam(ticket); } catch (e) { Logger.log('Email error: ' + e.message); }
  addNotifForStaff(ticket, 'بلاغ جديد: ' + title);

  return { ok: true, ticket: ticket };
}

function getTickets(body, sess) {
  var ts   = getSheet(SH_TICKETS).getDataRange().getValues();
  var list = [];
  for (var i = 1; i < ts.length; i++) {
    if (!ts[i][TC.id]) continue;
    var t = rowToTicket(ts[i]);
    if (sess.role === 'user' && t.requesterId !== sess.userId) continue;
    if (body.status && t.status !== body.status) continue;
    list.push(t);
  }
  list.sort(function(a, b) { return b.createdAt.localeCompare(a.createdAt); });
  return { tickets: list };
}

function getTicketById(id) {
  var ts = getSheet(SH_TICKETS).getDataRange().getValues();
  for (var i = 1; i < ts.length; i++) {
    if (ts[i][TC.id] === id) return rowToTicket(ts[i]);
  }
  return null;
}

function updateTicket(body, sess) {
  requireRole(sess, ROLES_IT);
  var sh   = getSheet(SH_TICKETS);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][TC.id] !== body.ticketId) continue;
    if (body.status)      sh.getRange(i+1, TC.status+1).setValue(body.status);
    if (body.notes)       sh.getRange(i+1, TC.notes+1).setValue(body.notes);
    if (body.priority)    sh.getRange(i+1, TC.priority+1).setValue(body.priority);
    sh.getRange(i+1, TC.updatedAt+1).setValue(new Date().toISOString());
    return { ok: true };
  }
  throw new Error('البلاغ غير موجود');
}

function claimTicket(body, sess) {
  requireRole(sess, ROLES_IT);
  var sh   = getSheet(SH_TICKETS);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][TC.id] !== body.ticketId) continue;
    var t = rowToTicket(data[i]);
    if (t.status !== 'مفتوحة') throw new Error('تم استلام هذا البلاغ مسبقاً');
    sh.getRange(i+1, TC.assignedId+1).setValue(sess.userId);
    sh.getRange(i+1, TC.assignedName+1).setValue(sess.name);
    sh.getRange(i+1, TC.status+1).setValue('معينة');
    sh.getRange(i+1, TC.updatedAt+1).setValue(new Date().toISOString());
    t.assignedId   = sess.userId;
    t.assignedName = sess.name;
    t.status       = 'معينة';
    try { notifyTeamAboutClaim(t); } catch (e) {}
    return { ok: true };
  }
  throw new Error('البلاغ غير موجود');
}

function solveTicket(body, sess) {
  requireRole(sess, ROLES_IT);
  var sh   = getSheet(SH_TICKETS);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][TC.id] !== body.ticketId) continue;
    var t = rowToTicket(data[i]);
    var now = new Date().toISOString();
    sh.getRange(i+1, TC.status+1).setValue('محلولة');
    sh.getRange(i+1, TC.solvedAt+1).setValue(now);
    sh.getRange(i+1, TC.updatedAt+1).setValue(now);
    if (body.notes) sh.getRange(i+1, TC.notes+1).setValue(body.notes);
    t.status   = 'محلولة';
    t.solvedAt = now;
    try { notifyRequesterSolved(t); } catch (e) {}
    return { ok: true };
  }
  throw new Error('البلاغ غير موجود');
}

function assignTicket(body, sess) {
  requireRole(sess, ROLES_STAFF);
  var sh     = getSheet(SH_TICKETS);
  var data   = sh.getDataRange().getValues();
  var target = findUserById(body.assigneeId);
  if (!target) throw new Error('الموظف غير موجود');
  for (var i = 1; i < data.length; i++) {
    if (data[i][TC.id] !== body.ticketId) continue;
    sh.getRange(i+1, TC.assignedId+1).setValue(target[UC.id]);
    sh.getRange(i+1, TC.assignedName+1).setValue(target[UC.name]);
    sh.getRange(i+1, TC.status+1).setValue('معينة');
    sh.getRange(i+1, TC.updatedAt+1).setValue(new Date().toISOString());
    var t = rowToTicket(data[i]);
    t.assignedId   = target[UC.id];
    t.assignedName = target[UC.name];
    t.status       = 'معينة';
    try { notifyAssignee(t, target); } catch (e) {}
    return { ok: true };
  }
  throw new Error('البلاغ غير موجود');
}

function deleteTicket(body, sess) {
  requireRole(sess, ['it_manager', 'admin']);
  var sh   = getSheet(SH_TICKETS);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][TC.id] === body.ticketId) {
      sh.deleteRow(i + 1);
      return { ok: true };
    }
  }
  throw new Error('البلاغ غير موجود');
}

function rowToTicket(row) {
  return {
    id:            row[TC.id],
    title:         row[TC.title],
    desc:          row[TC.desc],
    problemType:   row[TC.problemType],
    priority:      row[TC.priority],
    status:        row[TC.status],
    requesterId:   row[TC.requesterId],
    requesterName: row[TC.requesterName],
    requesterDept: row[TC.requesterDept],
    assignedId:    row[TC.assignedId],
    assignedName:  row[TC.assignedName],
    createdAt:     row[TC.createdAt] ? new Date(row[TC.createdAt]).toISOString() : '',
    updatedAt:     row[TC.updatedAt] ? new Date(row[TC.updatedAt]).toISOString() : '',
    solvedAt:      row[TC.solvedAt]  ? new Date(row[TC.solvedAt]).toISOString()  : '',
    notes:         row[TC.notes]
  };
}

// ═══════════════════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════════════════

function getUsers(sess) {
  requireRole(sess, ROLES_STAFF);
  var us   = getSheet(SH_USERS).getDataRange().getValues();
  var list = [];
  for (var i = 1; i < us.length; i++) {
    if (!us[i][UC.id]) continue;
    list.push({
      id:     us[i][UC.id],
      name:   us[i][UC.name],
      empId:  us[i][UC.empId],
      email:  us[i][UC.email],
      role:   us[i][UC.role],
      dept:   us[i][UC.dept],
      active: us[i][UC.active] !== false && us[i][UC.active] !== 'false'
    });
  }
  return { users: list };
}

function addUser(body, sess) {
  requireRole(sess, ['it_manager', 'admin']);
  if (!body.name || !body.empId || !body.role) throw new Error('البيانات ناقصة');
  if (findUserByEmpId(body.empId)) throw new Error('رقم الموظف مستخدم مسبقاً');
  var id  = 'U' + Date.now().toString().slice(-8);
  var row = new Array(9).fill('');
  row[UC.id]       = id;
  row[UC.name]     = body.name;
  row[UC.empId]    = body.empId;
  row[UC.email]    = body.email || '';
  row[UC.role]     = body.role;
  row[UC.dept]     = body.dept || '';
  row[UC.password] = body.password || body.empId;
  row[UC.active]   = true;
  row[UC.internet] = body.internet || '';
  getSheet(SH_USERS).appendRow(row);
  return { ok: true, id: id };
}

function updateUserAction(body, sess) {
  requireRole(sess, ['it_manager', 'admin']);
  var sh   = getSheet(SH_USERS);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][UC.id] !== body.userId) continue;
    if (body.name)     sh.getRange(i+1, UC.name+1).setValue(body.name);
    if (body.email)    sh.getRange(i+1, UC.email+1).setValue(body.email);
    if (body.role)     sh.getRange(i+1, UC.role+1).setValue(body.role);
    if (body.dept)     sh.getRange(i+1, UC.dept+1).setValue(body.dept);
    if (body.internet) sh.getRange(i+1, UC.internet+1).setValue(body.internet);
    if (body.active !== undefined) sh.getRange(i+1, UC.active+1).setValue(body.active);
    return { ok: true };
  }
  throw new Error('المستخدم غير موجود');
}

function deleteUser(body, sess) {
  requireRole(sess, ['admin']);
  var sh   = getSheet(SH_USERS);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][UC.id] === body.userId) {
      sh.deleteRow(i + 1);
      return { ok: true };
    }
  }
  throw new Error('المستخدم غير موجود');
}

function changePassword(body, sess) {
  var sh   = getSheet(SH_USERS);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][UC.id] !== sess.userId) continue;
    if (data[i][UC.password] !== body.oldPassword) throw new Error('كلمة المرور الحالية غير صحيحة');
    sh.getRange(i+1, UC.password+1).setValue(body.newPassword);
    return { ok: true };
  }
  throw new Error('المستخدم غير موجود');
}

function findUserById(id) {
  var us = getSheet(SH_USERS).getDataRange().getValues();
  for (var i = 1; i < us.length; i++) {
    if (us[i][UC.id] === id) return us[i];
  }
  return null;
}

function findUserByEmpId(empId) {
  var us = getSheet(SH_USERS).getDataRange().getValues();
  for (var i = 1; i < us.length; i++) {
    if (String(us[i][UC.empId]) === String(empId)) return us[i];
  }
  return null;
}

function getActiveITStaff() {
  var us   = getSheet(SH_USERS).getDataRange().getValues();
  var list = [];
  for (var i = 1; i < us.length; i++) {
    var role = us[i][UC.role];
    var active = us[i][UC.active];
    if (ROLES_IT.indexOf(role) >= 0 && active !== false && active !== 'false') {
      list.push({ id: us[i][UC.id], empId: us[i][UC.empId], name: us[i][UC.name], role: role });
    }
  }
  return list;
}

// ═══════════════════════════════════════════════════════
//  DEPARTMENTS
// ═══════════════════════════════════════════════════════

function getDepts() {
  var sh   = getSheet(SH_DEPTS);
  var data = sh.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) list.push({ id: data[i][0], name: data[i][1] || data[i][0] });
  }
  return { depts: list };
}

function addDept(body, sess) {
  requireRole(sess, ['it_manager', 'admin']);
  if (!body.name) throw new Error('اسم القسم مطلوب');
  var id = 'D' + Date.now().toString().slice(-6);
  getSheet(SH_DEPTS).appendRow([id, body.name]);
  return { ok: true, id: id };
}

function deleteDept(body, sess) {
  requireRole(sess, ['it_manager', 'admin']);
  var sh   = getSheet(SH_DEPTS);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === body.deptId) {
      sh.deleteRow(i + 1);
      return { ok: true };
    }
  }
  throw new Error('القسم غير موجود');
}

// ═══════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════

function pollNotifs(body, sess) {
  var since = body.since || '1970-01-01T00:00:00.000Z';
  var ns    = getSheet(SH_NOTIFS).getDataRange().getValues();
  var notifs = [], newTickets = [];

  for (var i = 1; i < ns.length; i++) {
    if (ns[i][NC.userId] !== sess.userId) continue;
    var createdAt = ns[i][NC.createdAt] ? new Date(ns[i][NC.createdAt]).toISOString() : '';
    if (createdAt > since) {
      notifs.push({
        id:        ns[i][NC.id],
        ticketId:  ns[i][NC.ticketId],
        message:   ns[i][NC.message],
        read:      ns[i][NC.read] === true || ns[i][NC.read] === 'true',
        createdAt: createdAt
      });
      if (ns[i][NC.ticketId] && !ns[i][NC.read]) newTickets.push(ns[i][NC.ticketId]);
    }
  }

  var unreadCount = 0;
  for (var j = 1; j < ns.length; j++) {
    if (ns[j][NC.userId] === sess.userId && ns[j][NC.read] !== true && ns[j][NC.read] !== 'true') unreadCount++;
  }

  return { notifs: notifs, newTickets: newTickets, unreadCount: unreadCount };
}

function markNotifRead(body, sess) {
  var sh   = getSheet(SH_NOTIFS);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][NC.id] === body.notifId && data[i][NC.userId] === sess.userId) {
      sh.getRange(i+1, NC.read+1).setValue(true);
      return { ok: true };
    }
  }
  return { ok: true };
}

function addNotifForStaff(ticket, message) {
  var us = getSheet(SH_USERS).getDataRange().getValues();
  var sh = getSheet(SH_NOTIFS);
  var now = new Date().toISOString();
  for (var i = 1; i < us.length; i++) {
    var role   = us[i][UC.role];
    var active = us[i][UC.active];
    if (ROLES_STAFF.indexOf(role) < 0) continue;
    if (active === false || active === 'false') continue;
    var id = 'N' + Date.now().toString() + i;
    sh.appendRow([id, us[i][UC.id], ticket.id, message, false, now]);
  }
}

// ═══════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════

function getDashboard(sess) {
  requireRole(sess, ROLES_STAFF);
  var ts    = getSheet(SH_TICKETS).getDataRange().getValues();
  var total = 0, open = 0, assigned = 0, solved = 0, urgent = 0;
  var byDept = {}, byType = {}, recentTickets = [];

  for (var i = 1; i < ts.length; i++) {
    if (!ts[i][TC.id]) continue;
    total++;
    var t = rowToTicket(ts[i]);
    if (t.status === 'مفتوحة')   open++;
    if (t.status === 'معينة')    assigned++;
    if (t.status === 'محلولة')   solved++;
    if (t.priority === 'عاجلة')  urgent++;
    byDept[t.requesterDept] = (byDept[t.requesterDept] || 0) + 1;
    byType[t.problemType]   = (byType[t.problemType]   || 0) + 1;
    if (recentTickets.length < 10) recentTickets.push(t);
  }

  return {
    stats:         { total: total, open: open, assigned: assigned, solved: solved, urgent: urgent },
    byDept:        byDept,
    byType:        byType,
    recentTickets: recentTickets
  };
}

// ═══════════════════════════════════════════════════════
//  AI CHAT
// ═══════════════════════════════════════════════════════

function handleAiChat(body, sess) {
  var key = PropertiesService.getScriptProperties().getProperty(AI_KEY_PROP);
  if (!key) throw new Error('مفتاح الذكاء الاصطناعي غير مضبوط');

  var messages = body.messages || [];
  var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key':         key,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json'
    },
    payload: JSON.stringify({
      model:      AI_MODEL,
      max_tokens: 1024,
      system:     'أنت مساعد IT ذكي لنظام دعم تقني. أجب باللغة العربية بشكل مختصر ومفيد.',
      messages:   messages
    }),
    muteHttpExceptions: true
  });

  var result = JSON.parse(response.getContentText());
  if (result.error) throw new Error(result.error.message);
  return { reply: result.content[0].text };
}

// ═══════════════════════════════════════════════════════
//  INTERNET USER LOOKUP
// ═══════════════════════════════════════════════════════

function lookupInternetUser(body, sess) {
  requireRole(sess, ROLES_IT);
  var query = (body.query || '').trim().toLowerCase();
  if (query.length < 2) return { matches: [] };

  var us = getSheet(SH_USERS).getDataRange().getValues();
  var matches = [];
  for (var i = 1; i < us.length; i++) {
    if (us[i][UC.role] !== 'user') continue;
    var internetName = (us[i][UC.internet] || '').toLowerCase();
    if (!internetName) continue;
    var score = smartNameMatch(query, internetName);
    if (score >= 0.72) {
      matches.push({ id: us[i][UC.id], name: us[i][UC.name], empId: us[i][UC.empId], score: score });
    }
  }
  matches.sort(function(a,b) { return b.score - a.score; });
  return { matches: matches.slice(0, 5) };
}

function smartNameMatch(query, candidate) {
  query     = query.trim().toLowerCase();
  candidate = candidate.trim().toLowerCase();
  if (query === candidate) return 1.0;
  if (candidate.indexOf(query) >= 0) return 0.9;
  if (query.indexOf(candidate) >= 0) return 0.85;

  var qParts = query.split(/\s+/);
  var cParts = candidate.split(/\s+/);
  var matched = 0;
  for (var i = 0; i < qParts.length; i++) {
    for (var j = 0; j < cParts.length; j++) {
      if (cParts[j].indexOf(qParts[i]) >= 0 || qParts[i].indexOf(cParts[j]) >= 0) { matched++; break; }
    }
  }
  var partScore = matched / Math.max(qParts.length, cParts.length);
  var lev = levenshteinSim(query, candidate);
  return Math.max(partScore * 0.8 + 0.1, lev);
}

function levenshteinSim(a, b) {
  var m = a.length, n = b.length;
  var dp = [];
  for (var i = 0; i <= m; i++) { dp[i] = [i]; }
  for (var j = 1; j <= n; j++) dp[0][j] = j;
  for (var i = 1; i <= m; i++) {
    for (var j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return 1 - dp[m][n] / Math.max(m, n);
}

// ═══════════════════════════════════════════════════════
//  EMAIL — TOKEN SECURITY
// ═══════════════════════════════════════════════════════

function generateEmailToken(ticketId, userId) {
  return sha256(ticketId + '|' + userId + '|' + TOKEN_SECRET).substring(0, 32);
}

function sha256(message) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, message, Utilities.Charset.UTF_8);
  return raw.map(function(b) {
    return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2);
  }).join('');
}

// ═══════════════════════════════════════════════════════
//  EMAIL — SEND NOTIFICATIONS
// ═══════════════════════════════════════════════════════

function notifyITTeam(ticket) {
  var us  = getSheet(SH_USERS).getDataRange().getValues();
  var url = SYSTEM_URL;
  var claimToken = generateEmailToken(ticket.id, 'claim');
  var solveToken = generateEmailToken(ticket.id, 'solve');
  var claimUrl   = url + '?action=claim&tid=' + ticket.id + '&token=' + claimToken;
  var solveUrl   = url + '?action=solve&tid=' + ticket.id + '&token=' + solveToken;

  for (var i = 1; i < us.length; i++) {
    var role   = us[i][UC.role];
    var email  = us[i][UC.email];
    var active = us[i][UC.active];
    if (!email || ROLES_STAFF.indexOf(role) < 0) continue;
    if (active === false || active === 'false') continue;

    var isOnlyManager = ROLES_MGR.indexOf(role) >= 0 && ROLES_IT.indexOf(role) < 0;

    if (isOnlyManager) {
      var mgId        = us[i][UC.id];
      var assignToken = generateEmailToken(ticket.id, mgId);
      var assignUrl   = url + '?action=assign-page&tid=' + ticket.id + '&uid=' + mgId + '&token=' + assignToken;
      MailApp.sendEmail({
        to:       email,
        subject:  '👔 بلاغ جديد — صلاحية التعيين [' + ticket.id + '] ' + ticket.title,
        htmlBody: buildManagerEmail(ticket, assignUrl)
      });
    } else {
      MailApp.sendEmail({
        to:       email,
        subject:  '🔔 بلاغ جديد [' + ticket.id + '] ' + ticket.title,
        htmlBody: buildTicketEmail(ticket, claimUrl, solveUrl)
      });
    }
  }
}

function notifyAssignee(ticket, assigneeRow) {
  var email = assigneeRow ? assigneeRow[UC.email] : '';
  if (!email) {
    var row = findUserById(ticket.assignedId);
    if (row) email = row[UC.email];
  }
  if (!email) return;

  var url        = SYSTEM_URL;
  var solveToken = generateEmailToken(ticket.id, 'solve');
  var solveUrl   = url + '?action=solve&tid=' + ticket.id + '&token=' + solveToken;

  MailApp.sendEmail({
    to:       email,
    subject:  '📋 تم تعيين بلاغ لك [' + ticket.id + '] ' + ticket.title,
    htmlBody: buildAssignedEmail(ticket, solveUrl)
  });
}

function notifyTeamAboutClaim(ticket) {
  var us = getSheet(SH_USERS).getDataRange().getValues();
  for (var i = 1; i < us.length; i++) {
    var role = us[i][UC.role];
    if (ROLES_STAFF.indexOf(role) < 0) continue;
    if (us[i][UC.id] === ticket.assignedId) continue;
    var email = us[i][UC.email];
    if (!email) continue;
    if (us[i][UC.active] === false || us[i][UC.active] === 'false') continue;
    MailApp.sendEmail({
      to:       email,
      subject:  '✋ تم استلام البلاغ [' + ticket.id + '] بواسطة ' + ticket.assignedName,
      htmlBody: buildClaimNotifEmail(ticket)
    });
  }
}

function notifyRequesterSolved(ticket) {
  var row = findUserById(ticket.requesterId);
  if (!row || !row[UC.email]) return;
  MailApp.sendEmail({
    to:       row[UC.email],
    subject:  '✅ تم حل بلاغك [' + ticket.id + '] ' + ticket.title,
    htmlBody: buildSolvedEmail(ticket)
  });
}

// ═══════════════════════════════════════════════════════
//  EMAIL — BEAUTIFUL HTML TEMPLATES
// ═══════════════════════════════════════════════════════

function emailWrapper(accentGrad, headerContent, bodyContent) {
  return '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'
    + 'body{margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Tahoma,Arial,sans-serif;direction:rtl}'
    + '.wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10)}'
    + '.hdr{background:' + accentGrad + ';padding:32px 36px;color:#fff}'
    + '.hdr h1{margin:0 0 6px;font-size:22px;font-weight:700}'
    + '.hdr p{margin:0;font-size:14px;opacity:.85}'
    + '.body{padding:28px 36px}'
    + '.info-card{background:#f8fafc;border-radius:12px;padding:18px 22px;margin-bottom:18px;border-right:4px solid #6366f1}'
    + '.info-card table{width:100%;border-collapse:collapse}'
    + '.info-card td{padding:7px 0;font-size:14px;color:#374151}'
    + '.info-card td:first-child{color:#6b7280;width:38%;font-weight:500}'
    + '.badge{display:inline-block;padding:3px 11px;border-radius:20px;font-size:12px;font-weight:700}'
    + '.badge-open{background:#dbeafe;color:#1d4ed8}'
    + '.badge-urgent{background:#fee2e2;color:#dc2626}'
    + '.badge-normal{background:#d1fae5;color:#065f46}'
    + '.btn{display:inline-block;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;text-align:center;cursor:pointer}'
    + '.btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}'
    + '.btn-success{background:linear-gradient(135deg,#10b981,#059669);color:#fff}'
    + '.btn-manager{background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff}'
    + '.btn-secondary{background:#f1f5f9;color:#475569;border:1px solid #cbd5e1}'
    + '.btn-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px}'
    + '.foot{background:#f8fafc;padding:18px 36px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb}'
    + '.urgent-banner{background:linear-gradient(90deg,#dc2626,#ef4444);color:#fff;padding:10px 36px;font-size:13px;font-weight:700;text-align:center}'
    + '</style></head><body>'
    + '<div class="wrap">' + headerContent + bodyContent
    + '<div class="foot">نظام بلاغات IT — هذه رسالة آلية</div></div></body></html>';
}

function ticketInfoTable(ticket) {
  var priorityBadge = ticket.priority === 'عاجلة'
    ? '<span class="badge badge-urgent">⚡ عاجلة</span>'
    : '<span class="badge badge-normal">' + ticket.priority + '</span>';
  return '<div class="info-card"><table>'
    + '<tr><td>رقم البلاغ</td><td><strong>' + ticket.id + '</strong></td></tr>'
    + '<tr><td>الموضوع</td><td><strong>' + ticket.title + '</strong></td></tr>'
    + '<tr><td>النوع</td><td>' + ticket.problemType + '</td></tr>'
    + '<tr><td>الأولوية</td><td>' + priorityBadge + '</td></tr>'
    + '<tr><td>القسم</td><td>' + ticket.requesterDept + '</td></tr>'
    + '<tr><td>مقدم الطلب</td><td>' + ticket.requesterName + '</td></tr>'
    + (ticket.desc ? '<tr><td>الوصف</td><td>' + ticket.desc + '</td></tr>' : '')
    + '</table></div>';
}

function buildTicketEmail(ticket, claimUrl, solveUrl) {
  var urgentBanner = ticket.priority === 'عاجلة'
    ? '<div class="urgent-banner">⚡ بلاغ عاجل — يتطلب معالجة فورية</div>' : '';

  var header = urgentBanner
    + '<div class="hdr" style="background:linear-gradient(135deg,#4338ca,#6366f1,#8b5cf6)">'
    + '<h1>🔔 بلاغ جديد وارد</h1><p>يرجى مراجعة البلاغ واتخاذ الإجراء المناسب</p></div>';

  var body = '<div class="body">'
    + ticketInfoTable(ticket)
    + '<div class="btn-grid">'
    + '<a class="btn btn-primary" href="' + claimUrl + '">✋ استلام البلاغ</a>'
    + '<a class="btn btn-success" href="' + solveUrl + '">✅ تم الحل</a>'
    + '</div>'
    + '<div style="text-align:center;margin-top:14px">'
    + '<a class="btn btn-secondary" href="' + SYSTEM_URL + '">🔍 فتح النظام</a>'
    + '</div></div>';

  return emailWrapper('linear-gradient(135deg,#4338ca,#8b5cf6)', header, body);
}

function buildManagerEmail(ticket, assignPageUrl) {
  var header = '<div class="hdr" style="background:linear-gradient(135deg,#1e1b4b,#312e81,#4338ca)">'
    + '<h1>👔 بلاغ IT جديد — صلاحية التعيين</h1>'
    + '<p>يمكنك تعيين هذا البلاغ لموظف IT مناسب مباشرةً من هنا</p></div>';

  var body = '<div class="body">'
    + ticketInfoTable(ticket)
    + '<div style="text-align:center;margin-top:24px">'
    + '<a class="btn btn-manager" style="font-size:16px;padding:15px 36px" href="' + assignPageUrl + '">👥 تعيين البلاغ لموظف IT</a>'
    + '</div>'
    + '<p style="text-align:center;margin-top:14px;font-size:13px;color:#9ca3af">'
    + 'أو <a href="' + SYSTEM_URL + '" style="color:#6366f1">افتح النظام</a> للمراجعة</p>'
    + '</div>';

  return emailWrapper('linear-gradient(135deg,#1e1b4b,#4338ca)', header, body);
}

function buildAssignedEmail(ticket, solveUrl) {
  var header = '<div class="hdr" style="background:linear-gradient(135deg,#0369a1,#0ea5e9)">'
    + '<h1>📋 تم تعيين بلاغ لك</h1><p>يرجى مراجعة البلاغ وبدء العمل عليه</p></div>';

  var body = '<div class="body">'
    + ticketInfoTable(ticket)
    + '<div style="text-align:center;margin-top:20px">'
    + '<a class="btn btn-success" href="' + solveUrl + '">✅ تم الحل</a>'
    + '&nbsp;&nbsp;<a class="btn btn-secondary" href="' + SYSTEM_URL + '">فتح النظام</a>'
    + '</div></div>';

  return emailWrapper('linear-gradient(135deg,#0369a1,#0ea5e9)', header, body);
}

function buildClaimNotifEmail(ticket) {
  var header = '<div class="hdr" style="background:linear-gradient(135deg,#0f766e,#14b8a6)">'
    + '<h1>✋ تم استلام بلاغ</h1>'
    + '<p>قام ' + ticket.assignedName + ' باستلام هذا البلاغ</p></div>';

  var body = '<div class="body">'
    + ticketInfoTable(ticket)
    + '<p style="color:#6b7280;font-size:13px;text-align:center">المسؤول عن المعالجة: <strong>' + ticket.assignedName + '</strong></p>'
    + '</div>';

  return emailWrapper('linear-gradient(135deg,#0f766e,#14b8a6)', header, body);
}

function buildSolvedEmail(ticket) {
  var header = '<div class="hdr" style="background:linear-gradient(135deg,#15803d,#16a34a,#22c55e)">'
    + '<h1>✅ تم حل بلاغك</h1><p>نأمل أن يكون قد تم حل مشكلتك بنجاح</p></div>';

  var notes = ticket.notes
    ? '<div class="info-card" style="border-color:#22c55e"><strong>ملاحظات الحل:</strong><br>' + ticket.notes + '</div>'
    : '';

  var body = '<div class="body">'
    + ticketInfoTable(ticket)
    + notes
    + '<p style="color:#6b7280;font-size:13px;text-align:center">إذا استمرت المشكلة، يرجى إنشاء بلاغ جديد.</p>'
    + '</div>';

  return emailWrapper('linear-gradient(135deg,#15803d,#22c55e)', header, body);
}

// ═══════════════════════════════════════════════════════
//  MANAGER ASSIGN PAGE (served via doGet)
// ═══════════════════════════════════════════════════════

function handleEmailAssignPage(ticketId, managerId, token) {
  if (!ticketId || !managerId || !token) return buildSimplePage('خطأ', '<p>رابط غير صالح.</p>');
  var expected = generateEmailToken(ticketId, managerId);
  if (token !== expected) return buildSimplePage('خطأ في التحقق', '<p>الرابط غير صالح أو انتهت صلاحيته.</p>');

  var mgRow = findUserById(managerId);
  if (!mgRow || ROLES_MGR.indexOf(mgRow[UC.role]) < 0) return buildSimplePage('غير مصرح', '<p>ليس لديك صلاحية هذه الصفحة.</p>');

  var ticket = getTicketById(ticketId);
  if (!ticket) return buildSimplePage('غير موجود', '<p>البلاغ غير موجود.</p>');
  if (ticket.status !== 'مفتوحة') {
    return buildSimplePage('تم التعيين', '<p>تم تعيين هذا البلاغ مسبقاً إلى: <strong>' + (ticket.assignedName || 'موظف IT') + '</strong></p>');
  }

  var itStaff    = getActiveITStaff();
  var assignToken = generateEmailToken(ticketId, managerId + '_assign');

  return HtmlService.createHtmlOutput(buildAssignPageHtml(ticket, itStaff, managerId, assignToken))
    .setTitle('تعيين البلاغ')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function handleEmailDoAssignGet(params) {
  var tid        = params.tid        || '';
  var uid        = params.uid        || '';
  var token      = params.token      || '';
  var assigneeId = params.assigneeId || '';

  if (!tid || !uid || !token || !assigneeId) return buildSimplePage('خطأ', '<p>بيانات ناقصة.</p>');
  var expected = generateEmailToken(tid, uid + '_assign');
  if (token !== expected) return buildSimplePage('خطأ في التحقق', '<p>الرابط غير صالح.</p>');

  var assignee = findUserById(assigneeId);
  if (!assignee) return buildSimplePage('خطأ', '<p>الموظف غير موجود.</p>');
  if (ROLES_IT.indexOf(assignee[UC.role]) < 0) return buildSimplePage('خطأ', '<p>الموظف المختار ليس من فريق IT.</p>');

  var sh   = getSheet(SH_TICKETS);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][TC.id] !== tid) continue;
    var ticket = rowToTicket(data[i]);
    if (ticket.status !== 'مفتوحة') {
      return buildSimplePage('تم التعيين', '<p>تم تعيين هذا البلاغ مسبقاً.</p>');
    }
    sh.getRange(i+1, TC.assignedId+1).setValue(assignee[UC.id]);
    sh.getRange(i+1, TC.assignedName+1).setValue(assignee[UC.name]);
    sh.getRange(i+1, TC.status+1).setValue('معينة');
    sh.getRange(i+1, TC.updatedAt+1).setValue(new Date().toISOString());
    ticket.assignedId   = assignee[UC.id];
    ticket.assignedName = assignee[UC.name];
    ticket.status       = 'معينة';
    try { notifyAssignee(ticket, assignee); } catch(e) {}
    try { notifyTeamAboutClaim(ticket); } catch(e) {}
    return buildSimplePage('✅ تم التعيين بنجاح',
      '<p>تم تعيين البلاغ <strong>' + tid + '</strong> إلى <strong>' + assignee[UC.name] + '</strong> بنجاح.</p>'
      + '<p><a href="' + SYSTEM_URL + '" style="color:#6366f1">فتح النظام</a></p>');
  }
  return buildSimplePage('خطأ', '<p>البلاغ غير موجود.</p>');
}

function buildAssignPageHtml(ticket, itStaff, managerId, assignToken) {
  var roleLabels = { it: 'موظف IT', it_manager: 'مدير IT', admin: 'مسؤول النظام' };
  var staffCards = itStaff.map(function(s) {
    var initials = s.name.split(' ').slice(0,2).map(function(w){return w[0];}).join('');
    return '<div class="staff-card" onclick="selectStaff(\'' + s.id + '\',\'' + s.name.replace(/'/g,"\\'") + '\')" id="card_' + s.id + '">'
      + '<div class="avatar">' + initials + '</div>'
      + '<div class="sname">' + s.name + '</div>'
      + '<div class="srole">' + (roleLabels[s.role] || s.role) + '</div>'
      + '</div>';
  }).join('');

  var doAssignBase = SYSTEM_URL + '?action=do-assign&tid=' + ticket.id + '&uid=' + managerId + '&token=' + assignToken;

  return '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>تعيين البلاغ</title>'
    + '<style>'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + 'body{font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f1f5f9;direction:rtl;color:#1e293b;padding:20px}'
    + '.container{max-width:680px;margin:0 auto}'
    + '.header{background:linear-gradient(135deg,#1e1b4b,#312e81,#4338ca);color:#fff;padding:24px 28px;border-radius:16px 16px 0 0}'
    + '.header h1{font-size:20px;margin-bottom:4px}'
    + '.header p{font-size:13px;opacity:.8}'
    + '.ticket-card{background:#fff;padding:20px 24px;border-bottom:1px solid #e2e8f0}'
    + '.ticket-card table{width:100%;border-collapse:collapse}'
    + '.ticket-card td{padding:6px 0;font-size:14px;color:#374151}'
    + '.ticket-card td:first-child{color:#6b7280;width:35%;font-weight:500}'
    + '.section{background:#fff;padding:20px 24px;border-bottom:1px solid #e2e8f0}'
    + '.section h2{font-size:15px;color:#374151;margin-bottom:16px;font-weight:600}'
    + '.staff-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}'
    + '.staff-card{background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:16px 12px;text-align:center;cursor:pointer;transition:.2s}'
    + '.staff-card:hover{border-color:#6366f1;background:#eef2ff}'
    + '.staff-card.selected{border-color:#6366f1;background:#eef2ff;box-shadow:0 0 0 3px rgba(99,102,241,.2)}'
    + '.avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 10px}'
    + '.sname{font-size:13px;font-weight:600;color:#1e293b}'
    + '.srole{font-size:11px;color:#6b7280;margin-top:3px}'
    + '.action{background:#fff;padding:20px 24px;border-radius:0 0 16px 16px}'
    + '#assignBtn{display:block;width:100%;padding:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;opacity:.4;pointer-events:none;transition:.2s}'
    + '#assignBtn.ready{opacity:1;pointer-events:auto}'
    + '#assignBtn:hover.ready{background:linear-gradient(135deg,#4f46e5,#7c3aed)}'
    + '.selected-name{text-align:center;margin-top:12px;font-size:13px;color:#6b7280;min-height:20px}'
    + '</style></head><body>'
    + '<div class="container">'
    + '<div class="header"><h1>👥 تعيين البلاغ لموظف IT</h1><p>اختر موظف IT لتعيين هذا البلاغ إليه</p></div>'
    + '<div class="ticket-card"><table>'
    + '<tr><td>رقم البلاغ</td><td><strong>' + ticket.id + '</strong></td></tr>'
    + '<tr><td>الموضوع</td><td><strong>' + ticket.title + '</strong></td></tr>'
    + '<tr><td>النوع</td><td>' + ticket.problemType + '</td></tr>'
    + '<tr><td>الأولوية</td><td>' + ticket.priority + '</td></tr>'
    + '<tr><td>القسم</td><td>' + ticket.requesterDept + '</td></tr>'
    + '<tr><td>مقدم الطلب</td><td>' + ticket.requesterName + '</td></tr>'
    + '</table></div>'
    + '<div class="section"><h2>فريق IT المتاح</h2>'
    + (itStaff.length ? '<div class="staff-grid">' + staffCards + '</div>'
       : '<p style="color:#9ca3af;text-align:center">لا يوجد موظفو IT نشطون</p>')
    + '</div>'
    + '<div class="action">'
    + '<button id="assignBtn" disabled>تعيين البلاغ</button>'
    + '<div class="selected-name" id="selName"></div>'
    + '</div></div>'
    + '<script>'
    + 'var selId="",base="' + doAssignBase + '";'
    + 'function selectStaff(id,name){'
    + '  document.querySelectorAll(".staff-card").forEach(function(c){c.classList.remove("selected");});'
    + '  document.getElementById("card_"+id).classList.add("selected");'
    + '  selId=id;'
    + '  document.getElementById("assignBtn").className="ready";'
    + '  document.getElementById("assignBtn").removeAttribute("disabled");'
    + '  document.getElementById("selName").textContent="الموظف المختار: "+name;'
    + '}'
    + 'document.getElementById("assignBtn").onclick=function(){'
    + '  if(!selId)return;'
    + '  this.textContent="جارٍ التعيين...";this.disabled=true;'
    + '  window.location.href=base+"&assigneeId="+selId;'
    + '};'
    + '</script></body></html>';
}

function buildSimplePage(title, content) {
  var html = '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">'
    + '<title>' + title + '</title>'
    + '<style>body{font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;direction:rtl}'
    + '.box{background:#fff;padding:40px 48px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.1);text-align:center;max-width:480px}'
    + 'h1{color:#1e293b;margin-bottom:16px;font-size:22px}'
    + 'p{color:#64748b;font-size:15px;line-height:1.7}'
    + 'a{color:#6366f1}'
    + '</style></head><body>'
    + '<div class="box"><h1>' + title + '</h1>' + content + '</div>'
    + '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle(title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ═══════════════════════════════════════════════════════
//  EMAIL — CLAIM / SOLVE via doGet
// ═══════════════════════════════════════════════════════

function handleEmailAction(action, ticketId, userId, token) {
  if (!ticketId || !token) return buildSimplePage('خطأ', '<p>رابط غير صالح.</p>');
  var expected = generateEmailToken(ticketId, action);
  if (token !== expected) return buildSimplePage('خطأ في التحقق', '<p>الرابط غير صالح أو انتهت صلاحيته.</p>');

  var ticket = getTicketById(ticketId);
  if (!ticket) return buildSimplePage('غير موجود', '<p>البلاغ غير موجود.</p>');

  var sh   = getSheet(SH_TICKETS);
  var data = sh.getDataRange().getValues();

  if (action === 'claim') {
    if (ticket.status !== 'مفتوحة') {
      return buildSimplePage('تم الاستلام', '<p>تم استلام هذا البلاغ مسبقاً.' + (ticket.assignedName ? ' المسؤول: <strong>' + ticket.assignedName + '</strong>' : '') + '</p>');
    }
    for (var i = 1; i < data.length; i++) {
      if (data[i][TC.id] !== ticketId) continue;
      sh.getRange(i+1, TC.status+1).setValue('معينة');
      sh.getRange(i+1, TC.updatedAt+1).setValue(new Date().toISOString());
    }
    return buildSimplePage('✅ تم استلام البلاغ', '<p>تم تسجيل استلام البلاغ <strong>' + ticketId + '</strong> بنجاح.</p><p><a href="' + SYSTEM_URL + '">فتح النظام</a></p>');
  }

  if (action === 'solve') {
    if (ticket.status === 'محلولة') {
      return buildSimplePage('تم الحل', '<p>تم حل هذا البلاغ مسبقاً.</p>');
    }
    var now = new Date().toISOString();
    for (var i = 1; i < data.length; i++) {
      if (data[i][TC.id] !== ticketId) continue;
      sh.getRange(i+1, TC.status+1).setValue('محلولة');
      sh.getRange(i+1, TC.solvedAt+1).setValue(now);
      sh.getRange(i+1, TC.updatedAt+1).setValue(now);
      ticket.status   = 'محلولة';
      ticket.solvedAt = now;
      try { notifyRequesterSolved(ticket); } catch(e) {}
    }
    return buildSimplePage('✅ تم تسجيل الحل', '<p>تم تسجيل حل البلاغ <strong>' + ticketId + '</strong> بنجاح.</p><p><a href="' + SYSTEM_URL + '">فتح النظام</a></p>');
  }

  return buildSimplePage('خطأ', '<p>إجراء غير معروف.</p>');
}

// ═══════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════

function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    var headers = {
      Users:         ['id','name','empId','email','role','dept','password','active','internet'],
      Tickets:       ['id','title','desc','problemType','priority','status','requesterId','requesterName','requesterDept','assignedId','assignedName','createdAt','updatedAt','solvedAt','notes'],
      Sessions:      ['token','userId','expires'],
      Notifications: ['id','userId','ticketId','message','read','createdAt'],
      Departments:   ['id','name']
    };
    if (headers[name]) sh.appendRow(headers[name]);
  }
  return sh;
}

function requireRole(sess, roles) {
  if (!sess) throw new Error('غير مصرح');
  if (roles.indexOf(sess.role) < 0) throw new Error('ليس لديك صلاحية هذا الإجراء');
}

function generateId() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 16);
}

function jsonResp(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function errResp(msg) {
  return ContentService.createTextOutput(JSON.stringify({ error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════
//  SETUP — شغّلها مرة وحدة بس
// ═══════════════════════════════════════════════════════

function setupInitialData() {
  // صنع الشيتات
  getSheet(SH_USERS);
  getSheet(SH_TICKETS);
  getSheet(SH_SESSIONS);
  getSheet(SH_NOTIFS);
  getSheet(SH_DEPTS);

  // تحقق إذا في يوزر admin موجود
  var us = getSheet(SH_USERS).getDataRange().getValues();
  for (var i = 1; i < us.length; i++) {
    if (us[i][UC.role] === 'admin') {
      Logger.log('✅ يوجد admin مسبقاً: ' + us[i][UC.empId]);
      return;
    }
  }

  // أضف يوزر admin
  var row = new Array(9).fill('');
  row[UC.id]       = 'U000000001';
  row[UC.name]     = 'مدير النظام';
  row[UC.empId]    = '1001';
  row[UC.email]    = '';
  row[UC.role]     = 'admin';
  row[UC.dept]     = 'IT';
  row[UC.password] = '1001';
  row[UC.active]   = true;
  row[UC.internet] = '';
  getSheet(SH_USERS).appendRow(row);

  // أضف قسم افتراضي
  var depts = getSheet(SH_DEPTS).getDataRange().getValues();
  if (depts.length <= 1) {
    getSheet(SH_DEPTS).appendRow(['D000001', 'قسم IT']);
    getSheet(SH_DEPTS).appendRow(['D000002', 'قسم المحاسبة']);
    getSheet(SH_DEPTS).appendRow(['D000003', 'قسم الإدارة']);
  }

  Logger.log('✅ تم الإعداد بنجاح!');
  Logger.log('👤 رقم الموظف: 1001');
  Logger.log('🔑 كلمة المرور: 1001');
  Logger.log('🔐 الدور: admin');
}
