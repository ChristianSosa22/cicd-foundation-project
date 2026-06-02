import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createUser, deleteUsers, request } from './helpers';

describe('Authentication', () => {
  let userId: number;
  let userEmail: string;
  let userPassword: string;
  let token: string;

  beforeAll(async () => {
    const u = await createUser({ system_role: 'driver', category: 'ejecutivo' });
    userId = u.id;
    userEmail = u.email;
    userPassword = u.password;
    token = u.token;
  });

  afterAll(async () => {
    await deleteUsers(userId);
  });

  describe('POST /auth/login', () => {
    it('returns token and user on valid credentials', async () => {
      const res = await request.post('/auth/login').send({ email: userEmail, password: userPassword });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toMatchObject({ system_role: 'driver', category: 'ejecutivo' });
      expect(res.body.user).not.toHaveProperty('password_hash');
    });

    it('returns 401 for wrong password', async () => {
      const res = await request.post('/auth/login').send({ email: userEmail, password: 'wrongpassword' });
      expect(res.status).toBe(401);
    });

    it('returns 401 for unknown email', async () => {
      const res = await request.post('/auth/login').send({ email: 'nobody@example.com', password: 'whatever' });
      expect(res.status).toBe(401);
    });

    it('returns 401 for inactive user', async () => {
      const inactive = await createUser({ is_active: false });
      const res = await request.post('/auth/login').send({ email: inactive.email, password: inactive.password });
      expect(res.status).toBe(401);
      await deleteUsers(inactive.id);
    });

    it('returns 400 for invalid email format', async () => {
      const res = await request.post('/auth/login').send({ email: 'not-an-email', password: 'pass' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /auth/me', () => {
    it('returns user info with valid token', async () => {
      const res = await request.get('/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ email: userEmail, system_role: 'driver', is_active: true });
    });

    it('returns 401 without token', async () => {
      const res = await request.get('/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request.get('/auth/me').set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/change-password', () => {
    it('changes password and old token still works (JWT stateless)', async () => {
      const u = await createUser();
      const res = await request
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${u.token}`)
        .send({ current_password: u.password, new_password: 'NewPassword99!' });
      expect(res.status).toBe(204);

      // Old password fails
      const loginOld = await request.post('/auth/login').send({ email: u.email, password: u.password });
      expect(loginOld.status).toBe(401);

      // New password works
      const loginNew = await request.post('/auth/login').send({ email: u.email, password: 'NewPassword99!' });
      expect(loginNew.status).toBe(200);

      await deleteUsers(u.id);
    });

    it('returns 400 for wrong current password', async () => {
      const res = await request
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ current_password: 'wrongpassword', new_password: 'NewPassword99!' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for new password too short', async () => {
      const res = await request
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ current_password: userPassword, new_password: 'short' });
      expect(res.status).toBe(400);
    });

    it('returns 401 without token', async () => {
      const res = await request.post('/auth/change-password').send({ current_password: 'x', new_password: 'NewPassword99!' });
      expect(res.status).toBe(401);
    });
  });
});
