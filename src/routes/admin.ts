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
    main { max-width: 960px; margin: 32px auto; padding: 0 20px; }
    .section { margin-bottom: 40px; }
    .section-title { font-size: 16px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
    .card { background: white; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f8f9fa; padding: 12px 16px; text-align: left; font-size: 13px; color: #777; font-weight: 600; border-bottom: 1px solid #eee; }
    td { padding: 14px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
    tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge.pending_name    { background: #fff3cd; color: #856404; }
    .badge.pending_approval { background: #cfe2ff; color: #084298; }
    .badge.approved        { background: #d1e7dd; color: #0a3622; }
    .badge.rejected        { background: #f8d7da; color: #842029; }
    .actions { display: flex; gap: 8px; }
    .btn { padding: 6px 14px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: opacity .15s; }
    .btn:hover { opacity: .85; }
    .btn-approve { background: #198754; color: white; }
    .btn-reject  { background: #dc3545; color: white; }
    .empty { padding: 32px; text-align: center; color: #aaa; font-size: 14px; }
    .toast { position: fixed; bottom: 24px; right: 24px; background: #1a1a2e; color: white; padding: 12px 20px; border-radius: 8px; font-size: 14px; display: none; }
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
  <div class="toast" id="toast"></div>

  <script>
    const TOKEN = new URLSearchParams(location.search).get('token') || '';

    function statusLabel(s) {
      const labels = { pending_name: 'Sin nombre', pending_approval: 'Esperando aprobación', approved: 'Aprobado', rejected: 'Rechazado' };
      return labels[s] || s;
    }

    function fmt(dateStr) {
      return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function toast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.style.display = 'block';
      setTimeout(() => el.style.display = 'none', 3000);
    }

    async function api(path, method = 'GET') {
      const res = await fetch(path + '?token=' + TOKEN, { method });
      return res.json();
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

    function renderPending(users) {
      const el = document.getElementById('pending-card');
      if (!users.length) { el.innerHTML = '<div class="empty">No hay solicitudes pendientes</div>'; return; }
      el.innerHTML = '<table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>' +
        users.map(u => '<tr>' +
          '<td>' + (u.name || '<em style="color:#aaa">Sin nombre</em>') + '</td>' +
          '<td>' + u.phone_number + '</td>' +
          '<td><span class="badge ' + u.status + '">' + statusLabel(u.status) + '</span></td>' +
          '<td>' + fmt(u.created_at) + '</td>' +
          '<td><div class="actions">' +
            '<button class="btn btn-approve" onclick="approve(\\'' + u.id + '\\')">Aprobar</button>' +
            '<button class="btn btn-reject"  onclick="reject(\\'' + u.id + '\\')">Rechazar</button>' +
          '</div></td></tr>'
        ).join('') +
        '</tbody></table>';
    }

    function renderAll(users) {
      const el = document.getElementById('all-card');
      if (!users.length) { el.innerHTML = '<div class="empty">No hay usuarios</div>'; return; }
      el.innerHTML = '<table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>' +
        users.map(u => '<tr>' +
          '<td>' + (u.name || '—') + '</td>' +
          '<td>' + u.phone_number + '</td>' +
          '<td><span class="badge ' + u.status + '">' + statusLabel(u.status) + '</span></td>' +
          '<td>' + fmt(u.created_at) + '</td>' +
        '</tr>').join('') +
        '</tbody></table>';
    }

    async function load() {
      const users = await api('/admin/users');
      renderPending(users.filter(u => u.status === 'pending_name' || u.status === 'pending_approval'));
      renderAll(users.filter(u => u.status === 'approved' || u.status === 'rejected'));
    }

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
