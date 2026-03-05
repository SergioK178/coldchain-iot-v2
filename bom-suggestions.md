# BOM Suggestions (EVT/Pilot)

**Статус документа:** `DRAFT`  
**Назначение:** синхронизировать инженерию и закупку по двум зафиксированным конфигурациям: __Rev.A-Lite__ и __Rev.A-Field__.

---

## Что отправляем сейчас (коротко)

**Цель раздела:** дать __один понятный состав на завтра__ для коммуникации с коллегами и закупкой.

**Контекст:** на этапе EVT/Pilot приоритетом является __снижение рисков bring-up__, а не максимальная точность любой ценой.

| SKU | Состав (Pilot) | Почему сейчас |
|---|---|---|
| **SENS-TP** | core + DS18B20-based hermetic probe | Быстрый старт, меньше схемных и кабельных рисков |
| **SENS-TH** | core + HDC3022DEJR + ePTFE RH path | Корректный RH-тракт для холодильной среды |

**Решение:** в пилот отправляем __эти 2 SKU без расширений__.  
**Правило по ревизиям:** __EVT/Pilot: Rev.A-Lite__; __первая продаваемая партия: Rev.A-Field (Sellable), без упрощений__.  
**Важно:** это __seed BOM__, не финальный production BOM по каждой пассивке.

---

## Зафиксированные решения

**Цель раздела:** зафиксировать технический baseline, от которого не отклоняемся без отдельного решения.

| Тема | Решение | Комментарий |
|---|---|---|
| SKU | 2 железных SKU: SENS-TP и SENS-TH | Разделение по среде и сенсорике |
| Архитектура | Общая core-board + разный sensor/mechanics | Не привязываться к идее "одна плата и разная прошивка" |
| MCU/Radio | ESP32-C3-MINI-1U-N4 | U.FL версия для внешней антенны |
| PMIC | TPS63900 | База питания для батарейного Wi-Fi узла |
| Battery strategy | Pilot: 2xAA Li-FeS2; Production: Li-SOCl2 + HLC/supercap | Фазовый подход по рискам |
| RH primary | HDC3022 | Основной RH/T сенсор |
| RH alternative | SHT4x only with membrane/filter cap | Не использовать bare-вариант |
| Vent policy | SENS-TP: optional; SENS-TH: mandatory as RH path | Правило по SKU, не универсальное |
| Корпус-референс | Hammond 1554-class | Референс класса IP67/68 |

**Вывод:** любые новые предложения сравнивать с baseline по риску, сроку и стоимости.  
**Политика изменений:** любое отклонение от __Rev.A-Lite / Rev.A-Field__ фиксируется отдельным решением в этом файле (дата, автор, причина).

---

## Конфигурации (Freeze targets)

### Конфигурация A: MVP-Lite (Rev.A-Lite) — быстрый bring-up

**Цель:** быстро собрать 10-20 устройств и проверить связь/питание/прошивку/данные.  
**Ограничение:** не претендует на антивандальность и "идеальный" RH-тракт.

| Блок | Фиксируем | Разрешенные упрощения (только Lite) |
|---|---|---|
| Power | Pilot: 2xAA Li-FeS2 + TPS63900 | bulk capacitor допускается 220-470 uF; battery retention можно упростить |
| Enclosure | Любой простой корпус (не обязательно IP67) | допускается без cable gland, если зонд не выводится наружу |
| Antenna | Допустима внутренняя/PCB-антенна | допускается без U.FL и внешней антенны |
| SENS-TP | DS18B20 probe | защита линии (TVS) опциональна в Lite |
| SENS-TH | HDC3022 + ePTFE RH path | допускается временное окно без полноценного антикапельного лабиринта |
| Coating | Опционально | можно не покрывать плату в Lite |

**Статус применения:** использовать только для __EVT/Pilot__.

### Конфигурация B: Sellable (Rev.A-Field) — то, что можно ставить в поле

**Цель:** устройство "поставил и работает" в холодильнике/морозилке, устойчиво к конденсату и дерганью провода.  
**Запрет:** никаких Lite-упрощений.

