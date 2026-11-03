CREATE TABLE "day_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"day" integer NOT NULL,
	"code" text NOT NULL,
	"reason" text NOT NULL,
	"actor" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_opening" (
	"employee_id" integer NOT NULL,
	"month" date NOT NULL,
	"cl" numeric(12, 6) NOT NULL,
	"l" numeric(12, 6) NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "leave_opening_employee_id_month_pk" PRIMARY KEY("employee_id","month")
);
--> statement-breakpoint
CREATE TABLE "month_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"unit_id" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"holidays" integer[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "day_overrides" ADD CONSTRAINT "day_overrides_run_id_month_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."month_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_overrides" ADD CONSTRAINT "day_overrides_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_opening" ADD CONSTRAINT "leave_opening_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_runs" ADD CONSTRAINT "month_runs_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "day_overrides_key" ON "day_overrides" USING btree ("run_id","employee_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "month_runs_unit_month" ON "month_runs" USING btree ("unit_id","year","month");