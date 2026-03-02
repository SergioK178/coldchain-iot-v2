CREATE TABLE "alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_rule_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now(),
	"reading_value" real NOT NULL,
	"threshold_value" real NOT NULL,
	"callback_attempted" boolean DEFAULT false,
	"callback_response_code" integer,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"metric" varchar(50) NOT NULL,
	"operator" varchar(4) NOT NULL,
	"threshold" real NOT NULL,
	"is_active" boolean DEFAULT true,
	"cooldown_minutes" integer DEFAULT 15 NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now(),
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(100),
	"actor" varchar(255) NOT NULL,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"serial" varchar(50) NOT NULL,
	"display_name" varchar(255),
	"zone_id" uuid,
	"power_source" varchar(20) NOT NULL,
	"calibration_offset_c" real DEFAULT 0,
	"firmware_version" varchar(20),
	"is_online" boolean DEFAULT false,
	"last_seen_at" timestamp with time zone,
	"last_temperature_c" real,
	"last_humidity_pct" real,
	"last_battery_pct" integer,
	"provisioned_at" timestamp with time zone DEFAULT now(),
	"decommissioned_at" timestamp with time zone,
	"mqtt_username" varchar(100) NOT NULL,
	"mqtt_password_hash" varchar(255) NOT NULL,
	CONSTRAINT "devices_serial_unique" UNIQUE("serial"),
	CONSTRAINT "devices_mqtt_username_unique" UNIQUE("mqtt_username")
);
--> statement-breakpoint
CREATE TABLE "ingestion_dedup" (
	"device_id" uuid NOT NULL,
	"message_id" varchar(64) NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_device_message" UNIQUE("device_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" varchar(500),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"device_id" uuid NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"message_id" varchar(64) NOT NULL,
	"temperature_c" real,
	"humidity_pct" real,
	"battery_pct" integer,
	"rssi_dbm" integer,
	"raw_payload" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_alert_rule_id_alert_rules_id_fk" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_dedup" ADD CONSTRAINT "ingestion_dedup_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;