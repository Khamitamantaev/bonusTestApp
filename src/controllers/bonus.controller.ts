import { NextFunction, Request, Response } from 'express';
import { bonusQueue } from '../queue';
import { 
  spendBonus, 
  AppError,
  ConflictError,
  InsufficientBalanceError,
  ValidationError 
} from '../services/bonus.service';

export async function spendUserBonus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.params.id;
    const requestId = req.requestId;
    const amount = Number(req.body?.amount);

    if (!Number.isInteger(amount) || amount <= 0) {
      res.status(400).json({ 
        error: 'amount must be a positive integer' 
      });
      return;
    }

    const result = await spendBonus(userId, requestId, amount);

    res.status(200).json({
      success: result.success,
      duplicated: result.duplicated
    });

  } catch (error) {
    if (error instanceof ValidationError) {
      // 400 - невалидные данные
      res.status(400).json({ error: error.message });
      return;
    }
    
    if (error instanceof InsufficientBalanceError) {
      // 400 - недостаточно средств
      res.status(400).json({ error: error.message });
      return;
    }
    
    if (error instanceof ConflictError) {
      // 409 - конфликт идемпотентности
      res.status(409).json({ error: error.message });
      return;
    }
    
    if (error instanceof AppError) {
      // Другие ошибки
      res.status(error.status).json({ error: error.message });
      return;
    }
    
    // Неожиданные ошибки отправляем в next (попадут в глобальный обработчик)
    next(error);
  }
}

export async function enqueueExpireAccrualsJob(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await bonusQueue.add('expireAccruals', 
      { 
        createdAt: new Date().toISOString() 
      },
      {
        jobId: 'expire-accruals',
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000 
        }
      }
    );

    res.json({ 
      queued: true,
      jobId: 'expire-accruals' 
    });
    
  } catch (error) {
    next(error);
  }
}