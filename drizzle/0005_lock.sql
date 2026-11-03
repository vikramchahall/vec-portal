CREATE TABLE "run_snapshots" (
	"run_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "run_snapshots_run_id_employee_id_pk" PRIMARY KEY("run_id","employee_id")
);
--> statement-breakpoint
ALTER TABLE "month_runs" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "month_runs" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "month_runs" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "month_runs" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "run_snapshots" ADD CONSTRAINT "run_snapshots_run_id_month_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."month_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_snapshots" ADD CONSTRAINT "run_snapshots_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;