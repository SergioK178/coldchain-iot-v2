# Дизайн-система «Снежок»

Документация палитры и компонентов веб-приложения Coldchain IoT (кодовое название — Снежок).

## Шрифт

- **Nunito** — основной шрифт (weights: 400, 600, 700, 800)
- Подключение: `next/font/google` в `apps/web/app/layout.tsx`
- CSS-переменная: `--font-nunito`

## Палитра

### Frost (холодные фоны и нейтральные)

| Токен      | HSL              | Назначение                    |
|------------|------------------|-------------------------------|
| `--frost-50`  | 210 55% 97%   | Основной фон страниц          |
| `--frost-100` | 208 55% 94%  | Вторичный фон, muted, accent  |
| `--frost-200` | 205 55% 88%  | Границы, input                |

### Snow (акценты)

| Токен       | HSL              | Назначение                    |
|-------------|------------------|-------------------------------|
| `--snow-500` | 211 86% 59%   | Primary, кнопки, ссылки, ring |
| `--snow-600` | 211 67% 50%   | Hover primary                 |

### Семантические токены (маппинг)

| Токен              | Источник   | Использование                          |
|--------------------|------------|----------------------------------------|
| `--background`     | frost-50   | Фон body                               |
| `--foreground`     | 212 40% 17%| Основной текст                         |
| `--primary`        | snow-500   | Кнопки, ссылки, focus ring              |
| `--secondary`      | frost-100  | Вторичные кнопки, muted блоки          |
| `--muted`          | frost-100  | Фон muted-элементов                    |
| `--accent`         | frost-100  | Hover ghost/outline                    |
| `--border`         | frost-200  | Границы                                |
| `--input`          | frost-200  | Границы input                          |
| `--ring`           | snow-500   | Focus ring                             |
| `--success`        | 142 76% 36%| Статус «Ок» (зелёный)                  |
| `--warning`        | 38 92% 50% | Предупреждения                         |
| `--destructive`    | 0 84% 60%  | Ошибки, удаление                       |

## Компоненты

### Карточки (Card)

- `bg-card`, `border`, `shadow-sm`
- Радиус: `--radius` (0.5rem)

### Кнопки (Button)

- **default**: `bg-primary text-primary-foreground`
- **secondary**: `bg-secondary text-secondary-foreground`
- **outline**: `border border-input bg-background hover:bg-accent`
- **ghost**: `hover:bg-accent hover:text-accent-foreground`
- **destructive**: `bg-destructive text-destructive-foreground`

### StatusIndicator

Использует фиксированные цвета для семантики:

- **ok**: зелёный (`green-500`, `green-700`)
- **alert / offline**: красный (`red-500`, `red-700`)
- **no_data**: `muted-foreground`, `muted`

### Логотип

- Компонент: `components/SnowflakeLogo.tsx`
- Стиль: снежинка в стиле Снежок

## Анимации

- Кастомная анимация: `animate-fade-up` (keyframes в `globals.css`)
- Эффект: fade-in + slide-up за 0.5s

## Файлы

| Файл                         | Назначение                          |
|-----------------------------|-------------------------------------|
| `apps/web/app/globals.css`  | CSS-переменные палитры              |
| `apps/web/app/layout.tsx`   | Подключение Nunito                  |
| `apps/web/tailwind.config.ts` | Цвета, шрифт, плагины            |
| `snezhok-login.html`        | Референсный дизайн входа            |
