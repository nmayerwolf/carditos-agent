import { Request, Response } from 'express';
import { supabase } from '../db/client.js';
import {
  updateUser,
  getOrCreateConversation,
  storeMessage,
} from '../services/conversations.js';
import { kapsoClient } from '../services/whatsapp.js';
import { logger } from '../lib/logger.js';
import { WELCOME_MSG } from '../lib/messages.js';

function checkToken(req: Request, res: Response): boolean {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    res.status(500).json({ error: 'ADMIN_TOKEN not configured' });
    return false;
  }
  const token = (req.query.token as string) || req.headers['x-admin-token'];
  if (token !== adminToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

const PANEL_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Carditos Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #f0f2f5; color: #1a1a2e; }
    header { background: #1a1a2e; color: white; padding: 16px 32px; display: flex; align-items: center; gap: 12px; }
    header h1 { font-size: 20px; font-weight: 700; }
    main { max-width: 1000px; margin: 32px auto; padding: 0 20px; }
    .section { margin-bottom: 40px; }
    .section-title { font-size: 13px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; }
    .card { background: white; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f8f9fa; padding: 11px 16px; text-align: left; font-size: 12px; color: #888; font-weight: 600; border-bottom: 1px solid #eee; }
    td { padding: 13px 16px; border-bottom: 1px solid #f4f4f4; font-size: 14px; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge.pending_name     { background: #fff3cd; color: #856404; }
    .badge.pending_approval { background: #cfe2ff; color: #084298; }
    .badge.approved         { background: #d1e7dd; color: #0a3622; }
    .badge.rejected         { background: #f8d7da; color: #842029; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .btn { padding: 5px 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: opacity .15s; }
    .btn:hover { opacity: .82; }
    .btn-approve { background: #198754; color: white; }
    .btn-reject  { background: #dc3545; color: white; }
    .btn-edit    { background: #6c757d; color: white; }
    .empty { padding: 32px; text-align: center; color: #bbb; font-size: 14px; }

    /* Modal */
    .overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 200; align-items: center; justify-content: center; }
    .overlay.open { display: flex; }
    .modal { background: white; border-radius: 12px; padding: 28px 32px; width: 100%; max-width: 420px; box-shadow: 0 8px 32px rgba(0,0,0,.18); }
    .modal h2 { font-size: 17px; margin-bottom: 20px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 12px; font-weight: 600; color: #666; margin-bottom: 5px; text-transform: uppercase; letter-spacing: .04em; }
    .field input, .field select { width: 100%; padding: 9px 12px; border: 1px solid #ddd; border-radius: 7px; font-size: 14px; outline: none; transition: border .15s; }
    .field input:focus, .field select:focus { border-color: #1a1a2e; }
    .modal-actions { display: flex; gap: 10px; margin-top: 24px; }
    .btn-save   { background: #1a1a2e; color: white; padding: 9px 20px; font-size: 14px; }
    .btn-cancel { background: #f0f2f5; color: #555; padding: 9px 20px; font-size: 14px; }
    .toast { position: fixed; bottom: 24px; right: 24px; background: #1a1a2e; color: white; padding: 11px 20px; border-radius: 8px; font-size: 13px; display: none; z-index: 300; }
  </style>
</head>
<body>
<header>
  <span style="font-size:24px">🏉</span>
  <h1>Carditos Admin</h1>
</header>
<main>
  <div class="section">
    <div class="section-title">Solicitudes pendientes</div>
    <div class="card" id="pending-card"><div class="empty">Cargando...</div></div>
  </div>
  <div class="section">
    <div class="section-title">Todos los usuarios</div>
    <div class="card" id="all-card"><div class="empty">Cargando...</div></div>
  </div>
</main>

<!-- Modal edición -->
<div class="overlay" id="overlay">
  <div class="modal">
    <h2>Editar usuario</h2>
    <input type="hidden" id="edit-id">
    <div class="field"><label>Nombre</label><input type="text" id="edit-name" placeholder="Sin nombre"></div>
    <div class="field"><label>Teléfono</label><input type="text" id="edit-phone"></div>
    <div class="field">
      <label>Estado</label>
      <select id="edit-status">
        <option value="pending_name">Sin nombre</option>
        <option value="pending_approval">Esperando aprobación</option>
        <option value="approved">Aprobado</option>
        <option value="rejected">Rechazado</option>
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn btn-save" onclick="saveEdit()">Guardar</button>
      <button class="btn btn-cancel" onclick="closeModal()">Cancelar</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
  const TOKEN = new URLSearchParams(location.search).get('token') || '';
  let allUsers = [];

  const STATUS_LABELS = {
    pending_name: 'Sin nombre',
    pending_approval: 'Esperando aprobación',
    approved: 'Aprobado',
    rejected: 'Rechazado'
  };

  function fmt(d) {
    return new Date(d).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' });
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
  }

  async function api(path, method = 'GET', body) {
    const opts = { method, headers: {} };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch(path + '?token=' + TOKEN, opts);
    return res.json();
  }

  function openEdit(id) {
    const u = allUsers.find(u => u.id === id);
    if (!u) return;
    document.getElementById('edit-id').value = u.id;
    document.getElementById('edit-name').value = u.name || '';
    document.getElementById('edit-phone').value = u.phone_number;
    document.getElementById('edit-status').value = u.status;
    document.getElementById('overlay').classList.add('open');
  }

  function closeModal() {
    document.getElementById('overlay').classList.remove('open');
  }

  async function saveEdit() {
    const id = document.getElementById('edit-id').value;
    await api('/admin/users/' + id, 'PUT', {
      name: document.getElementById('edit-name').value.trim(),
      phone_number: document.getElementById('edit-phone').value.trim(),
      status: document.getElementById('edit-status').value,
    });
    closeModal();
    toast('Usuario actualizado ✓');
    load();
  }

  async function approve(id) {
    await api('/admin/users/' + id + '/approve', 'POST');
    toast('Usuario aprobado ✓');
    load();
  }

  async function reject(id) {
    await api('/admin/users/' + id + '/reject', 'POST');
    toast('Usuario rechazado');
    load();
  }

  function buildRow(u, showActions) {
    const actions = showActions
      ? '<button class="btn btn-approve" onclick="approve(\\'' + u.id + '\\')">Aprobar</button>' +
        '<button class="btn btn-reject" onclick="reject(\\'' + u.id + '\\')">Rechazar</button>'
      : '';
    return '<tr>' +
      '<td>' + (u.name || '<em style="color:#bbb">—</em>') + '</td>' +
      '<td>' + u.phone_number + '</td>' +
      '<td><span class="badge ' + u.status + '">' + STATUS_LABELS[u.status] + '</span></td>' +
      '<td>' + fmt(u.created_at) + '</td>' +
      '<td><div class="actions">' + actions +
        '<button class="btn btn-edit" onclick="openEdit(\\'' + u.id + '\\')">Editar</button>' +
      '</div></td></tr>';
  }

  function render() {
    const pending = allUsers.filter(u => u.status === 'pending_name' || u.status === 'pending_approval');
    const rest    = allUsers.filter(u => u.status === 'approved' || u.status === 'rejected');
    const THEAD   = '<table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>';

    const pc = document.getElementById('pending-card');
    pc.innerHTML = pending.length
      ? THEAD + pending.map(u => buildRow(u, true)).join('') + '</tbody></table>'
      : '<div class="empty">No hay solicitudes pendientes</div>';

    const ac = document.getElementById('all-card');
    ac.innerHTML = rest.length
      ? THEAD + rest.map(u => buildRow(u, false)).join('') + '</tbody></table>'
      : '<div class="empty">No hay usuarios</div>';
  }

  async function load() {
    allUsers = await api('/admin/users');
    render();
  }

  document.getElementById('overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  load();
</script>
</body>
</html>`;

export async function adminPanelHandler(req: Request, res: Response) {
  if (!checkToken(req, res)) return;
  res.setHeader('Content-Type', 'text/html');
  res.send(PANEL_HTML);
}

export async function adminListUsersHandler(req: Request, res: Response) {
  if (!checkToken(req, res)) return;
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    logger.error(error, 'Admin: failed to list users');
    return res.status(500).json({ error: 'DB error' });
  }
  res.json(data || []);
}

export async function adminApproveHandler(req: Request, res: Response) {
  if (!checkToken(req, res)) return;
  const id = req.params.id as string;

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !user) return res.status(404).json({ error: 'User not found' });

  await updateUser(id, { status: 'approved' });

  try {
    const conversation = await getOrCreateConversation(id, undefined);
    await storeMessage(conversation.id, id, 'outbound', WELCOME_MSG);
    await kapsoClient.sendMessage(user.phone_number as string, WELCOME_MSG);
  } catch (err) {
    logger.error(err, 'Admin: failed to send welcome message');
  }

  logger.info({ userId: id }, 'Admin: user approved');
  res.json({ ok: true });
}

export async function adminRejectHandler(req: Request, res: Response) {
  if (!checkToken(req, res)) return;
  const id = req.params.id as string;
  await updateUser(id, { status: 'rejected' });
  logger.info({ userId: id }, 'Admin: user rejected');
  res.json({ ok: true });
}

export async function adminUpdateUserHandler(req: Request, res: Response) {
  if (!checkToken(req, res)) return;
  const id = req.params.id as string;

  const { name, phone_number, status } = req.body as {
    name?: string;
    phone_number?: string;
    status?: string;
  };

  const { data: current } = await supabase
    .from('users')
    .select('status, phone_number')
    .eq('id', id)
    .single();

  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) dbUpdates.name = name || null;
  if (phone_number) dbUpdates.phone_number = phone_number;
  if (status) dbUpdates.status = status;

  const { error } = await supabase.from('users').update(dbUpdates).eq('id', id);
  if (error) {
    logger.error(error, 'Admin: failed to update user');
    return res.status(500).json({ error: 'DB error' });
  }

  // Si se aprobó ahora, mandar welcome
  if (status === 'approved' && current?.status !== 'approved') {
    const targetPhone = (phone_number || current?.phone_number) as string;
    try {
      const conversation = await getOrCreateConversation(id, undefined);
      await storeMessage(conversation.id, id, 'outbound', WELCOME_MSG);
      await kapsoClient.sendMessage(targetPhone, WELCOME_MSG);
    } catch (err) {
      logger.error(err, 'Admin: failed to send welcome on status change');
    }
  }

  logger.info({ userId: id, updates: dbUpdates }, 'Admin: user updated');
  res.json({ ok: true });
}
