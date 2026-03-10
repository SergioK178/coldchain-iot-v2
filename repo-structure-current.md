lenov@Legion5PRO:/projects/coldchain-iot-v2$ tree -L 6 -I 'node_modules|.next|.turbo|.cache|dist|out|.git|utils'
.
├── QUICK-START.md
├── README.md
├── apps
│   ├── server
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── app.ts
│   │   │   ├── config.ts
│   │   │   ├── index.ts
│   │   │   ├── lib
│   │   │   │   ├── auth-rate-limit.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── mosquitto-files.ts
│   │   │   │   ├── mosquitto-reload.ts
│   │   │   │   ├── telegram-bot.ts
│   │   │   │   ├── telegram-codes.ts
│   │   │   │   ├── telegram-send.ts
│   │   │   │   └── webhook-url-policy.ts
│   │   │   ├── plugins
│   │   │   │   ├── auth.ts
│   │   │   │   ├── mqtt.ts
│   │   │   │   └── swagger.ts
│   │   │   ├── routes
│   │   │   │   ├── alert-events.ts
│   │   │   │   ├── alert-rules.ts
│   │   │   │   ├── audit.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── calibrations.ts
│   │   │   │   ├── devices.ts
│   │   │   │   ├── export.ts
│   │   │   │   ├── health.ts
│   │   │   │   ├── locations.ts
│   │   │   │   ├── readings.ts
│   │   │   │   ├── settings.ts
│   │   │   │   ├── users.ts
│   │   │   │   └── webhooks.ts
│   │   │   ├── services
│   │   │   │   ├── alert.ts
│   │   │   │   ├── audit.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── device.ts
│   │   │   │   ├── ingestion.ts
│   │   │   │   ├── provision.ts
│   │   │   │   └── webhook.ts
│   │   │   └── types
│   │   │       └── deps.d.ts
│   │   └── tsconfig.json
│   └── web
│       ├── Dockerfile
│       ├── app
│       │   ├── alerts
│       │   │   └── page.tsx
│       │   ├── api
│       │   │   ├── auth
│       │   │   │   └── [...path]
│       │   │   ├── health
│       │   │   │   └── route.ts
│       │   │   ├── proxy
│       │   │   │   └── route.ts
│       │   │   └── v1
│       │   │       └── health
│       │   ├── devices
│       │   │   ├── [serial]
│       │   │   │   ├── error.tsx
│       │   │   │   └── page.tsx
│       │   │   └── page.tsx
│       │   ├── docs
│       │   │   └── hardware-provisioning
│       │   │       └── page.tsx
│       │   ├── export
│       │   │   └── page.tsx
│       │   ├── globals.css
│       │   ├── layout.tsx
│       │   ├── locations
│       │   │   ├── [id]
│       │   │   │   └── page.tsx
│       │   │   └── page.tsx
│       │   ├── login
│       │   │   └── page.tsx
│       │   ├── onboard
│       │   │   └── page.tsx
│       │   ├── page.tsx
│       │   └── settings
│       │       ├── page.tsx
│       │       └── telegram
│       │           └── page.tsx
│       ├── components
│       │   ├── AppShell.tsx
│       │   ├── AuthGuard.tsx
│       │   ├── Collapsible.tsx
│       │   ├── I18nProvider.tsx
│       │   ├── QrScanner.tsx
│       │   ├── ShellOrPlain.tsx
│       │   ├── SnowflakeLogo.tsx
│       │   ├── StatusIndicator.tsx
│       │   └── ui
│       │       ├── badge.tsx
│       │       ├── button.tsx
│       │       ├── card.tsx
│       │       ├── dialog.tsx
│       │       ├── input.tsx
│       │       ├── label.tsx
│       │       ├── separator.tsx
│       │       ├── skeleton.tsx
│       │       ├── table.tsx
│       │       └── tabs.tsx
│       ├── lib
│       │   ├── api.ts
│       │   ├── i18n.ts
│       │   ├── translations.ts
│       │   └── utils.ts
│       ├── middleware.ts
│       ├── next-env.d.ts
│       ├── next.config.js
│       ├── package.json
│       ├── postcss.config.mjs
│       ├── tailwind.config.ts
│       └── tsconfig.json
├── artifacts
│   └── hardening
│       ├── e2e-test.txt
│       ├── e2e-with-simulators.txt
│       └── server-log.txt
├── bom-suggestions.md
├── deploy
│   ├── config
│   │   ├── caddy
│   │   │   └── Caddyfile
│   │   └── mosquitto
│   │       └── mosquitto.conf
│   ├── data
│   │   └── mosquitto
│   │       ├── acl
│   │       └── passwd
│   ├── docker-compose.yml
│   ├── docs
│   │   ├── backup-restore.md
│   │   ├── hardware-provisioning.md
│   │   ├── install-guide.md
│   │   ├── managed-cloud-checklist.md
│   │   └── security.md
│   └── scripts
│       ├── backup.sh
│       ├── e2e-test.sh
│       ├── e2e-with-simulators.sh
│       ├── restore.sh
│       └── smoke-load.sh
├── docker-compose.yml
├── docs
│   ├── DESIGN-SYSTEM.md
│   ├── P2
│   │   ├── API-COMPATIBILITY-POLICY.md
│   │   ├── API-REFERENCE.md
│   │   ├── F6-DECISION.md
│   │   ├── P2-EVOLUTION.md
│   │   ├── SECURITY-HARDENING.md
│   │   ├── UI-SPEC.md
│   │   └── openapi-p2.json
│   ├── P2-hardening
│   │   ├── HARDENING-SPEC.md
│   │   └── HARDENING-SUMMARY.md
│   ├── P2-release-gate
│   │   ├── ARCH-BUSINESS-MEMO.md
│   │   ├── FINAL-POLISH-SPEC.md
│   │   ├── GATE-STATUS.md
│   │   ├── HARDENING-OPTIMIZATION-CLEANUP-SPEC.md
│   │   ├── HARDENING-REPORT.md
│   │   ├── P2-ACCEPTANCE.md
│   │   ├── P3-CUT.md
│   │   ├── PILOT-PLAN.md
│   │   ├── PRODUCT-BOUNDARY.md
│   │   ├── RUNBOOK-MANAGED.md
│   │   ├── RUNBOOK-ONPREM.md
│   │   └── UX-UI-EVALUATION.md
│   ├── README.md
│   ├── api-reference.md
│   ├── archive
│   │   ├── MASTER-SPEC.md
│   │   ├── P1
│   │   │   ├── EXECUTION-PLAN.md
│   │   │   ├── FIRMWARE-GUIDE.md
│   │   │   ├── IMPLEMENTATION-SUMMARY.md
│   │   │   └── api-reference-p1.md
│   │   ├── P1-hardening
│   │   │   ├── HARDENING-SPEC.md
│   │   │   └── HARDENING-SUMMARY.md
│   │   ├── P2-CLOSURE-SUMMARY.md
│   │   ├── P2-parallel-polish
│   │   │   ├── PARALLEL-POLISH-SPEC.md
│   │   │   ├── POLISH-SUMMARY.md
│   │   │   └── THREE-TRACK-EXECUTION-SPEC.md
│   │   ├── README.md
│   │   └── openapi-p1.json
│   ├── openapi.json
│   ├── references
│   │   └── snezhok-login.html
│   └── sensor
│       └── MASTER-SPEC.md
├── openapi-relevant.json
├── package.json
├── packages
│   ├── db
│   │   ├── drizzle.config.ts
│   │   ├── migrations
│   │   │   ├── 0000_neat_nextwave.sql
│   │   │   ├── 0001_p2.sql
│   │   │   ├── 0002_activation_token.sql
│   │   │   └── meta
│   │   │       ├── 0000_snapshot.json
│   │   │       └── _journal.json
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── client.ts
│   │   │   ├── index.ts
│   │   │   ├── migrate.ts
│   │   │   ├── schema.ts
│   │   │   └── seed.ts
│   │   └── tsconfig.json
│   ├── sdk-ts
│   │   ├── README.md
│   │   ├── examples
│   │   │   ├── quickstart.ts
│   │   │   └── webhook-consumer.ts
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── client.ts
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   └── webhook.ts
│   │   └── tsconfig.json
│   └── shared
│       ├── package.json
│       ├── src
│       │   ├── __tests__
│       │   │   ├── device-types.test.ts
│       │   │   └── payload.test.ts
│       │   ├── constants
│       │   │   ├── device-types.ts
│       │   │   ├── errors.ts
│       │   │   └── mqtt.ts
│       │   ├── index.ts
│       │   └── schemas
│       │       ├── alert.ts
│       │       ├── api.ts
│       │       ├── device.ts
│       │       └── payload.ts
│       └── tsconfig.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── repo-structure-current.md
├── tools
│   ├── mosquitto-auth-sync
│   │   ├── Dockerfile
│   │   ├── mosquitto.conf
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── hash.ts
│   │   │   ├── index.ts
│   │   │   └── rebuild.ts
│   │   └── tsconfig.json
│   ├── provision-cli
│   │   ├── package.json
│   │   └── src
│   │       └── index.ts
│   └── simulator
│       ├── package.json
│       └── src
│           └── index.ts
├── tsconfig.base.json
└── ui
    ├── index.html
    ├── package.json
    ├── src
    │   ├── App.tsx
    │   ├── components
    │   │   ├── AcknowledgeButton.tsx
    │   │   ├── DeviceRow.tsx
    │   │   └── StatusBadge.tsx
    │   ├── lib
    │   │   └── api.ts
    │   └── main.tsx
    ├── tsconfig.json
    └── vite.config.ts

77 directories, 208 files