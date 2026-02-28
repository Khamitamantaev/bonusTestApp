const request = require('supertest');
const app = require('../app'); // ваш express app
const { sequelize } = require('../models');
const { BonusTransaction } = require('../models/BonusTransaction');
const { User } = require('../models/User');

describe('Bonus Controller', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  
  beforeAll(async () => {
    await sequelize.authenticate();
    await BonusTransaction.destroy({ where: {} });
    await User.destroy({ where: {} });
    
    await User.create({
      id: userId,
      name: 'Test User'
    });
  });

  beforeEach(async () => {
    await BonusTransaction.destroy({ where: { user_id: userId } });
  });

  describe('POST /users/:id/spend', () => {
    test('первый запрос - success: true, duplicated: false', async () => {
      // Подготовка
      await BonusTransaction.create({
        id: 'a1111111-1111-1111-1111-111111111111',
        user_id: userId,
        type: 'accrual',
        amount: 100,
        expires_at: new Date(Date.now() + 86400000),
        request_id: null
      });

      // Действие
      const response = await request(app)
        .post(`/users/${userId}/spend`)
        .set('Idempotency-Key', 'test-key-1')
        .send({ amount: 50 });

      // Проверка
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        duplicated: false
      });
    });

    test('повторный запрос - success: true, duplicated: true', async () => {
      // Подготовка
      await BonusTransaction.create({
        id: 'a1111111-1111-1111-1111-111111111111',
        user_id: userId,
        type: 'accrual',
        amount: 100,
        expires_at: new Date(Date.now() + 86400000),
        request_id: null
      });

      // Действие - первый запрос
      await request(app)
        .post(`/users/${userId}/spend`)
        .set('Idempotency-Key', 'test-key-2')
        .send({ amount: 50 });

      // Действие - второй запрос (повторный)
      const response = await request(app)
        .post(`/users/${userId}/spend`)
        .set('Idempotency-Key', 'test-key-2')
        .send({ amount: 50 });

      // Проверка
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        duplicated: true
      });
    });

    test('тот же ключ, другая сумма - 409', async () => {
      // Подготовка
      await BonusTransaction.create({
        id: 'a1111111-1111-1111-1111-111111111111',
        user_id: userId,
        type: 'accrual',
        amount: 100,
        expires_at: new Date(Date.now() + 86400000),
        request_id: null
      });

      // Действие - первый запрос
      await request(app)
        .post(`/users/${userId}/spend`)
        .set('Idempotency-Key', 'test-key-3')
        .send({ amount: 50 });

      // Действие - второй запрос с другой суммой
      const response = await request(app)
        .post(`/users/${userId}/spend`)
        .set('Idempotency-Key', 'test-key-3')
        .send({ amount: 30 });

      // Проверка
      expect(response.status).toBe(409);
    });

    test('без Idempotency-Key - 400', async () => {
      // Действие
      const response = await request(app)
        .post(`/users/${userId}/spend`)
        .send({ amount: 50 });

      // Проверка
      expect(response.status).toBe(400);
    });

    test('недостаточно средств - 400', async () => {
      // Подготовка
      await BonusTransaction.create({
        id: 'a1111111-1111-1111-1111-111111111111',
        user_id: userId,
        type: 'accrual',
        amount: 50,
        expires_at: new Date(Date.now() + 86400000),
        request_id: null
      });

      // Действие
      const response = await request(app)
        .post(`/users/${userId}/spend`)
        .set('Idempotency-Key', 'test-key-4')
        .send({ amount: 100 });

      // Проверка
      expect(response.status).toBe(400);
    });
  });
});