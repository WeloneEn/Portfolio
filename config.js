// Optional API base override for static hosting (for example GitHub Pages).
// Example:
//   window.WELONE_API_BASE = "https://your-backend.example.com/";
// If empty, frontend uses current window origin.
window.WELONE_API_BASE = window.WELONE_API_BASE || "";

// ==========================================
// BUSINESS SETTINGS
// ==========================================
// Управление количеством доступных мест:
// 1+ = "Осталось N мест", кнопка "Занять место"
// 0  = "Мест нет, бронь на след. месяц", кнопка "В лист ожидания"
window.WELONE_AVAILABLE_SPOTS = 1;
