/**
 * /api/admin — Secure Admin Endpoints (Vercel Serverless Function)
 * All admin operations require server-side JWT verification + admin flag
 */
const jwt = require('jsonwebtoken');

function verifyAdmin(req) {
  const h = req.headers['authorization'];
  if (!h || !h.startsWith('Bearer ')) return null;
  try {
    const d = jwt.verify(h.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'study-superz' });
    if (!d.isAdmin || d.email !== process.env.ADMIN_EMAIL) return null;
    return d;
  } catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  const admin = verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Forbidden. Admin access required.' });

  const { createClient } = require('@supabase/supabase-js');
  const SB = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  const path = (req.url || '').replace('/api/admin', '');

  // GET /api/admin/users
  if (req.method === 'GET' && path === '/users') {
    const page  = Math.max(1, parseInt(req.query?.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit || '50')));
    const { data, count, error } = await SB.from('profiles')
      .select('id,full_name,email,class,xp,level,streak,created_at,last_login,is_admin', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page-1)*limit, page*limit-1);
    if (error) return res.status(500).json({ error: 'DB error.' });
    return res.status(200).json({ users: data, total: count, page, limit });
  }

  // GET /api/admin/export — CSV
  if (req.method === 'GET' && path === '/export') {
    const { data } = await SB.from('profiles').select('id,full_name,email,class,xp,level,streak,created_at,last_login').order('created_at', { ascending: false });
    const csv = ['ID,Name,Email,Class,XP,Level,Streak,Joined,LastLogin',
      ...(data||[]).map(u => `${u.id},"${(u.full_name||'').replace(/"/g,'""')}",${u.email},${u.class||''},${u.xp||0},${u.level||1},${u.streak||0},${u.created_at||''},${u.last_login||''}`)
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="users_${new Date().toISOString().slice(0,10)}.csv"`);
    return res.status(200).send(csv);
  }

  // GET /api/admin/stats
  if (req.method === 'GET' && path === '/stats') {
    const [{ count: total }, { count: today }, { count: feedback }] = await Promise.all([
      SB.from('profiles').select('*', { count: 'exact', head: true }),
      SB.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now()-86400000).toISOString()),
      SB.from('feedback').select('*', { count: 'exact', head: true })
    ]);
    return res.status(200).json({ totalUsers: total, newToday: today, feedback, timestamp: new Date().toISOString() });
  }

  // DELETE /api/admin/users/:id
  if (req.method === 'DELETE' && path.startsWith('/users/')) {
    const uid = path.replace('/users/', '').trim().slice(0, 36);
    if (!uid || uid === admin.sub) return res.status(400).json({ error: 'Cannot delete your own account.' });
    await SB.auth.admin.deleteUser(uid).catch(() => {});
    await SB.from('profiles').delete().eq('id', uid);
    return res.status(200).json({ message: 'User deleted.' });
  }

  return res.status(404).json({ error: 'Admin route not found.' });
};
