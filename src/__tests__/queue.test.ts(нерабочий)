// import { bonusQueue } from "../queue";
// import { sequelize } from "../db";
// import { BonusTransaction } from "../models/BonusTransaction";
// import { User } from "../models/User";
// import { Op } from "sequelize";

// // Импортируем воркер, чтобы он запустился
// import "../workers/expire.worker";

// describe("Expire Accruals Queue", () => {
//   const userId = "11111111-1111-1111-1111-111111111111";

//   beforeAll(async () => {
//     await sequelize.authenticate();
//     await BonusTransaction.destroy({ where: {} });
//     await User.destroy({ where: {} });

//     await User.create({
//       id: userId,
//       name: "Test User",
//     });

//     // Даем воркеру время на инициализацию
//     await new Promise((resolve) => setTimeout(resolve, 1000));
//   });

//   beforeEach(async () => {
//     await BonusTransaction.destroy({ where: {} });
//     await bonusQueue.obliterate({ force: true });
//   });

//   afterAll(async () => {
//     await sequelize.close();
//     await bonusQueue.close();
//   });

//   test("повторная постановка задачи не создает дубли бизнес-эффекта", async () => {
//     // Подготовка: создаем просроченное начисление
//     const accrual = await BonusTransaction.create({
//       id: "a1111111-1111-1111-1111-111111111111",
//       user_id: userId,
//       type: "accrual",
//       amount: 100,
//       expires_at: new Date(Date.now() - 86400000), // вчера (просрочено)
//       request_id: null,
//     });

//     console.log("✅ Created accrual:", accrual.id);

//     // Действие: ставим задачу в очередь
//     await bonusQueue.add(
//       "expireAccruals",
//       { createdAt: new Date().toISOString() },
//       {
//         attempts: 3,
//         backoff: {
//           type: "exponential",
//           delay: 1000,
//         },
//       },
//     );

//     console.log("📤 Job added to queue");

//     // Проверим состояние очереди сразу после добавления
//     const jobCounts = await bonusQueue.getJobCounts(
//       "wait",
//       "active",
//       "completed",
//       "failed",
//     );
//     console.log("📊 Queue state after adding:", jobCounts);

//     // Ждем обработки
//     console.log("⏳ Waiting 10 seconds for processing...");
//     await new Promise((resolve) => setTimeout(resolve, 10000));

//     // Проверим состояние очереди после ожидания
//     const jobCountsAfter = await bonusQueue.getJobCounts(
//       "wait",
//       "active",
//       "completed",
//       "failed",
//     );
//     console.log("📊 Queue state after waiting:", jobCountsAfter);

//     // Проверим, были ли завершенные задачи
//     const completedJobs = await bonusQueue.getJobs(["completed"]);
//     console.log(
//       "✅ Completed jobs:",
//       completedJobs.map((j) => ({
//         id: j.id,
//         returnvalue: j.returnvalue,
//       })),
//     );

//     const failedJobs = await bonusQueue.getJobs(["failed"]);
//     console.log(
//       "❌ Failed jobs:",
//       failedJobs.map((j) => ({
//         id: j.id,
//         failedReason: j.failedReason,
//       })),
//     );

//     // Проверка: должно быть создано списание
//     const spend1 = await BonusTransaction.findOne({
//       where: {
//         user_id: userId,
//         type: "spend",
//         request_id: `expire:${accrual.id}`,
//       },
//     });

//     console.log("💰 Spend found:", spend1 ? "YES" : "NO");
//     if (spend1) {
//       console.log("   Spend amount:", spend1.amount);
//     }

//     expect(spend1).not.toBeNull();
//     expect(spend1?.amount).toBe(100);

//     // Действие: ставим задачу повторно
//     console.log("📤 Adding duplicate job...");
//     await bonusQueue.add(
//       "expireAccruals",
//       { createdAt: new Date().toISOString() },
//       {
//         jobId: "expire-accruals",
//         attempts: 3,
//         backoff: {
//           type: "exponential",
//           delay: 1000,
//         },
//       },
//     );

//     // Ждем повторной обработки
//     console.log("⏳ Waiting another 10 seconds...");
//     await new Promise((resolve) => setTimeout(resolve, 10000));

//     // Проверка: списание все еще одно
//     const spends = await BonusTransaction.findAll({
//       where: {
//         user_id: userId,
//         type: "spend",
//         request_id: `expire:${accrual.id}`,
//       },
//     });
//     console.log(`📝 Found ${spends.length} spend records`);
//     expect(spends.length).toBe(1);

//     // Проверяем что нет дублей для других accruals
//     const allSpends = await BonusTransaction.findAll({
//       where: {
//         user_id: userId,
//         type: "spend",
//         request_id: {
//           [Op.like]: "expire:%",
//         },
//       },
//     });
//     console.log(`📝 Total expire spends: ${allSpends.length}`);
//     expect(allSpends.length).toBe(1);

//     console.log("✅ Test completed successfully");
//   }, 30000); // Увеличиваем таймаут до 30 секунд
// });
