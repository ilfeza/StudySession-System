# Тестирование

## Backend

- Обычный прогон: `cd backend; .\run-tests.ps1`
- С покрытием: `cd backend; .\run-tests.ps1 -WithCoverage`
- С Allure-артефактами: `cd backend; .\run-tests.ps1 -WithAllure`
- Всё вместе: `cd backend; .\run-tests.ps1 -WithCoverage -WithAllure`

Артефакты сохраняются в `backend/app/tests/artifacts/`:

- `coverage.xml`
- `coverage_html/`
- `allure-results/`

Если установлен Allure CLI, отчёт можно открыть так:

- `allure serve backend/app/tests/artifacts/allure-results`

## Frontend

- Прогон тестов: `cd frontend; npm test`
- Покрытие: `cd frontend; npm run test:coverage`
