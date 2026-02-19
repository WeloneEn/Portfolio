# Welone Digital Atelier Portfolio

Многостраничный сайт с клиентской зоной (visitor) и рабочим пространством команды (admin/workspace).

## Разделы

- `index.html`, `about.html`, `projects.html`, `contact.html` — клиентская часть.
- `admin.html` — аналитика и управление командой.
- `admin-leads.html` — очередь заявок и CRM-действия.
- `admin-events.html` — важные события клиентов.
- `admin-training.html` — обучение и контроль менеджеров.

## Роли

- `owner` — полный доступ.
- `product` — управление процессом и менеджерами.
- `manager` — работа с заявками и личной статистикой.

## Запуск

1. Откройте PowerShell в папке проекта.
2. Установите переменные окружения:

```powershell
$env:ADMIN_PASSWORD="CHANGE_ME_STRONG_PASSWORD"
$env:TOKEN_SECRET="CHANGE_ME_LONG_RANDOM_SECRET"
```

3. Запустите сервер:

```powershell
node server.js
```

4. Откройте:

- `http://localhost:3000/`
- `http://localhost:3000/admin.html`

## API

- `POST /api/visit`
- `POST /api/engagement`
- `POST /api/secret`
- `POST /api/leads`
- `POST /api/admin/login`
- `GET /api/admin/stats`
- `GET /api/admin/team`
- `GET/PATCH/DELETE /api/admin/leads/:id`

## Данные

- `data/site-data.json`
- `data/admin-users.json`

## Локальные ассеты пасхалок

- `assets/models/command-jet.svg`
- `assets/models/mario.svg`

## Проверки качества

Быстрая backend+API+flow проверка:

```powershell
node qa-smoke.js
```

UI/верстка/связки HTML↔JS (themes + mobile правила):

```powershell
node qa-ui-smoke.js
```

Для запуска в Windows двойным кликом:

- `qa-smoke.bat`

## Важно

Не открывайте проект через `file://`. Используйте локальный сервер (`node server.js`), иначе API-запросы будут недоступны.
