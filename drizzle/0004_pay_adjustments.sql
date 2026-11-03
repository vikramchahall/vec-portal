CREATE TABLE "pay_adjustments" (
	"run_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"ot_days" numeric(8, 4) DEFAULT '0' NOT NULL,
	"hold" integer DEFAULT 0 NOT NULL,
	"leave_encashment" integer DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"actor" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pay_adjustments_run_id_employee_id_pk" PRIMARY KEY("run_id","employee_id")
);
--> statement-breakpoint
ALTER TABLE "pay_adjustments" ADD CONSTRAINT "pay_adjustments_run_id_month_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."month_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_adjustments" ADD CONSTRAINT "pay_adjustments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;