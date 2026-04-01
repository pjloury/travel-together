// Tests for email service (Resend)
// Mocks Resend SDK so no real API calls are made

jest.mock('resend', () => {
  const mockSend = jest.fn().mockResolvedValue({ data: { id: 'msg-123' }, error: null });
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: { send: mockSend },
    })),
    __mockSend: mockSend,
  };
});

const { sendInviteEmail, sendPasswordResetEmail } = require('../services/email');
const { __mockSend } = require('resend');

describe('sendInviteEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-key';
  });

  it('sends invite email via Resend', async () => {
    const result = await sendInviteEmail({
      toEmail: 'friend@example.com',
      inviterName: 'PJ',
      inviterUsername: 'pjloury',
    });
    expect(result.sent).toBe(true);
    expect(__mockSend).toHaveBeenCalledTimes(1);
    const call = __mockSend.mock.calls[0][0];
    expect(call.to).toEqual(['friend@example.com']);
    expect(call.subject).toMatch(/PJ tagged you/);
    expect(call.html).toContain('PJ');
  });

  it('skips when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendInviteEmail({
      toEmail: 'friend@example.com',
      inviterName: 'PJ',
      inviterUsername: 'pjloury',
    });
    expect(result.skipped).toBe(true);
  });

  it('throws on Resend error', async () => {
    __mockSend.mockResolvedValueOnce({ error: { message: 'Invalid API key' } });
    await expect(
      sendInviteEmail({ toEmail: 'x@x.com', inviterName: 'PJ', inviterUsername: 'pj' })
    ).rejects.toThrow('Invalid API key');
  });
});

describe('sendPasswordResetEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-key';
  });

  it('sends reset email via Resend', async () => {
    const result = await sendPasswordResetEmail({
      toEmail: 'user@example.com',
      token: 'abc123',
    });
    expect(result.sent).toBe(true);
    expect(__mockSend).toHaveBeenCalledTimes(1);
    const call = __mockSend.mock.calls[0][0];
    expect(call.to).toEqual(['user@example.com']);
    expect(call.subject).toMatch(/Reset your/i);
    expect(call.html).toContain('abc123');
  });

  it('skips when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendPasswordResetEmail({
      toEmail: 'user@example.com',
      token: 'abc123',
    });
    expect(result.skipped).toBe(true);
  });
});
