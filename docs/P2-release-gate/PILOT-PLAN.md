# Pilot Operations Start

Date: 2026-03-07  
Reference: [FINAL-POLISH-SPEC.md](./FINAL-POLISH-SPEC.md) §8

---

## 1. Pilot Scope

**1–2 controlled pilot installs** в двух контурах:

| Pilot | Contour | Цель |
|---|---|---|
| Pilot A | On-prem | Enterprise trace; friction capture |
| Pilot B | Managed | SMB trace; friction capture |

---

## 2. Onboarding Friction Capture

- Время от установки до первого устройства online.
- Количество шагов, вызывающих вопросы.
- Ошибки при serial/location/zone.
- QR: работает ли в реальных условиях (освещение, качество кода).

**Output:** ranked list friction points по impact.

---

## 3. Managed / On-Prem Friction Capture

- On-prem: сложность установки, доступ к серверу, firewall.
- Managed: handoff клиенту, первая настройка, поддержка.

**Output:** runbook gaps, documentation gaps.

---

## 4. Integration Request Capture

- Какие API endpoints используются чаще.
- Webhook: типичные события, форматы.
- Запросы на новые интеграции (SDK, коннекторы).

**Output:** integration backlog для P3-CUT.

---

## 5. Decision Loop

```
Pilot execution
    → Friction points ranked
    → Integration requests captured
    → Update P3-CUT.md priorities
    → Decision memo for high-impact items
```

---

## 6. Success Criteria

| Criterion | Target |
|---|---|
| Pilot install complete (both contours) | 2/2 |
| Top friction points ranked by impact | Top 5 documented |
| Confirmed valuable features | List from real operation |

---

## 7. Schedule (Template)

| Phase | Activity |
|---|---|
| Week 1–2 | Pilot A (on-prem) setup + execution |
| Week 2–3 | Pilot B (managed) setup + execution |
| Week 3–4 | Friction analysis, P3-CUT update |
| Week 4+ | Decision memos for high-impact items |

---

## 8. Evidence

- Runbook execution logs: [RUNBOOK-ONPREM.md](./RUNBOOK-ONPREM.md), [RUNBOOK-MANAGED.md](./RUNBOOK-MANAGED.md)
- Friction log: _(create during pilot)_
- Integration request log: _(create during pilot)_
