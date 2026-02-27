import { Queue, Worker } from 'bullmq';

import { redis } from './redis';

const queueConnection = redis.duplicate();

export const bonusQueue = new Queue('bonusQueue', {
  connection: queueConnection,
});

let expireAccrualsWorker: Worker | null = null;

export function startExpireAccrualsWorker(): Worker {
  if (expireAccrualsWorker) {
    return expireAccrualsWorker;
  }

  expireAccrualsWorker = new Worker(
    'bonusQueue',
    async (job) => {
      if (job.name === 'expireAccruals') {
        console.log(`[worker] expireAccruals started, jobId=${job.id}`);
      }
    },
    {
      connection: redis.duplicate(),
    },
  );

  expireAccrualsWorker.on('failed', (job, err) => {
    console.error(`[worker] failed, jobId=${job?.id}`, err);
  });

  return expireAccrualsWorker;
}
