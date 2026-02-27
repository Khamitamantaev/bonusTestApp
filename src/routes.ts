import { Router } from 'express';

import {
  enqueueExpireAccrualsJob,
  spendUserBonus,
} from './controllers/bonus.controller';
import {
  getUserBonusTransactions,
  getUserById,
} from './controllers/user.controller';
import { idempotencyMiddleware } from './middlewares/idempotency.middleware';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

router.get('/users/:id', getUserById);
router.get('/users/:id/bonus-transactions', getUserBonusTransactions);
router.post('/users/:id/spend',idempotencyMiddleware, spendUserBonus);
router.post('/jobs/expire-accruals', enqueueExpireAccrualsJob);
