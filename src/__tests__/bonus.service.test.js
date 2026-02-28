const { sequelize } = require('../models'); // путь может отличаться
const { BonusTransaction } = require('../models/BonusTransaction');
const { User } = require('../models/User');
const { spendBonus, getUserBalance } = require('../services/bonus.service');
const { ConflictError, InsufficientBalanceError, ValidationError } = require('../services/bonus.service');

describe('Bonus Service', () => {
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
    await BonusTransaction.destroy({ 
      where: { 
        user_id: userId 
      } 
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // ===== ТЕСТ 1: Идемпотентность =====
  describe('Idempotency', () => {
    test('повторный запрос с тем же requestId не создает второе списание', async () => {
      // Подготовка
      await BonusTransaction.create({
        id: 'a1111111-1111-1111-1111-111111111111',
        user_id: userId,
        type: 'accrual',
        amount: 100,
        expires_at: new Date(Date.now() + 86400000), // +1 день
        request_id: null
      });

      // Действие - первый запрос
      const result1 = await spendBonus(userId, 'test-key-1', 50);
      
      // Действие - второй запрос (повторный)
      const result2 = await spendBonus(userId, 'test-key-1', 50);

      // Проверка
      expect(result1).toEqual({ success: true, duplicated: false });
      expect(result2).toEqual({ success: true, duplicated: true });

      // Проверяем что в базе только одно списание
      const spends = await BonusTransaction.findAll({
        where: {
          user_id: userId,
          type: 'spend',
          request_id: 'test-key-1'
        }
      });
      expect(spends.length).toBe(1);
    });

    test('тот же requestId но другая сумма возвращает 409', async () => {
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
      await spendBonus(userId, 'test-key-2', 50);

      // Проверка - второй запрос с другой суммой должен выбросить ошибку
      await expect(spendBonus(userId, 'test-key-2', 30))
        .rejects
        .toThrow(ConflictError);
    });
  });

  // ===== ТЕСТ 2: Просроченные начисления =====
  describe('Expired accruals', () => {
    test('просроченное начисление не учитывается в балансе', async () => {
      // Подготовка
      await BonusTransaction.bulkCreate([
        {
          id: 'a1111111-1111-1111-1111-111111111111',
          user_id: userId,
          type: 'accrual',
          amount: 100,
          expires_at: new Date(Date.now() - 86400000), // вчера (просрочено)
          request_id: null
        },
        {
          id: 'a2222222-2222-2222-2222-222222222222',
          user_id: userId,
          type: 'accrual',
          amount: 50,
          expires_at: new Date(Date.now() + 86400000), // завтра (активно)
          request_id: null
        }
      ]);

      // Действие
      const balance = await getUserBalance(userId);

      // Проверка
      expect(balance).toBe(50); // только активные
    });
  });

  // ===== ТЕСТ 3: Конкурентные списания =====
  describe('Concurrent spend', () => {
    test('конкурентные списания не приводят к отрицательному балансу', async () => {
      // Подготовка
      await BonusTransaction.create({
        id: 'a1111111-1111-1111-1111-111111111111',
        user_id: userId,
        type: 'accrual',
        amount: 100,
        expires_at: new Date(Date.now() + 86400000),
        request_id: null
      });

      // Действие - запускаем 3 конкурентных списания по 60 бонусов
      const promises = [
        spendBonus(userId, 'key-1', 60).catch(e => e),
        spendBonus(userId, 'key-2', 60).catch(e => e),
        spendBonus(userId, 'key-3', 60).catch(e => e)
      ];

      const results = await Promise.all(promises);

      // Проверка
      // Только одно должно успешно выполниться
      const successful = results.filter(r => r && r.success === true);
      const errors = results.filter(r => r instanceof InsufficientBalanceError);

      expect(successful.length).toBe(1);
      expect(errors.length).toBe(2);

      // Проверяем итоговый баланс
      const finalBalance = await getUserBalance(userId);
      expect(finalBalance).toBe(40); // 100 - 60 = 40
    });
  });

  // ===== ТЕСТ 4: Валидация =====
  describe('Validation', () => {
    test('невалидные входные данные возвращают 400', async () => {
      // Без requestId
      await expect(spendBonus(userId, '', 50))
        .rejects
        .toThrow(ValidationError);

      // Неположительная сумма
      await expect(spendBonus(userId, 'key-4', 0))
        .rejects
        .toThrow(ValidationError);

      await expect(spendBonus(userId, 'key-4', -10))
        .rejects
        .toThrow(ValidationError);

      // Не целое число
      await expect(spendBonus(userId, 'key-4', 10.5))
        .rejects
        .toThrow(ValidationError);
    });
  });
});