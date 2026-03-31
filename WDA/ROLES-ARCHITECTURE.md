# 🔐 АРХИТЕКТУРА РОЛЕЙ - ПОЛНАЯ СПЕЦИФИКАЦИЯ

## 📋 СТРУКТУРА СИСТЕМЫ

**3 основные роли:**
1. **OWNER** (Владелец) - полный контроль
2. **PRODUCT** (Product Manager) - управляет обучением менеджеров
3. **MANAGER** (Менеджер) - проходит обучение

---

## 👑 ROLE 1: OWNER

### Описание
- Владелец системы
- Может создавать/удалять пользователей
- Видит статистику по всем
- Может запускать отчёты

### Данные
```json
{
  "id": "owner",
  "username": "admin",
  "password": "admin123",
  "name": "Owner",
  "role": "owner",
  "department": "management"
}
```

### Страница
- **URL**: `/dashboard.html`
- **Название**: "Dashboard Владельца"
- **Показывает**:
  - Общая статистика (всюду: leads, events, team status)
  - Список всех пользователей
  - Кнопка "Создать пользователя"
  - Кнопка "Выход"

### Данные которые видит
- ✅ Все заявки (leads)
- ✅ Все события (events)
- ✅ Вся статистика
- ✅ Профили всех пользователей
- ✅ Статус обучения всех менеджеров

---

## 🎯 ROLE 2: PRODUCT (Product Manager)

### Описание
- Управляет обучением менеджеров
- Может создавать планы обучения
- Может назначать менеджеров на обучение
- Видит статистику только по своим менеджерам

### Данные
```json
{
  "id": "product_vera",
  "username": "product_vera",
  "password": "product123",
  "name": "Вера Петровна",
  "role": "product",
  "department": "sales"
}
```

### Страница
- **URL**: `/product/dashboard.html`
- **Название**: "Dashboard Product Manager"
- **Показывает**:
  - Мои менеджеры (список)
  - Статус обучения каждого
  - Статистика по менеджерам
  - Кнопка "Назначить менеджеру обучение"
  - Кнопка "Выход"

### Данные которые видит
- ✅ Список только своих менеджеров (assignedProductId = product_vera_id)
- ✅ Заявки которые завершили эти менеджеры
- ✅ Статус обучения каждого менеджера
- ✅ Их результаты тестов

### Данные которые НЕ видит
- ❌ Других Product Managers
- ❌ Менеджеров других Product Managers
- ❌ Owner страницу
- ❌ Пользователей других departments

---

## 📚 ROLE 3: MANAGER (Менеджер)

### Описание
- Проходит обучение
- Видит только свой статус
- Не может ничего редактировать
- Только читает информацию

### Данные
```json
{
  "id": "manager_ivan",
  "username": "manager_ivan",
  "password": "manager123",
  "name": "Иван Петров",
  "role": "manager",
  "department": "sales",
  "assignedProductId": "product_vera"  // ← Его Product Manager
}
```

### Страница
- **URL**: `/manager/dashboard.html`
- **Название**: "Мой статус обучения"
- **Показывает** (ТОЛЬКО если assignedProductId установлен):
  - Его Product Manager (имя)
  - Текущий уровень обучения
  - Прогресс (какие уровни пройдены)
  - Информацию о пробном периоде
  - Кнопка "Выход"

### СПЕЦИАЛЬНЫЙ СТАТУС: "WELCOME"
**Если Manager НЕ назначен на обучение** (assignedProductId = null):
- Видит ТОЛЬКО welcome card
- Никаких кнопок, никаких функций
- Текст: "Ожидание назначения обучения от Product Manager"
- Только кнопка "Выход"

### Статусы менеджера
- `"welcome"` - не назначен на Product
- `"level1"` - проходит уровень 1
- `"level2"` - проходит уровень 2
- `"level3"` - проходит уровень 3
- `"level4"` - проходит уровень 4
- `"trial"` - на пробном периоде
- `"certified"` - прошёл сертификацию
- `"rejected"` - отклонен

### Данные которые видит
- ✅ Только свой статус
- ✅ Только свой Product Manager
- ✅ Информацию о программе обучения

### Данные которые НЕ видит
- ❌ Других менеджеров
- ❌ Статистику
- ❌ Других Product Managers
- ❌ Страницы Owner или Product

---

## 🔐 АВТОРИЗАЦИЯ

### Логин endpoint: `/api/admin/login`

**Request:**
```json
{
  "username": "manager_ivan",
  "password": "manager123"
}
```

**Response для каждой роли:**

