const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const statuses = ['New', 'Under review', 'Assigned', 'In progress', 'Resolved', 'Rejected', 'Needs information'];
const authDialog = $('#auth-dialog'), reportDialog = $('#report-dialog'), successDialog = $('#success-dialog');
let authMode = 'login', user = loadUser(), publicReports = [], activeReports = [], staffUsers = [], departments = [];
function loadUser() { try { return JSON.parse(localStorage.getItem('resolvex.user') || 'null'); } catch { return null; } }
function token() { return localStorage.getItem('resolvex.token'); }
async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token()) headers.set('Authorization', `Bearer ${token()}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && url.startsWith('/api/')) { signOut(false); }
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body;
}
function showAuth() { authDialog.showModal(); }
function signOut(refresh = true) { localStorage.removeItem('resolvex.token'); localStorage.removeItem('resolvex.user'); user = null; updateAccount(); if (refresh) refreshPublic(); $('#workspace').hidden = true; }
function updateAccount() {
  $('#account-button').textContent = user ? 'Sign out' : 'Sign in';
  $('#workspace-link').hidden = !user;
  $$('[data-open-report]').forEach(button => button.title = user ? '' : 'Sign in to submit a report');
}
$$('[data-open-report]').forEach(button => button.addEventListener('click', () => user ? reportDialog.showModal() : showAuth()));
$$('[data-close]').forEach(button => button.addEventListener('click', () => { reportDialog.close(); successDialog.close(); }));
$$('[data-close-auth]').forEach(button => button.addEventListener('click', () => authDialog.close()));
$('#account-button').addEventListener('click', () => user ? signOut() : showAuth());
$('#workspace-link').addEventListener('click', event => { event.preventDefault(); $('#workspace').hidden = false; $('#workspace').scrollIntoView({ behavior: 'smooth' }); loadWorkspace(); });
$('#refresh-workspace').addEventListener('click', loadWorkspace);

function renderPublic() {
  const q = $('#search').value.trim().toLowerCase(), filter = $('#filter-status').value;
  const rows = publicReports.filter(r => (!filter || r.status === filter) && (!q || `${r.category} ${r.description} ${r.location}`.toLowerCase().includes(q)));
  $('#public-reports').innerHTML = rows.length ? rows.map(r => `<article class="report-card"><div class="report-meta"><span class="category-chip">${esc(r.category)}</span><span class="report-status"><i class="tiny-dot ${r.status === 'Resolved' ? '' : 'orange'}"></i>${esc(r.status)}</span>${r.demo ? '<span class="demo-badge">DEMO SAMPLE</span>' : ''}</div><h3>${esc(r.description.slice(0, 85))}${r.description.length > 85 ? '…' : ''}</h3><p class="report-desc">${esc(r.publicUpdate || 'This report has been approved for public viewing.')}</p><p class="severity-note">${esc(r.severityLabel)}: <b>${esc(r.severityRecommendation || 'Not rated')}</b></p><footer><span>⌖ ${esc(r.location)}</span><span>${new Date(r.createdAt).toLocaleDateString()}</span></footer><div class="tracking-small">${esc(r.trackingId)}</div></article>`).join('') : '<div class="empty-state">No public reports match that search. Approved reports appear here after staff review.</div>';
}
async function refreshPublic() {
  try {
    const [reports, dash, directory] = await Promise.all([api('/api/reports/public'), api('/api/dashboard'), api('/api/departments')]);
    publicReports = reports.reports || [];
    departments = directory.departments || [];
    $('#stat-total').textContent = dash.total ?? '0';
    $('#stat-progress').textContent = ['New', 'Under review', 'Assigned', 'In progress', 'Needs information'].reduce((total, status) => total + (dash.statuses?.[status] || 0), 0);
    $('#stat-resolved').textContent = dash.statuses?.Resolved || 0;
    $('.demo-note').textContent = dash.demoDataIncluded ? 'ⓘ Includes clearly labelled demo samples · Platform updates only' : 'ⓘ Approved reports only · Platform updates only';
    renderPublic();
    renderDirectory();
  } catch { $('#public-reports').innerHTML = '<div class="empty-state">The database is not ready yet. Configure PostgreSQL and follow the setup steps in README.md.</div>'; }
}
function renderDirectory() {
  const root = $('#authority-directory');
  root.innerHTML = departments.length ? departments.map(d => `<article class="directory-card"><span class="eyebrow">${esc(d.jurisdiction)}</span><h3>${esc(d.name)}</h3><p>${esc(d.description)}</p><div class="category-list">${(d.categories || []).map(c => `<span>${esc(c)}</span>`).join('')}</div><p class="directory-label">${d.demo ? 'Demo data' : 'Official source listed'} · Department responsibility is configured for this category</p><div class="directory-links">${d.officialWebsite ? `<a href="${esc(d.officialWebsite)}" target="_blank" rel="noreferrer">Official website ↗</a>` : ''}${d.complaintPortal ? `<a href="${esc(d.complaintPortal)}" target="_blank" rel="noreferrer">Grievance information ↗</a>` : ''}</div>${(d.contacts || []).map(c => `<div class="directory-contact"><b>${esc(c.label)}</b>${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : ''}${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}${c.website ? `<a href="${esc(c.website)}" target="_blank" rel="noreferrer">Open service ↗</a>` : ''}<span>${esc(c.verification)} · ${c.lastVerifiedAt ? `checked ${new Date(c.lastVerifiedAt).toLocaleDateString()}` : 'not verified'} · <a href="${esc(c.sourceUrl)}" target="_blank" rel="noreferrer">Source ↗</a></span><small>${esc(c.notes || '')}</small></div>`).join('')}</article>`).join('') : '<div class="empty-state">No source-backed departments are configured yet. Reports without a directory match remain unassigned.</div>';
}
$('#search').addEventListener('input', renderPublic); $('#filter-status').addEventListener('change', renderPublic);

$('#auth-switch').addEventListener('click', () => { authMode = authMode === 'login' ? 'register' : 'login'; updateAuthMode(); });
function updateAuthMode() {
  const register = authMode === 'register';
  $('#auth-title').textContent = register ? 'Create an account' : 'Sign in';
  $('#auth-name-wrap').hidden = !register;
  $('input[name=name]', $('#auth-form')).required = register;
  $('input[name=password]', $('#auth-form')).autocomplete = register ? 'new-password' : 'current-password';
  $('#auth-submit').textContent = register ? 'Create account' : 'Sign in';
  $('#auth-switch-copy').textContent = register ? 'Already registered?' : 'New to ResolveX?';
  $('#auth-switch').textContent = register ? 'Sign in' : 'Create an account';
  $('#auth-error').textContent = '';
}
$('#auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget, button = $('#auth-submit'), data = Object.fromEntries(new FormData(form));
  button.disabled = true; $('#auth-error').textContent = '';
  try {
    const result = await api(`/api/auth/${authMode}`, { method: 'POST', body: JSON.stringify(data) });
    localStorage.setItem('resolvex.token', result.token); localStorage.setItem('resolvex.user', JSON.stringify(result.user)); user = result.user;
    updateAccount(); authDialog.close(); form.reset();
    if (user.role !== 'CITIZEN') { $('#workspace').hidden = false; loadWorkspace(); }
    refreshPublic();
  } catch (e) { $('#auth-error').textContent = e.message; }
  finally { button.disabled = false; }
});

function draftText(report, department) {
  return `Hello ${department?.name || 'Sir/Madam'},\n\nI am writing to report a ${String(report.category || '').toLowerCase()} issue at ${report.locationText || report.location || '[location]'}.\n\n${report.description}\n\nResolveX tracking ID: ${report.trackingId}\n\nPlease let me know if further information is needed.\n\nThank you`;
}
function authorityMarkupBase(report) {
  const department = report.department;
  if (!department) return '<div class="contact-card"><strong>No department match confirmed</strong><p class="contact-warning">ResolveX could not identify a verified responsible authority for this category. Check official Bengaluru government channels before contacting an agency.</p><a href="https://bbmp.gov.in/" target="_blank" rel="noreferrer">Greater Bengaluru Authority official homepage ↗</a><p class="contact-source">The homepage lists SAHAAYA 2.0 public grievances and helpline <a href="tel:1533">1533</a>. ResolveX cannot confirm that this issue belongs to that authority.</p><label>Record communication<select class="comm-state"><option>Draft prepared</option><option>Citizen says submitted</option><option>Reference recorded</option><option>Acknowledgement recorded</option><option>Response recorded</option><option>Awaiting response</option></select></label><input class="comm-reference" placeholder="Official reference number (optional)"><button class="small-action save-communication" type="button">Save citizen-reported update</button><span class="comm-result"></span></div>';
  const contacts = department.contacts || [];
  const email = contacts.find(c => c.email)?.email || '', phone = contacts.find(c => c.phone)?.phone || '', source = contacts[0]?.sourceUrl || department.officialWebsite;
  const portal = department.complaintPortal || department.officialWebsite;
  const draft = draftText(report, department), subject = `Civic issue report ${report.trackingId}: ${report.category}`;
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(draft)}`;
  return `<div class="contact-card"><strong>${esc(department.name)}</strong><p>${esc(department.description)}</p><p class="contact-source">Contact data status: ${esc(contacts.map(c => c.verification).filter(Boolean).join(', ') || 'No contact records')} · Verified: ${esc(contacts.map(c => c.lastVerifiedAt ? new Date(c.lastVerifiedAt).toLocaleDateString() : '').filter(Boolean).join(', ') || 'not verified')}</p>${email ? `<p>Email: <a class="open-email" data-recipient="${esc(email)}" data-subject="${esc(subject)}" href="${mailto}">Open editable email draft</a> · <button class="inline-action copy-draft" type="button">Copy draft</button></p>` : '<p class="contact-warning">No department email is listed. Do not infer an address.</p>'}${phone ? `<p>Phone: <a href="tel:${esc(phone)}">${esc(phone)}</a> (you initiate the call)</p>` : '<p>No department phone is listed in the directory.</p>'}${portal ? `<p>Official grievance information: <a href="${esc(portal)}" target="_blank" rel="noreferrer">Open official page ↗</a></p>` : ''}<p><a href="${esc(source || portal || 'https://bbmp.gov.in/') }" target="_blank" rel="noreferrer">View official source ↗</a></p><p class="contact-warning">Opening a draft, calling, or opening the authority site does not submit a complaint.</p><details><summary>Edit / copy complaint text</summary><textarea class="draft-text">${esc(draft)}</textarea></details><label>Record communication<select class="comm-state"><option>Draft prepared</option><option>Citizen says submitted</option><option>Reference recorded</option><option>Acknowledgement recorded</option><option>Response recorded</option><option>Awaiting response</option></select></label><input class="comm-reference" placeholder="Official reference number (optional)"><button class="small-action save-communication" type="button">Save citizen-reported update</button><span class="comm-result"></span></div>`;
}
function authorityMarkup(report) {
  let markup = authorityMarkupBase(report);
  if (!user || report.reporterId !== user.id) return markup;
  const controls = `<div class="workspace-actions"><button class="small-action generate-email-draft" data-report-id="${esc(report.id)}" type="button">Generate complaint email draft</button><span class="draft-result">Editable template; review before sending.</span></div>`;
  if (!markup.includes('class="draft-text"')) {
    markup = markup.replace('</div>', `<details><summary>Edit / copy complaint text</summary><textarea class="draft-text">${esc(draftText(report, report.department))}</textarea></details><button class="inline-action copy-draft" type="button">Copy draft</button>${controls}</div>`);
  } else {
    markup = markup.replace('</div>', `${controls}</div>`);
  }
  return markup;
}
function reportCard(report, staff, admin = false) {
  const analysis = report.aiProvider === 'demo-seed' ? 'Fictional sample content; no AI analysis was run.' : report.aiProvider === 'local-fallback' ? 'Fallback suggestion; AI service unavailable.' : `AI recommendation · ${Math.round((report.aiConfidence || 0) * 100)}% confidence · review required`;
  const media = (report.media || []).map(m => `<a href="${esc(m.url || `/api/media/${m.id}`)}" target="_blank" rel="noreferrer">${m.kind?.startsWith('resolution-') ? 'Resolution evidence' : esc(m.kind || 'Media')} (${esc(m.originalName || 'open file')})</a>`).join(' · ');
  const staffActions = staff ? `<div class="workspace-actions"><select class="status-select" aria-label="Set report status">${statuses.map(s => `<option ${report.status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select><button class="workspace-action update-status" type="button">Save status</button></div><label class="public-summary-label">Public-safe summary (required before approval)<textarea class="public-summary" maxlength="400" placeholder="Write only what is safe to publish">${esc(report.publicSummary || '')}</textarea></label><div class="workspace-actions"><button class="workspace-action public-toggle" type="button" data-approved="${report.publicApproved}" ${report.demo ? 'disabled' : ''}>${report.demo ? (report.publicApproved ? 'Demo sample is public' : 'Demo sample cannot be changed') : report.publicApproved ? 'Hide publicly' : 'Approve for public view'}</button>${report.demo ? '<span class="demo-badge">DEMO DATA · fictional sample</span>' : ''}</div><div class="workspace-actions"><input type="file" class="resolution-file" accept="image/jpeg,image/png,image/webp" multiple><button class="workspace-action upload-resolution" type="button">Upload resolution evidence</button></div>${admin ? `<div class="workspace-actions"><select class="assignee-select"><option value="">Select officer…</option>${staffUsers.map(u => `<option value="${esc(u.id)}" ${report.assigneeId === u.id ? 'selected' : ''}>${esc(u.name)} (${esc(u.role)})</option>`).join('')}</select><button class="workspace-action assign-report" type="button">Assign</button></div>` : ''}` : '';
  const comm = !staff ? `<div class="workspace-actions"><select class="comm-state"><option>Draft prepared</option><option>Citizen says submitted</option><option>Reference recorded</option><option>Acknowledgement recorded</option><option>Response recorded</option><option>Awaiting response</option></select><input class="comm-reference" placeholder="Reference no. (optional)"><button class="workspace-action save-communication" type="button">Record update</button><span class="comm-result"></span></div>${authorityMarkup(report)}` : `<details><summary>Department / citizen communication details</summary>${authorityMarkup(report)}</details>`;
  const timeline = (report.history || []).map(h => `<li><b>${esc(h.status)}</b> · ${new Date(h.createdAt).toLocaleString()}${h.note ? `<br>${esc(h.note)}` : ''}</li>`).join('');
  const communications = (report.communications || []).map(c => `<li>${esc(c.state)} · ${new Date(c.createdAt).toLocaleString()} · ${esc(c.source)}${c.reference ? ` · Ref ${esc(c.reference)}` : ''}</li>`).join('');
  return `<article class="workspace-card" data-report-id="${esc(report.id)}"><div class="report-meta"><span class="category-chip">${esc(report.category)}</span><span class="report-status">${esc(report.status)}</span>${report.demo ? '<span class="demo-badge">DEMO DATA</span>' : ''}</div><h3>${esc(report.aiSummary || report.description)}</h3><p>${esc(report.description)}</p><p>⌖ ${esc(report.locationText || '')} · <span class="tracking-small">${esc(report.trackingId)}</span></p><div class="analysis-box"><b>AI is assistive, not a verified fact.</b><br>${esc(analysis)}<br>Suggested: ${esc(report.aiCategory || report.category)} · ${esc(report.aiSeverity || report.severity || 'Unrated')}<br>${esc(report.aiExplanation || '')}</div><p>${media || 'No evidence attached.'}</p><details><summary>Report timeline and external contact updates</summary><ol class="timeline">${timeline || '<li>Timeline updates appear here.</li>'}${communications}</ol></details>${staffActions}${comm}</article>`;
}
async function loadWorkspace() {
  if (!user) return showAuth();
  const content = $('#workspace-content');
  content.innerHTML = '<div class="empty-state">Loading reports…</div>';
  $('#workspace-title').textContent = user.role === 'CITIZEN' ? 'My reports' : `${user.role === 'ADMIN' ? 'Admin' : 'Officer'} workspace`;
  try {
    const scope = user.role === 'CITIZEN' ? 'mine' : 'queue';
    const data = await api(`/api/reports?scope=${scope}`); activeReports = data.reports || [];
    staffUsers = user.role === 'ADMIN' ? (await api('/api/users')).users : [];
    const staff = user.role !== 'CITIZEN';
    const adminTools = user.role === 'ADMIN' ? `<div class="workspace-reports admin-tools"><form id="department-create" class="workspace-card"><h3>Add directory department</h3><label>Name<input name="name" required></label><label>Responsibilities<textarea name="description" required></textarea></label><label>Categories (comma separated)<input name="categories" placeholder="Road / pothole damage"></label><label>Official website<input name="officialWebsite" type="url"></label><label>Grievance page<input name="complaintPortal" type="url"></label><button class="workspace-action">Save department</button><span class="comm-result"></span></form><form id="contact-create" class="workspace-card"><h3>Add sourced contact</h3><label>Department<select name="departmentId" required>${departments.map(d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</select></label><label>Contact label<input name="label" required></label><label>Phone<input name="phone"></label><label>Email<input name="email" type="email"></label><label>Website<input name="website" type="url"></label><label>Official source URL<input name="sourceUrl" type="url" required></label><label>Notes<input name="notes"></label><label class="consent-check"><input name="verified" type="checkbox"> I checked this information against the source</label><button class="workspace-action">Save contact</button><span class="comm-result"></span></form></div>` : '';
    content.innerHTML = `${staff ? `<p class="fine-print">Signed in as ${esc(user.name)} · ${esc(user.role)}. Officer updates are limited to assigned reports; admin can assign staff.</p>` : ''}${user.role === 'ADMIN' ? `<form id="staff-create" class="workspace-card"><h3>Create staff account</h3><label>Name<input name="name" required></label><label>Email<input name="email" required type="email"></label><label>Temporary password<input name="password" required minlength="10" type="password"></label><label>Role<select name="role"><option>OFFICER</option><option>ADMIN</option></select></label><button class="workspace-action">Create staff account</button><span class="comm-result"></span></form>${adminTools}` : ''}<div class="workspace-reports">${activeReports.length ? activeReports.map(r => reportCard(r, staff, user.role === 'ADMIN')).join('') : '<div class="empty-state">No reports here yet.</div>'}</div>`;
    if (user.role === 'ADMIN') $('#staff-create').addEventListener('submit', async e => { e.preventDefault(); const form = e.currentTarget; const result = $('.comm-result', form); try { const payload = Object.fromEntries(new FormData(form)); await api('/api/auth/users', { method: 'POST', body: JSON.stringify(payload) }); result.textContent = 'Account created. Share login details securely.'; form.reset(); } catch (error) { result.textContent = error.message; } });
    if (user.role === 'ADMIN') $('#department-create').addEventListener('submit', async e => { e.preventDefault(); const form = e.currentTarget; const result = $('.comm-result', form); const data = Object.fromEntries(new FormData(form)); data.categories = data.categories.split(',').map(v => v.trim()).filter(Boolean); try { await api('/api/departments', { method: 'POST', body: JSON.stringify(data) }); result.textContent = 'Department saved.'; await refreshPublic(); await loadWorkspace(); } catch (error) { result.textContent = error.message; } });
    if (user.role === 'ADMIN') $('#contact-create').addEventListener('submit', async e => { e.preventDefault(); const form = e.currentTarget; const result = $('.comm-result', form); const data = Object.fromEntries(new FormData(form)); data.verified = new FormData(form).has('verified'); try { await api(`/api/departments/${data.departmentId}/contacts`, { method: 'POST', body: JSON.stringify(data) }); result.textContent = 'Contact saved with its source and verification state.'; await refreshPublic(); await loadWorkspace(); } catch (error) { result.textContent = error.message; } });
    bindWorkspaceActions(content);
  } catch (e) { content.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}
function bindWorkspaceActions(root) {
  root.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button) return;
    const card = button.closest('[data-report-id]');
    if (!card && button.type === 'submit') return;
    if (!card) return;
    const id = card.dataset.reportId;
    try {
      if (button.classList.contains('update-status')) await api(`/api/reports/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: $('.status-select', card).value }) });
      else if (button.classList.contains('public-toggle')) {
        const approved = button.dataset.approved !== 'true';
        await api(`/api/reports/${id}/public`, { method: 'PATCH', body: JSON.stringify({ approved, publicSummary: $('.public-summary', card)?.value || '' }) });
      }
      else if (button.classList.contains('assign-report')) {
        const assigneeId = $('.assignee-select', card).value;
        if (!assigneeId) throw new Error('Choose an officer first.');
        await api(`/api/reports/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ assigneeId }) });
      }
      else if (button.classList.contains('save-communication')) {
        const result = await api(`/api/reports/${id}/communication`, { method: 'POST', body: JSON.stringify({ state: $('.comm-state', card).value, reference: $('.comm-reference', card)?.value || '', channel: 'citizen-entered' }) });
        $('.comm-result', card).textContent = `${result.communication.source} update saved.`;
        return;
      } else if (button.classList.contains('upload-resolution')) {
        const files = $('.resolution-file', card).files;
        if (!files.length) throw new Error('Choose one or more evidence files first.');
        const body = new FormData(); [...files].forEach(f => body.append('media', f));
        await api(`/api/reports/${id}/media`, { method: 'POST', body });
      } else if (button.classList.contains('copy-draft')) {
        await navigator.clipboard.writeText($('.draft-text', card).value); button.textContent = 'Copied'; return;
      } else return;
      await loadWorkspace(); refreshPublic();
    } catch (e) { const result = $('.comm-result', card); if (result) result.textContent = e.message; else alert(e.message); }
  });
}

$('#use-location').addEventListener('click', () => {
  const button = $('#use-location');
  if (!navigator.geolocation) return ($('#form-error').textContent = 'Location is not available in this browser. Type a nearby landmark instead.');
  button.disabled = true; button.textContent = 'Getting location…';
  navigator.geolocation.getCurrentPosition(position => {
    $('input[name=latitude]', $('#report-form')).value = position.coords.latitude;
    $('input[name=longitude]', $('#report-form')).value = position.coords.longitude;
    button.textContent = '✓ Location added'; button.disabled = false;
  }, () => { button.textContent = '⌖ Use my current location (optional)'; button.disabled = false; $('#form-error').textContent = 'Location permission was not granted. You can type a landmark instead.'; }, { enableHighAccuracy: false, timeout: 10000 });
});
document.addEventListener('click', async event => {
  const generate = event.target.closest('.generate-email-draft');
  if (generate) {
    const panel = generate.closest('.contact-card'), result = $('.draft-result', panel);
    generate.disabled = true;
    if (result) result.textContent = 'Preparing draft…';
    try {
      const data = await api(`/api/reports/${encodeURIComponent(generate.dataset.reportId)}/email-draft`, { method: 'POST', body: '{}' });
      $('.draft-text', panel).value = data.draft.body;
      const emailLink = $('.open-email', panel);
      if (emailLink) emailLink.dataset.subject = data.draft.subject;
      if (result) result.textContent = `${data.label}. ${data.message}`;
    } catch (error) {
      if (result) result.textContent = error.message;
    } finally { generate.disabled = false; }
    return;
  }
  const link = event.target.closest('.open-email');
  if (!link) return;
  event.preventDefault();
  const panel = link.closest('.contact-card'), body = $('.draft-text', panel)?.value || '';
  window.location.href = `mailto:${encodeURIComponent(link.dataset.recipient)}?subject=${encodeURIComponent(link.dataset.subject)}&body=${encodeURIComponent(body)}`;
});
$('#report-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!user) { reportDialog.close(); showAuth(); return; }
  const form = event.currentTarget, button = $('.submit-button', form), error = $('#form-error');
  button.disabled = true; error.textContent = '';
  try {
    const body = new FormData(form);
    for (const [key, value] of [...body.entries()]) if (value === '' || value instanceof File && !value.name) body.delete(key);
    const result = await api('/api/reports', { method: 'POST', body });
    reportDialog.close(); form.reset(); $('#use-location').textContent = '⌖ Use my current location (optional)';
    showSuccess(result); refreshPublic();
  } catch (e) { error.textContent = e.message; }
  finally { button.disabled = false; button.innerHTML = 'Save my report <span>↗</span>'; }
});
function showSuccess(result) {
  const report = result.report;
  $('#tracking-id').textContent = report.trackingId;
  const a = result.analysis;
  $('#success-copy').innerHTML = `Saved in ResolveX. No authority has been contacted.<div class="analysis-box"><b>${esc(a.label)}</b><br>${esc(a.summary)}<br>Suggested ${esc(a.category)} · ${esc(a.severity)} · ${Math.round((a.confidence || 0) * 100)}% confidence<br>${esc(a.explanation)}</div>`;
  $('#contact-info').innerHTML = authorityMarkup(report);
  $$('.save-communication', $('#contact-info')).forEach(button => button.addEventListener('click', async () => {
    const card = $('#contact-info');
    try { const result = await api(`/api/reports/${report.id}/communication`, { method: 'POST', body: JSON.stringify({ state: $('.comm-state', card).value, reference: $('.comm-reference', card).value, channel: 'citizen-selected' }) }); $('.comm-result', card).textContent = `${result.communication.source} update saved.`; }
    catch (e) { $('.comm-result', card).textContent = e.message; }
  }));
  $('.copy-draft', $('#contact-info'))?.addEventListener('click', async e => { await navigator.clipboard.writeText($('.draft-text', $('#contact-info')).value); e.currentTarget.textContent = 'Copied'; });
  successDialog.showModal();
}

updateAccount(); updateAuthMode(); refreshPublic();
