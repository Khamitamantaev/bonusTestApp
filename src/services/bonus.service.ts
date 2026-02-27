import { BonusTransaction } from '../models/BonusTransaction';
import { sequelize } from '../instances/sequelize';
import { Transaction, Op } from 'sequelize';

export class AppError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'AppError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

export class InsufficientBalanceError extends AppError {
  constructor() {
    super('Not enough bonus', 400);
    this.name = 'InsufficientBalanceError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

async function findSpendByIdempotencyKey(
  userId: string,
  requestId: string,
  transaction?: Transaction
): Promise<BonusTransaction | null> {
  return BonusTransaction.findOne({
    where: {
      user_id: userId,
      request_id: requestId,
      type: 'spend'
    },
    transaction
  });
}

export async function getUserBalance(
  userId: string, 
  transaction?: Transaction
): Promise<number> {
  const accrualSum = await BonusTransaction.sum('amount', {
    where: {
      user_id: userId,
      type: 'accrual',
      [Op.or]: [
        { expires_at: null },
        { expires_at: { [Op.gt]: new Date() } }
      ]
    },
    transaction
  }) || 0;

  const spendSum = await BonusTransaction.sum('amount', {
    where: {
      user_id: userId,
      type: 'spend'
    },
    transaction
  }) || 0;

  return accrualSum - spendSum;
}

export async function spendBonus(
  userId: string, 
  requestId: string,
  amount: number
): Promise<{ success: boolean; duplicated: boolean }> {
  
  // Валидация
  if (!userId) {
    throw new ValidationError('User ID is required');
  }
  
  if (!requestId) {
    throw new ValidationError('Request ID is required for idempotency');
  }
  
  if (!amount || amount <= 0 || !Number.isInteger(amount)) {
    throw new ValidationError('Amount must be a positive integer');
  }

  // Быстрая проверка на есть такой или нгет по ключу
  const existingSpend = await findSpendByIdempotencyKey(userId, requestId);
  
  if (existingSpend) {
    if (existingSpend.amount === amount) {
      return { success: true, duplicated: true };
    } else {
      throw new ConflictError(
        `Idempotency key "${requestId}" already used with different amount`
      );
    }
  }

  // Транзакция
  try {
    const result = await sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, async (t) => {
      
      const spendInTx = await findSpendByIdempotencyKey(userId, requestId, t);
      
      if (spendInTx) {
        if (spendInTx.amount === amount) {
          return { duplicated: true };
        } else {
          throw new ConflictError(
            `Idempotency key "${requestId}" already used with different amount`
          );
        }
      }

      const currentBalance = await getUserBalance(userId, t);

      if (currentBalance < amount) {
        throw new InsufficientBalanceError();
      }

      await BonusTransaction.create({
        user_id: userId,
        type: 'spend',
        amount,
        expires_at: null,
        request_id: requestId,
        created_at: new Date()
      }, { transaction: t });

      return { duplicated: false };
    });

    return { success: true, duplicated: result.duplicated };
    
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Internal server error', 500);
  }
}