// Tests for invite routes
jest.mock('../db');
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.user = { id: 'user-1', displayName: 'PJ', display_name: 'PJ', username: 'pjloury' };
  next();
});
jest.mock('../services/email', () => ({
  sendInviteEmail: jest.fn().mockResolvedValue({ sent: true }),
}));

const request = require('supertest');
const express = require('express');
const db = require('../db');
const inviteRoutes = require('../routes/invites');

const app = express();
app.use(express.json());
app.use('/api/invites', inviteRoutes);

describe('POST /api/invites/link', () => {
  it('generates a new invite link', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })   // no existing code
      .mockResolvedValueOnce({ rows: [] });  // INSERT
    const res = await request(app).post('/api/invites/link');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.link).toContain('/join/');
    expect(res.body.code).toBeTruthy();
  });

  it('returns existing code if already generated', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ code: 'abc123' }] });
    const res = await request(app).post('/api/invites/link');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('abc123');
    expect(res.body.link).toContain('/join/abc123');
  });
});

describe('GET /api/invites/info/:code', () => {
  it('returns inviter info for valid code', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ display_name: 'PJ', username: 'pjloury', avatar_url: null, memory_count: 5, dream_count: 3 }],
    });
    const res = await request(app).get('/api/invites/info/abc123');
    expect(res.status).toBe(200);
    expect(res.body.inviter.displayName).toBe('PJ');
    expect(res.body.inviter.memoryCount).toBe(5);
  });

  it('returns 404 for invalid code', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/invites/info/invalid');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/invites/send', () => {
  it('sends email invitations to multiple addresses', async () => {
    const { sendInviteEmail } = require('../services/email');
    const res = await request(app)
      .post('/api/invites/send')
      .send({ emails: ['a@test.com', 'b@test.com'] });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(sendInviteEmail).toHaveBeenCalledTimes(2);
  });

  it('rejects when no valid emails provided', async () => {
    const res = await request(app)
      .post('/api/invites/send')
      .send({ emails: ['not-an-email'] });
    expect(res.status).toBe(400);
  });
});
