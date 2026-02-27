# Backend Test Task

Полная постановка задания находится в [TASK.md](./TASK.md).

## Быстрый старт

```bash
docker compose up --build
```

API: `http://localhost:3000`

## Полезные команды

```bash
docker compose exec api npm run migrate
docker compose exec api npm test
docker compose down -v
```

## Что сдавать

- ссылка на репозиторий или ветку с изменениями;
- обновленный `README.md` с разделом `Анализ и рефакторинг` (ответы на 7 вопросов из `TASK.md`);
- инструкция запуска тестов и подтверждение, что обязательные сценарии проходят.
