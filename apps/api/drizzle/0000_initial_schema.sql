CREATE TYPE "public"."sex" AS ENUM('male', 'female', 'other', 'decline_to_answer');--> statement-breakpoint
CREATE TABLE "appointments" (
	"appointment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"call_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_call_id" varchar(64) NOT NULL,
	"patient_id" uuid,
	"caller_phone_number" varchar(20),
	"ended_reason" varchar(120),
	"summary" text,
	"transcript" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calls_provider_call_id_unique" UNIQUE("provider_call_id")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"patient_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(50) NOT NULL,
	"last_name" varchar(50) NOT NULL,
	"date_of_birth" date NOT NULL,
	"sex" "sex" NOT NULL,
	"phone_number" char(10) NOT NULL,
	"email" varchar(254),
	"address_line_1" varchar(200) NOT NULL,
	"address_line_2" varchar(200),
	"city" varchar(100) NOT NULL,
	"state" char(2) NOT NULL,
	"zip_code" varchar(10) NOT NULL,
	"insurance_provider" varchar(100),
	"insurance_member_id" varchar(50),
	"preferred_language" varchar(50) DEFAULT 'English' NOT NULL,
	"emergency_contact_name" varchar(100),
	"emergency_contact_phone" char(10),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "patients_first_name_not_blank" CHECK (char_length("patients"."first_name") >= 1),
	CONSTRAINT "patients_last_name_not_blank" CHECK (char_length("patients"."last_name") >= 1),
	CONSTRAINT "patients_date_of_birth_range" CHECK ("patients"."date_of_birth" between date '1900-01-01' and current_date),
	CONSTRAINT "patients_phone_number_digits" CHECK ("patients"."phone_number" ~ '^[0-9]{10}$'),
	CONSTRAINT "patients_emergency_contact_phone_digits" CHECK ("patients"."emergency_contact_phone" is null or "patients"."emergency_contact_phone" ~ '^[0-9]{10}$'),
	CONSTRAINT "patients_state_code" CHECK ("patients"."state" ~ '^[A-Z]{2}$'),
	CONSTRAINT "patients_zip_code_format" CHECK ("patients"."zip_code" ~ '^[0-9]{5}(-[0-9]{4})?$'),
	CONSTRAINT "patients_city_not_blank" CHECK (char_length("patients"."city") >= 1)
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("patient_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_patient_id_patients_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("patient_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_patient_id_idx" ON "appointments" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_scheduled_at_unique" ON "appointments" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "calls_patient_id_idx" ON "calls" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "patients_phone_number_idx" ON "patients" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "patients_last_name_idx" ON "patients" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "patients_date_of_birth_idx" ON "patients" USING btree ("date_of_birth");