| Блок | Фиксируем (обязательно) | Примечание |
|---|---|---|
| Power | 2xAA Li-FeS2 + TPS63900 + bulk 470 uF low-ESR + MLCC near radio | предотвращает ресеты на Wi-Fi пиках |
| Battery retention | Механическая фиксация (скоба/прижим/пенка) | держатель "как получится" запрещен |
| Enclosure | IP67 polycarbonate, крышка на винтах (Torx/anti-tamper) | Hammond 1554-class как референс |
| Cable entry | IP67 cable gland + strain relief | для зонда/кабелей |
| Antenna | ESP32-C3-MINI-1U-N4 + U.FL + внешняя 2.4 GHz антенна + фиксатор pigtail | стабильная связь внутри холодильника |
| Protection | TVS/ESD на внешних линиях + отдельная защита probe line | обязательно |
| Coating | Обязательное conformal coating | no-coat зоны: RH area, RF keepout, interfaces |
| SENS-TP | DS18B20 probe + 4.7k pull-up + TVS probe line | vent optional |
| SENS-TH | HDC3022 + 4.7k x2 + ePTFE RH path + защита мембраны от капель | vent mandatory как часть RH-тракта |

**Статус применения:** это __baseline для первой продаваемой партии__.

---

## BOM Seed: общий core (на 1 устройство)

**Цель раздела:** разнести обязательные позиции по двум freeze-конфигурациям.

### Core (Lite) — минимальный

| Блок | Позиция | Назначение |
|---|---|---|
| Core Lite | ESP32-C3-MINI-1U-N4 | MCU/Radio модуль |
| Core Lite | TPS63900DSKR | PMIC buck-boost |
| Core Lite | Antenna (internal/PCB or external) | Антенна для пилота |
| Core Lite | 2x AA Li-FeS2 cells | Питание |
| Core Lite | 2xAA holder/contacts | Фиксация батарей |
| Core Lite | Low-ESR bulk 220-470 uF, >=6.3 V | Буфер TX-пиков |
| Core Lite | 10 uF + 22 uF + 2.2 uH | Базовая обвязка PMIC |
| Core Lite | Divider + gating transistor | Battery sense |
| Core Lite | Tag-Connect/pogo + reset/service pads | Прошивка и сервис |
| Core Lite | TVS/ESD on external lines | Опционально в Lite |
| Core Lite | Enclosure (simple allowed) | Не обязательно IP67 |
| Core Lite | Cable gland/feedthrough | Опционально |
| Core Lite | Conformal coating | Опционально |

### Core (Field) — полный

| Блок | Позиция | Назначение |
|---|---|---|
| Core Field | ESP32-C3-MINI-1U-N4 + U.FL + external antenna | Стабильная полевая связь |
| Core Field | TPS63900DSKR + MLCC near radio + bulk 470 uF low-ESR | Устойчивость к TX-пикам |
| Core Field | 2x AA Li-FeS2 + battery retention fixture | Питание и механическая надежность |
| Core Field | TVS/ESD on all external lines | Полевая живучесть |
| Core Field | IP67 polycarbonate enclosure | Защищенный корпус |
| Core Field | Silicone/EPDM gasket | Герметизация |
| Core Field | IP67 cable gland + strain relief | Герметичный ввод кабеля |
| Core Field | Conformal coating (mandatory) | С исключением no-coat зон |
| Core Field | Tag-Connect/pogo + reset/service + test points | Сервис и диагностика |

---

## BOM Seed: SKU 1 (SENS-TP, temp-only)

**Цель раздела:** быстрый и предсказуемый pilot для морозилки, с явной границей Lite/Field.

| Блок | Позиция | Назначение |
|---|---|---|
| SENS-TP | DS18B20-based hermetic probe, 1 m | Температурный зонд |
| SENS-TP | 4.7 kOhm resistor | 1-Wire pull-up |
| SENS-TP | 100 nF ceramic capacitor | Локальная развязка |
| SENS-TP | TVS diode for probe line | Защита линии зонда |

