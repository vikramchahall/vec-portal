CREATE TABLE "assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"unit_id" integer NOT NULL,
	"register_no" text,
	"designation" text,
	"category" text,
	"wo_weekday" text,
	"is_driver" boolean DEFAULT false NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "employee_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"card_no" text NOT NULL,
	"unit_id" integer,
	"valid_from" date NOT NULL,
	"valid_to" date
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"vec_id" text NOT NULL,
	"name" text NOT NULL,
	"father_name" text,
	"dob" date,
	"gender" text,
	"mobile" text,
	"address" text,
	"aadhaar_enc" text,
	"aadhaar_last4" text,
	"pan_enc" text,
	"pan_last4" text,
	"uan" text,
	"pf_account" text,
	"esic_ip" text,
	"pf_member" boolean DEFAULT true NOT NULL,
	"esi_member" boolean DEFAULT false NOT NULL,
	"bonus_monthly" boolean DEFAULT true NOT NULL,
	"bank_name" text,
	"account_enc" text,
	"account_last4" text,
	"ifsc" text,
	"status" text DEFAULT 'active' NOT NULL,
	"doj" date,
	"dol" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_vec_id_unique" UNIQUE("vec_id")
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"email" text PRIMARY KEY NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "min_wages" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"category" text NOT NULL,
	"effective_from" date NOT NULL,
	"daily_rate" integer NOT NULL,
	"monthly_rate" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_structures" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"effective_from" date NOT NULL,
	"basic_da" integer NOT NULL,
	"hra" integer DEFAULT 0 NOT NULL,
	"special" integer DEFAULT 0 NOT NULL,
	"conveyance" integer DEFAULT 0 NOT NULL,
	"others" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"client" text,
	"state" text NOT NULL,
	"billing_model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"work_orders" text[] DEFAULT '{}' NOT NULL,
	"mode" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_cards" ADD CONSTRAINT "employee_cards_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_cards" ADD CONSTRAINT "employee_cards_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_structures" ADD CONSTRAINT "pay_structures_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignments_emp" ON "assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "assignments_unit" ON "assignments" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_cards_card_from" ON "employee_cards" USING btree ("card_no","valid_from");--> statement-breakpoint
CREATE INDEX "employee_cards_emp" ON "employee_cards" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employees_name_idx" ON "employees" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "min_wages_key" ON "min_wages" USING btree ("state","category","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "pay_structures_emp_from" ON "pay_structures" USING btree ("employee_id","effective_from");