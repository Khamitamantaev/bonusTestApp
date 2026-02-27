import { BonusTransaction } from '../models/BonusTransaction';

type AppError = Error & { status?: number };

function createAppError(message: string, status: number): AppError {
  const error = new Error(message) as AppError;
  error.status = status;
  return error;
}

export async function getUserBalance(userId: string): Promise<number> {
  const accruals = await BonusTransaction.findAll({
    where: {
      user_id: userId,
      type: 'accrual',
    },
  });

  const balance = accruals.reduce((sum, tx) => sum + tx.amount, 0);

  // TODO: учитывать expires_at
  // TODO: учитывать spend
  // TODO: учитывать конкурентные списания
  return balance;
}

export async function spendBonus(userId: string, amount: number): Promise<void> {
  // Legacy-набросок: намеренно наивная реализация для задания.
  // Здесь специально нет транзакции, защиты от гонок и идемпотентности.
  const balance = await getUserBalance(userId);

  if (balance < amount) {
    throw createAppError('Not enough bonus', 400);
  }

  await BonusTransaction.create({
    user_id: userId,
    type: 'spend',
    amount,
    expires_at: null,
    request_id: null,
  });
}
