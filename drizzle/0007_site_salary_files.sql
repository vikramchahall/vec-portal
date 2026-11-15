CREATE TABLE "site_salary_files" (
	"run_id" integer PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"file" "bytea" NOT NULL,
	"rows" jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_salary_files" ADD CONSTRAINT "site_salary_files_run_id_month_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."month_runs"("id") ON DELETE cascade ON UPDATE no action;