| Пункт | Lite | Field |
|---|---|---|
| Probe line TVS | Optional | Mandatory |
| Vent | Optional | Optional |

**Вывод:** для SENS-TP базовый путь — __digital probe__, RTD не блокирует пилот.

---

## BOM Seed: SKU 2 (SENS-TH, temp+RH)

**Цель раздела:** корректный RH-тракт для холодильной среды с четким минимумом для продажи.

| Блок | Позиция | Назначение |
|---|---|---|
| SENS-TH | HDC3022DEJR | Основной RH/T сенсор |
| SENS-TH | 4.7 kOhm x2 | I2C pull-up (SDA + SCL) |
| SENS-TH | 100 nF ceramic capacitor | Локальная развязка |
| SENS-TH | ePTFE vent / dedicated RH air path | Воздушный тракт RH |

| Пункт | Lite | Field |
|---|---|---|
| RH path | Допускается временное окно | Полноценный тракт + защита от капель |
| Vent | Mandatory как часть RH path | Mandatory как часть RH path |

**Вывод:** для SENS-TH вентиляция и окно считаются __измерительной частью__, а не опцией корпуса.

---

## Опция: SENS-TP PRO (не базовый пилот)

**Цель раздела:** сохранить путь к более точной версии без блокировки Lite/Field графика.

| Блок | Позиция | Назначение |
|---|---|---|
| SENS-TP PRO | MAX31865ATP+T | RTD AFE для PT100/PT1000 |
| SENS-TP PRO | PT1000 probe, Class B+ | Точный температурный зонд |
| SENS-TP PRO | Precision resistor (0.1%) | Опорный резистор для MAX31865 |
| SENS-TP PRO | SPI support passives | Обвязка интерфейса |
| SENS-TP PRO | 100 nF ceramic capacitor | Локальная развязка |

**Условие использования:** брать только при явном требовании точности и отдельном бюджете на bring-up.

---

## Инженерный чеклист перед freeze

**Цель раздела:** контрольный список перед переходом к `FROZEN`.

| Категория | Требование | Комментарий |
|---|---|---|
| Power | Bulk + (при Li-SOCl2) supercap/HLC + battery sense | Без этого высокий риск по Wi-Fi пикам |
| Service | Tag-Connect/pogo + reset/service pads + test points | Ускоряет bring-up и диагностику |
| Protection | ESD/TVS на внешних линиях и probe line | Критично для длинных "мокрых" проводов |
| Mechanics | Cable gland + gasket spec + battery retention method | Фиксировать как явные позиции |
| Coating | Правила cover/no-cover | Не покрывать RH area, RF keepout, interfaces |

### Freeze gate

**Rev.A-Lite считается замороженным (`FROZEN`), когда:**

1. BOM заполнен и по каждой позиции есть owner.
2. Собран минимум 1 рабочий образец.
3. Прошивка стабильно шьется и телеметрия уходит без сбоев.
4. Телеметрия стабильна не менее 24 часов.

**Rev.A-Field считается замороженным (`FROZEN`), когда:**

1. Выполнены все критерии Rev.A-Lite.
2. Подтверждены IP67 корпус, cable gland и coating.
3. Для SENS-TH подтвержден RH-тракт (включая защиту мембраны от капель).
4. Пройден 72-часовой тест в холодильнике/морозилке.
5. Пройден 24-часовой тест на отключение/переподключение Wi-Fi.

**Статусы конфигураций:** `DRAFT` / `FROZEN` / `DEPRECATED`.

---

## Что вынести в отдельный документ

**Цель раздела:** отделить стабильные инженерные решения от быстро меняющихся закупочных данных.

| Блок | Куда вынести | Почему |
|---|---|---|
| Lead time / availability | Sourcing tracker / procurement appendix | Быстро устаревает, не часть инженерного baseline BOM |

**Принцип:** в этом файле держим __только технический baseline__, в sourcing-файле — сроки и коммерцию.
