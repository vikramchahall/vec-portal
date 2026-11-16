CREATE TABLE "compliance_done" (
	"item_id" integer NOT NULL,
	"due_date" date NOT NULL,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_by" text NOT NULL,
	"reference" text,
	"note" text,
	CONSTRAINT "compliance_done_item_id_due_date_pk" PRIMARY KEY("item_id","due_date")
);
--> statement-breakpoint
CREATE TABLE "compliance_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"authority" text,
	"frequency" text NOT NULL,
	"due_day" integer NOT NULL,
	"due_months" integer[] DEFAULT '{}' NOT NULL,
	"period" text DEFAULT 'previous month' NOT NULL,
	"applies_to" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_done" ADD CONSTRAINT "compliance_done_item_id_compliance_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."compliance_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "compliance_items" ("title", "authority", "frequency", "due_day", "due_months", "period", "applies_to", "notes", "sort_order") VALUES
  ('Pay salaries to workers', 'Payment of Wages', 'monthly', 7, '{}', 'previous month', 'All units', 'Wages for the month are paid by the 7th of the next month (fewer than 1,000 workers).', 1),
  ('EPF: ECR upload and challan payment', 'EPFO', 'monthly', 15, '{}', 'previous month', 'All units', 'Statutory & Compliance → PF / ESIC → ECR .txt, then pay the TRRN challan.', 2),
  ('ESIC: monthly contribution', 'ESIC', 'monthly', 15, '{}', 'previous month', 'All units', 'PF / ESIC → ESIC upload .xls, then pay the challan.', 3),
  ('Punjab Development Tax (PT ₹200)', 'Punjab Excise & Taxation', 'monthly', 20, '{}', 'previous month', 'HMEL units (Punjab)', 'Confirm the due date with your accountant and edit it here.', 4),
  ('Punjab LWF return (Apr–Sep)', 'Punjab Labour Welfare Board', 'yearly', 15, '{10}', 'April–September', 'HMEL units (Punjab)', 'Two eLabour logins: Licence (WB / RODM) and NoLicence (ETP). Confirm the due date.', 5),
  ('Punjab LWF return (Oct–Mar)', 'Punjab Labour Welfare Board', 'yearly', 15, '{4}', 'October–March', 'HMEL units (Punjab)', 'Two eLabour logins: Licence (WB / RODM) and NoLicence (ETP). Confirm the due date.', 6),
  ('Check minimum-wage revision (Punjab)', 'Punjab Labour Dept', 'half_yearly', 1, '{4,10}', 'from this month', 'HMEL units (Punjab)', 'Update Basic + DA for anyone below the new rates before making the month''s salary.', 7),
  ('Annual bonus paid (previous financial year)', 'Payment of Bonus Act', 'yearly', 30, '{11}', 'previous financial year', 'All units', 'Only where bonus is not already paid monthly.', 8),
  ('Client bills for the month', 'Internal', 'monthly', 10, '{}', 'previous month', 'All units', 'Bills prepared from the locked Working Salary; the client approves them.', 9);
