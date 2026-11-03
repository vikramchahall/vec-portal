CREATE TABLE "excel_templates" (
	"unit_id" integer PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"file" "bytea" NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "excel_templates" ADD CONSTRAINT "excel_templates_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;