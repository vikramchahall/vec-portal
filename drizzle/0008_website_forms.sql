CREATE TABLE "enquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'enquiry' NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"company" text,
	"message" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"note" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"city" text,
	"position" text NOT NULL,
	"experience_years" integer,
	"message" text,
	"status" text DEFAULT 'new' NOT NULL,
	"note" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "enquiries_created" ON "enquiries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "job_applications_created" ON "job_applications" USING btree ("created_at");