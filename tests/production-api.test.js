import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
process.env.API_BACKEND_SECRET = 'test-backend-secret';
process.env.ADMIN_SESSION_SECRET = 'test-session-secret-with-enough-entropy';

const { default: api } = await import('../api/index.js');

function request(path, options = {}) {
  return new Request(`https://events.example/api?path=${encodeURIComponent(path)}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
}

test('lists events and normalizes database time values', async () => {
  global.fetch = async () => Response.json([{
    id: 1,
    name: 'Career Workshop',
    description: 'Prepare for work.',
    date: '2026-11-12',
    time: '10:00:00',
    venue: 'Library',
    registration_count: 2,
  }]);

  const response = await api.fetch(request('events'));
  const events = await response.json();
  assert.equal(response.status, 200);
  assert.equal(events[0].time, '10:00');
});

test('rejects an admin change without a signed session', async () => {
  const response = await api.fetch(request('admin/events', {
    method: 'POST',
    body: JSON.stringify({}),
  }));
  assert.equal(response.status, 401);
});

test('logs in and creates an event with the signed session', async () => {
  global.fetch = async (url) => {
    if (url.endsWith('/admin_login')) return Response.json(true);
    if (url.endsWith('/admin_create_event')) {
      return Response.json([{
        id: 4,
        name: 'Research Day',
        description: 'Student research presentations.',
        date: '2026-12-01',
        time: '09:30:00',
        venue: 'Main Hall',
      }]);
    }
    throw new Error(`Unexpected database call: ${url}`);
  };

  const loginResponse = await api.fetch(request('admin/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  }));
  const { token } = await loginResponse.json();
  assert.equal(loginResponse.status, 200);
  assert.ok(token);

  const createResponse = await api.fetch(request('admin/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: 'Research Day',
      description: 'Student research presentations.',
      date: '2026-12-01',
      time: '09:30',
      venue: 'Main Hall',
    }),
  }));
  const event = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(event.time, '09:30');
});

test('validates student registration before calling the database', async () => {
  const response = await api.fetch(request('events/1/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Student One',
      email: 'not-an-email',
      phone: '123',
      admissionNumber: 'ADM001',
    }),
  }));
  assert.equal(response.status, 400);
});
