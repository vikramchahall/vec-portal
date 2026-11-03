CREATE TABLE "punch_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"sha256" text NOT NULL,
	"format" text NOT NULL,
	"month" text,
	"rows" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "punch_files_sha256_unique" UNIQUE("sha256")
);
--> statement-breakpoint
CREATE TABLE "punches" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" integer NOT NULL,
	"card_no" text NOT NULL,
	"ts" timestamp NOT NULL,
	"dir" text NOT NULL,
	"access" text NOT NULL,
	"work_order" text NOT NULL,
	"name" text,
	"designation" text
);
--> statement-breakpoint
ALTER TABLE "punches" ADD CONSTRAINT "punches_file_id_punch_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."punch_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "punches_swipe" ON "punches" USING btree ("card_no","ts","dir","work_order","access");--> statement-breakpoint
CREATE INDEX "punches_card_ts" ON "punches" USING btree ("card_no","ts");--> statement-breakpoint
CREATE INDEX "punches_wo_ts" ON "punches" USING btree ("work_order","ts");