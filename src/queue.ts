import { Queue, Worker } from 'bullmq';
import { redis } from './redis';
import { sequelize } from './db';
import { BonusTransaction } from './models/BonusTransaction';
import { spendBonus } from './services/bonus.service';
import { Op } from 'sequelize';

const queueConnection = redis.duplicate();

export const bonusQueue = new Queue('bonusQueue', {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false
  }
});

let expireAccrualsWorker: Worker | null = null;

export function startExpireAccrualsWorker(): Worker {
  if (expireAccrualsWorker) {
    console.log('[worker] Returning existing worker');
    return expireAccrualsWorker;
  }

  console.log('[worker] Creating new worker...');
  expireAccrualsWorker = new Worker(
    'bonusQueue',
    async (job) => {
      // *** ЭТОТ ЛОГ ДОЛЖЕН ПОЯВИТЬСЯ В ЛЮБОМ СЛУЧАЕ ***
      console.log(`[worker] 🟢 JOB ${job.id} (${job.name}) PROCESSING STARTED`);

      if (job.name === 'expireAccruals') {
        console.log(`[worker] expireAccruals job ${job.id} started at ${new Date().toISOString()}`);

        // 1. Поиск просроченных
        const expiredAccruals = await BonusTransaction.findAll({
          where: {
            type: 'accrual',
            expires_at: { [Op.lt]: new Date() }
          }
        });
        console.log(`[worker] Found ${expiredAccruals.length} expired accruals`);

        // 2. Обработка каждого
        const results = { processed: 0, skipped: 0, errors: 0 };
        for (const accrual of expiredAccruals) {
          try {
            const requestId = `expire:${accrual.id}`;
            console.log(`[worker] Processing accrual ${accrual.id}`);
            const result = await spendBonus(accrual.user_id, requestId, accrual.amount);
            if (result.duplicated) {
              console.log(`[worker] Accrual ${accrual.id} skipped (duplicate)`);
              results.skipped++;
            } else {
              console.log(`[worker] ✅ Accrual ${accrual.id} processed`);
              results.processed++;
            }
          } catch (error: any) {
            console.error(`[worker] ❌ Error on ${accrual.id}:`, error.message);
            results.errors++;
          }
        }

        console.log(`[worker] Job completed:`, results);
        return results;
      }
    },
    { connection: redis.duplicate(), concurrency: 1 }
  );

  expireAccrualsWorker.on('ready', () => console.log('[worker] ✅ Worker is ready and listening'));
  expireAccrualsWorker.on('completed', (job, res) => console.log(`[worker] ✅ Job ${job?.id} completed`, res));
  expireAccrualsWorker.on('failed', (job, err) => console.error(`[worker] ❌ Job ${job?.id} failed`, err));

  console.log('[worker] 🚀 Worker creation initiated');
  return expireAccrualsWorker;
}

// НЕМЕДЛЕННЫЙ ЗАПУСК
startExpireAccrualsWorker();
console.log('[worker] Worker startup function executed');