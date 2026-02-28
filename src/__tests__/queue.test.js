const { bonusQueue } = require('../queue');
const { sequelize } = require('../models');
const { BonusTransaction } = require('../models/BonusTransaction');
const { User } = require('../models/User');

describe('Expire Accruals Queue', () => {
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
    await BonusTransaction.destroy({ where: {} });
  });

  test('повторная постановка задачи не создает дубли бизнес-эффекта', async () => {
    // Подготовка: создаем просроченное начисление
    const accrual = await BonusTransaction.create({
      id: 'a1111111-1111-1111-1111-111111111111',
      user_id: userId,
      type: 'accrual',
      amount: 100,
      expires_at: new Date(Date.now() - 86400000), // вчера (просрочено)
      request_id: null
    });

    // Действие: ставим задачу в очередь
    await bonusQueue.add('expireAccruals', 
      { createdAt: new Date().toISOString() },
      { jobId: 'expire-accruals' }
    );

    // Ждем немного для обработки
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Проверка: должно быть создано списание
    const spend1 = await BonusTransaction.findOne({
      where: {
        user_id: userId,
        type: 'spend',
        request_id: `expire:${accrual.id}`
      }
    });
    expect(spend1).not.toBeNull();

    // Действие: ставим задачу повторно
    await bonusQueue.add('expireAccruals', 
      { createdAt: new Date().toISOString() },
      { jobId: 'expire-accruals' }
    );

    // Ждем немного для обработки
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Проверка: списание все еще одно
    const spends = await BonusTransaction.findAll({
      where: {
        user_id: userId,
        type: 'spend',
        request_id: `expire:${accrual.id}`
      }
    });
    expect(spends.length).toBe(1);
  });
});