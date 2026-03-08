# P2 UI Specification

Дата фиксации: 2026-03-04
Статус: Accepted

## 1. Цель

Зафиксировать единый UI-стек и правила реализации для P2, чтобы все экраны (`/devices`, `/alerts`, `/locations`, `/settings`, `/onboard`) развивались в одном визуальном и техническом стандарте.

## 2. Выбранный UI-стек (approved)

1. Framework/runtime: Next.js 14 (App Router), React 18
2. Styling: Tailwind CSS
3. Component system: shadcn/ui (на базе Radix UI)
4. Icons: lucide-react
5. Charts: Recharts
6. Tables: TanStack Table
7. Forms/validation: react-hook-form + zod
8. Notifications: sonner

## 3. UI-директивы (P2)

1. Единый app shell для всех основных страниц:
   - top navigation + content container
   - единые отступы/типографика/состояния загрузки
2. Для данных обязательны стандартные состояния:
   - `loading` (skeleton)
   - `empty` (понятный empty state)
   - `error` (ошибка с actionable текстом)
3. Для мутаций обязательны:
   - inline validation
   - toast feedback (success/error)
   - confirm dialog для destructive действий
4. Таблицы и формы в `settings`/`locations`/`alerts`/`devices` реализуются через UI-компоненты из п.2, без ad-hoc разметки.

## 4. Минимальные визуальные требования

1. Светлая тема по умолчанию (без обязательного dark-mode в P2)
2. Нейтральная база + один акцентный цвет
3. Desktop-first layout с корректной mobile-адаптацией (breakpoints Tailwind)
4. Согласованная типографика и spacing scale во всех экранах

## 5. Scope/границы

1. Документ фиксирует именно P2-реализацию UI.
2. Не меняет source-of-truth по продуктовым требованиям:
   - MUST/SHOULD остаются в `docs/P2/P2-EVOLUTION.md`.
3. Дизайн-система может расширяться в P3, но отклонения от текущего стека в P2 не допускаются без отдельного решения.

## 6. Реализация (apps/web)

- **Стек:** Tailwind CSS, Radix UI (Dialog, Tabs, Label, Separator, Slot), class-variance-authority, tailwind-merge, clsx, lucide-react, Recharts, sonner.
- **Компоненты:** Button, Card, Input, Label, Table, Dialog, Badge, Skeleton, Separator, Tabs (в `components/ui/`). AppShell с сайдбаром и навигацией.
- **Страницы:** `/` — дашборд (сводка locations → zones → devices, карточки счётчиков). `/devices` — таблица устройств. `/devices/[serial]` — деталь, текущие значения, график Recharts (температура/влажность), правила оповещений. `/locations` — CRUD локаций (создание/редактирование/удаление через диалоги). `/locations/[id]` — CRUD зон. `/alerts` — фильтры (устройство, подтверждено, дата), таблица, кнопка «Подтвердить». `/settings` — вкладки «Пользователи» и «Webhooks» с таблицами и созданием/удалением. `/onboard` — форма ручной регистрации устройства (F8a). `/login` — форма входа. `/docs/hardware-provisioning` — инструкция по настройке оборудования (из deploy/docs/hardware-provisioning.md).
- **Локализация:** RU/EN, переключатель в сайдбаре, сохранение выбора в localStorage.
- **Состояния:** skeleton при загрузке, empty state, error state, confirm-диалог перед удалением, toast (sonner) при успехе/ошибке мутаций.
