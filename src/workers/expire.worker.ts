import { Worker } from 'bullmq';
import { sequelize } from '../db';
import { BonusTransaction } from '../models/BonusTransaction';
import { spendBonus } from '../services/bonus.service';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
};

const worker = new Worker('expire', 
  async (job) => {
    // САМЫЙ ПЕРВЫЙ ЛОГ - гарантированно покажет, что задача получена
    process.stdout.write(`\n🔥🔥🔥 JOB RECEIVED: ${job.id} at ${new Date().toISOString()}\n`);
    process.stdout.write(`Job data: ${JSON.stringify(job.data)}\n`);
    
    // 1. Ищем наше тестовое начисление напрямую по ID
    process.stdout.write('[Worker] Looking for accrual a1111111-1111-1111-1111-111111111111...\n');
    
    const accrual = await BonusTransaction.findByPk('a1111111-1111-1111-1111-111111111111');
    
    if (!accrual) {
      process.stdout.write('[Worker] ❌ Accrual not found!\n');
      
      // Посмотрим, есть ли вообще какие-то начисления в базе
      const allAccruals = await BonusTransaction.findAll({ where: { type: 'accrual' } });
      process.stdout.write(`[Worker] Total accruals in DB: ${allAccruals.length}\n`);
      allAccruals.forEach(a => {
        process.stdout.write(`  - ${a.id}: amount=${a.amount}, expires_at=${a.expires_at}\n`);
      });
      
      return { error: 'Accrual not found' };
    }
    
    process.stdout.write(`[Worker] ✅ Found accrual: ${accrual.id}, amount: ${accrual.amount}\n`);
    
    // 2. Пытаемся списать
    try {
      const requestId = `expire:${accrual.id}`;
      process.stdout.write(`[Worker] Calling spendBonus with requestId: ${requestId}, amount: ${accrual.amount}\n`);
      
      const result = await spendBonus(
        accrual.user_id,
        requestId,
        accrual.amount
      );
      
      process.stdout.write(`[Worker] ✅ spendBonus result: ${JSON.stringify(result)}\n`);
      return result;
      
    } catch (error: any) {
      process.stdout.write(`[Worker] ❌ spendBonus error: ${error.message}\n`);
      if (error.stack) process.stdout.write(error.stack + '\n');
      throw error;
    }
  },
  {
    connection: redisConfig,
    concurrency: 1,
  }
);

worker.on('ready', () => {
  process.stdout.write('[Worker] ✅ Worker ready\n');
});

worker.on('completed', (job, result) => {
  process.stdout.write(`[Worker] ✅ Job ${job?.id} completed: ${JSON.stringify(result)}\n`);
});

worker.on('failed', (job, error) => {
  process.stdout.write(`[Worker] ❌ Job ${job?.id} failed: ${error}\n`);
});

process.stdout.write('[Worker] 🚀 Worker loaded\n');

export default worker;