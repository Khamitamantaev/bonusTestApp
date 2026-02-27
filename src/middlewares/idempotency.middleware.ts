import { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const bodyRequestId = req.body?.requestId as string;
  const idempotencyKey = req.headers["idempotency-key"] as string;

  const reqId = idempotencyKey || bodyRequestId;

  if (!reqId) {
    return res.status(400).json({
      error: "Отсутствует идентификатор запроса",
    });
  }

  if (typeof reqId !== "string" || reqId.length < 1 || reqId.length > 255) {
    return res.status(400).json({
      error:
        "Неверный формат запроса, проверьте на reqId должен быть строкой, а его длина должна составлять от 1 до 255 символов",
    });
  }

  req.requestId = reqId;

  next();
}
