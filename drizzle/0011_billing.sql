CREATE TABLE "client_bills" (
	"unit_id" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"bill_no" text,
	"bill_date" date,
	"amount" numeric(14, 2) NOT NULL,
	"passed_on" date,
	"note" text,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_bills_unit_id_year_month_pk" PRIMARY KEY("unit_id","year","month")
);
--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "billing_model" text DEFAULT 'per_employee' NOT NULL;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "billing_rate" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "client_bills" ADD CONSTRAINT "client_bills_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "units" SET "billing_model" = 'per_employee', "billing_rate" = 900 WHERE "code" IN ('ETP-PET', 'ETP-REF', 'WB-PET', 'WB-REF', 'DRIVERS');
--> statement-breakpoint
UPDATE "units" SET "billing_model" = 'percent', "billing_rate" = 4 WHERE "code" IN ('STP', 'HZL-CHD', 'HZL-DEB');
