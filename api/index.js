import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const BACKEND_SECRET = process.env.API_BACKEND_SECRET;
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function cleanText(value, maxLength = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeEvent(event) {
  return event ? { ...event, time: String(event.time).slice(0, 5) } : event;
}

function validateEvent(body) {
  const event = {
    name: cleanText(body.name, 120),
    description: cleanText(body.description, 1000),
    date: cleanText(body.date, 10),
    time: cleanText(body.time, 5),
    venue: cleanText(body.venue, 160),
  };

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(event.date);
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(event.time);
  if (Object.values(event).some((value) => !value) || !validDate || !validTime) {
    return { error: 'Complete every event field with a valid date and time.' };
  }
  return { event };
}

async function readBody(request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 20_000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  try {
    return await request.json();
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
  }
}

async function callDatabase(functionName, parameters = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw Object.assign(new Error('The production database is not configured.'), { status: 503 });
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(parameters),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || 'Database request failed.');
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }
  return data;
}

function issueAdminToken() {
  if (!SESSION_SECRET) throw Object.assign(new Error('Admin sessions are not configured.'), { status: 503 });
  const payload = Buffer.from(JSON.stringify({
    role: 'admin',
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    nonce: crypto.randomUUID(),
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function hasValidAdminToken(request) {
  if (!SESSION_SECRET) return false;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, 'base64url');
  } catch {
    return false;
  }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.role === 'admin' && session.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(request) {
  if (!hasValidAdminToken(request)) {
    throw Object.assign(new Error('Please log in as admin.'), { status: 401 });
  }
  if (!BACKEND_SECRET) {
    throw Object.assign(new Error('Admin database access is not configured.'), { status: 503 });
  }
}

function eventIdFromPath(pathname, suffix = '') {
  const pattern = suffix
    ? new RegExp(`^/api/(?:admin/)?events/(\\d+)/${suffix}$`)
    : /^\/api\/(?:admin\/)?events\/(\d+)$/;
  const match = pathname.match(pattern);
  return match ? Number(match[1]) : null;
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const routedPath = url.searchParams.get('path');
  const pathname = routedPath ? `/api/${routedPath}` : url.pathname;
  const method = request.method.toUpperCase();

  if (method === 'GET' && pathname === '/api/health') {
    return json({ status: 'ok', database: 'supabase' });
  }

  if (method === 'POST' && pathname === '/api/admin/login') {
    const body = await readBody(request);
    const username = cleanText(body.username, 80);
    const password = cleanText(body.password, 200);
    if (!username || !password) return json({ message: 'Enter a username and password.' }, 400);

    const valid = await callDatabase('admin_login', {
      p_username: username,
      p_password: password,
    });
    if (!valid) return json({ message: 'Incorrect username or password.' }, 401);
    return json({ token: issueAdminToken() });
  }

  if (method === 'POST' && pathname === '/api/admin/logout') {
    requireAdmin(request);
    return new Response(null, { status: 204 });
  }

  if (method === 'GET' && pathname === '/api/events') {
    const events = await callDatabase('get_events');
    return json(events.map(normalizeEvent));
  }

  const publicEventId = eventIdFromPath(pathname);
  if (method === 'GET' && publicEventId && !pathname.includes('/admin/')) {
    const events = await callDatabase('get_event', { p_event_id: publicEventId });
    if (!events?.length) return json({ message: 'Event not found.' }, 404);
    return json(normalizeEvent(events[0]));
  }

  const registrationEventId = eventIdFromPath(pathname, 'register');
  if (method === 'POST' && registrationEventId) {
    const body = await readBody(request);
    const registration = {
      fullName: cleanText(body.fullName, 120),
      email: cleanText(body.email, 254).toLowerCase(),
      phone: cleanText(body.phone, 20),
      admissionNumber: cleanText(body.admissionNumber, 50).toUpperCase(),
    };
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registration.email);
    const phoneIsValid = /^[+\d][\d\s-]{6,19}$/.test(registration.phone);
    if (Object.values(registration).some((value) => !value) || !emailIsValid || !phoneIsValid) {
      return json({ message: 'Enter complete and valid registration details.' }, 400);
    }

    await callDatabase('register_for_event', {
      p_event_id: registrationEventId,
      p_full_name: registration.fullName,
      p_email: registration.email,
      p_phone: registration.phone,
      p_admission_number: registration.admissionNumber,
    });
    return json({ message: 'Registration successful.' }, 201);
  }

  if (method === 'POST' && pathname === '/api/admin/events') {
    requireAdmin(request);
    const { event, error } = validateEvent(await readBody(request));
    if (error) return json({ message: error }, 400);
    const events = await callDatabase('admin_create_event', {
      p_secret: BACKEND_SECRET,
      p_name: event.name,
      p_description: event.description,
      p_date: event.date,
      p_time: event.time,
      p_venue: event.venue,
    });
    return json(normalizeEvent(events[0]), 201);
  }

  const adminEventId = eventIdFromPath(pathname);
  if (method === 'PUT' && adminEventId && pathname.includes('/admin/')) {
    requireAdmin(request);
    const { event, error } = validateEvent(await readBody(request));
    if (error) return json({ message: error }, 400);
    const events = await callDatabase('admin_update_event', {
      p_secret: BACKEND_SECRET,
      p_event_id: adminEventId,
      p_name: event.name,
      p_description: event.description,
      p_date: event.date,
      p_time: event.time,
      p_venue: event.venue,
    });
    if (!events?.length) return json({ message: 'Event not found.' }, 404);
    return json(normalizeEvent(events[0]));
  }

  if (method === 'DELETE' && adminEventId && pathname.includes('/admin/')) {
    requireAdmin(request);
    const deleted = await callDatabase('admin_delete_event', {
      p_secret: BACKEND_SECRET,
      p_event_id: adminEventId,
    });
    if (!deleted) return json({ message: 'Event not found.' }, 404);
    return new Response(null, { status: 204 });
  }

  const registrationsEventId = eventIdFromPath(pathname, 'registrations');
  if (method === 'GET' && registrationsEventId) {
    requireAdmin(request);
    const [events, registrations] = await Promise.all([
      callDatabase('get_event', { p_event_id: registrationsEventId }),
      callDatabase('admin_registrations', {
        p_secret: BACKEND_SECRET,
        p_event_id: registrationsEventId,
      }),
    ]);
    if (!events?.length) return json({ message: 'Event not found.' }, 404);
    return json({ event: normalizeEvent(events[0]), registrations });
  }

  return json({ message: 'Not found.' }, 404);
}

export default {
  async fetch(request) {
    try {
      return await handleRequest(request);
    } catch (error) {
      console.error('API request failed:', error.message);
      if (error.code === '23505') {
        return json({ message: 'This admission number is already registered for this event.' }, 409);
      }
      if (error.code === '23503') return json({ message: 'Event not found.' }, 404);
      const safeStatus = [400, 401, 404, 409, 413, 503].includes(error.status) ? error.status : 500;
      const message = safeStatus < 500 ? error.message : 'Something went wrong. Please try again.';
      return json({ message }, safeStatus);
    }
  },
};
