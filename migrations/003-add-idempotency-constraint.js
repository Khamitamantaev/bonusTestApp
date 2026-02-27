'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Удаляем старый глобальный индекс (если он есть)
    try {
      await queryInterface.removeIndex('bonus_transactions', 'bonus_transactions_request_id_uq');
      console.log('Removed global request_id index');
    } catch (error) {
      console.log('Global index not found, continuing...');
    }

    // Добавляем новый составной индекс (user_id + request_id) ТОЛЬКО для списаний
    await queryInterface.addIndex('bonus_transactions', 
      ['user_id', 'request_id'], 
      {
        name: 'bonus_transactions_user_id_request_id_unique',
        unique: true,
        where: {
          type: 'spend',           // только для списаний
          request_id: { [Sequelize.Op.ne]: null }  // только где request_id не NULL
        }
      }
    );

    // 3. Добавляем индекс для быстрого поиска просроченных начислений
    // (поможет воркеру быстрее находить просроченные бонусы)
    await queryInterface.addIndex('bonus_transactions', 
      ['expires_at'], 
      {
        name: 'bonus_transactions_expires_at_idx',
        where: {
          type: 'accrual'  // только для начислений
        }
      }
    );

    // 4. Добавляем индекс для поиска по user_id и типу (часто используется)
    await queryInterface.addIndex('bonus_transactions',
      ['user_id', 'type', 'created_at'],
      {
        name: 'bonus_transactions_user_type_created_idx'
      }
    );
  },

  async down(queryInterface) {
    // Откат миграции - удаляем добавленные индексы
    await queryInterface.removeIndex(
      'bonus_transactions', 
      'bonus_transactions_user_id_request_id_unique'
    );
    
    await queryInterface.removeIndex(
      'bonus_transactions', 
      'bonus_transactions_expires_at_idx'
    );

    await queryInterface.removeIndex(
      'bonus_transactions',
      'bonus_transactions_user_type_created_idx'
    );

    // Восстанавливаем старый глобальный индекс (на случай отката)
    await queryInterface.addIndex('bonus_transactions', ['request_id'], {
      name: 'bonus_transactions_request_id_uq',
      unique: true,
    });
  }
};