```json
// OWNER
{
  "ok": true,
  "token": "jwt_token",
  "actor": {
    "id": "owner",
    "username": "admin",
    "name": "Owner",
    "role": "owner"
  }
}

// PRODUCT
{
  "ok": true,
  "token": "jwt_token",
  "actor": {
    "id": "product_vera",
    "username": "product_vera",
    "name": "Вера Петровна",
    "role": "product"
  }
}

// MANAGER (не назначен - welcome статус)
{
  "ok": true,
  "token": "jwt_token",
  "actor": {
    "id": "manager_ivan",
    "username": "manager_ivan",
    "name": "Иван Петров",
    "role": "manager",
    "assignedProductId": null,
    "trainingStatus": "welcome"
  }
}

// MANAGER (назначен на обучение)
{
  "ok": true,
  "token": "jwt_token",
  "actor": {
    "id": "manager_ivan",
    "username": "manager_ivan",
    "name": "Иван Петров",
    "role": "manager",
    "assignedProductId": "product_vera",
    "trainingStatus": "level1"
  }
}
```

---

## 🛣️ МАРШРУТЫ ПОСЛЕ ЛОГИНА

### Автоматическое перенаправление

| Роль | После логина перенаправляет на |
|---|---|
| **OWNER** | `/dashboard.html` |
| **PRODUCT** | `/product/dashboard.html` |
| **MANAGER** | `/manager/dashboard.html` |

---

## 📁 СТРУКТУРА ФАЙЛОВ

```
Portfolio/
├── index.html                    (Welcome page - для всех)
├── script.js                     (Workspace shell - логин/выход)
├── config.js                     (Конфиг API URL)
│
├── dashboard.html                (OWNER dashboard)
├── dashboard.js                  (OWNER логика)
│
├── product/
│   ├── dashboard.html            (PRODUCT dashboard)
│   └── dashboard.js              (PRODUCT логика)
│
├── manager/
│   ├── dashboard.html            (MANAGER dashboard)
│   └── dashboard.js              (MANAGER логика)
│
├── data/
│   ├── admin-users.json          (Пользователи)
│   └── site-data.json            (Данные заявок, событий, обучения)
│
├── server.js                     (Backend с API)
└── ROLES-ARCHITECTURE.md         (Этот файл)
```

---

## 🔌 API ENDPOINTS (НЕПОЛНЫЙ СПИСОК)

### Авторизация
- `POST /api/admin/login` - логин
- `GET /api/admin/me` - текущий пользователь

### Для OWNER
- `GET /api/admin/stats` - общая статистика
- `GET /api/admin/users` - все пользователи
- `POST /api/admin/users` - создать пользователя

### Для PRODUCT
- `GET /api/product/my-managers` - мои менеджеры
- `GET /api/product/manager/:id` - статус менеджера
- `POST /api/product/assign-training` - назначить обучение

### Для MANAGER
- `GET /api/manager/me` - мой профиль и статус
- `GET /api/manager/training` - инфо об обучении

---

## ✅ ПРОВЕРОЧНЫЙ СПИСОК

Когда будем реализовывать каждую роль:

### OWNER
- [ ] Страница `/dashboard.html` загружается
- [ ] Показывает статистику
- [ ] Может создавать пользователей
- [ ] Может выходить (логаут)
- [ ] API `/api/admin/stats` работает

### PRODUCT
- [ ] Страница `/product/dashboard.html` загружается
- [ ] Показывает только своих менеджеров
- [ ] Может видеть их статус обучения
- [ ] Может назначать обучение
- [ ] Может выходить
- [ ] НЕ может видеть других Product Managers
- [ ] API `/api/product/my-managers` работает

### MANAGER
- [ ] Страница `/manager/dashboard.html` загружается
- [ ] Если нет assignedProductId → видит ТОЛЬКО welcome
- [ ] Если есть assignedProductId → видит свой статус
- [ ] Может выходить
- [ ] НЕ может ничего редактировать
- [ ] API `/api/manager/me` работает

---

## 📌 КЛЮЧЕВЫЕ ПРАВИЛА

1. **Welcome статус** - АБСОЛЮТНО никаких функций, кроме "выход"
2. **Разделение данных** - каждая роль видит ТОЛЬКО свои данные через API
3. **Авторедирект** - после логина сразу идёт на свою страницу
4. **Логаут везде** - кнопка выхода на КАЖДОЙ странице
5. **Никаких лишних ссылок** - только релевантные пункты меню

---

## 🚀 ПОРЯДОК РАЗРАБОТКИ

1. **Этап 1**: Создать структуру ролей в API (login endpoint)
2. **Этап 2**: Создать OWNER dashboard + страница
3. **Этап 3**: Создать PRODUCT dashboard + страница
4. **Этап 4**: Создать MANAGER dashboard + страница
5. **Этап 5**: Тестирование всех ролей

