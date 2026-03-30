-- CreateTable
CREATE TABLE "Study" (
    "study_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Study_pkey" PRIMARY KEY ("study_id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "participant_id" TEXT NOT NULL,
    "study_id" TEXT NOT NULL,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token" TEXT NOT NULL,
    "device_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("participant_id")
);

-- CreateTable
CREATE TABLE "StudyProtocolVersion" (
    "id" TEXT NOT NULL,
    "study_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "protocol_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyProtocolVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptLog" (
    "prompt_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "study_id" TEXT,
    "protocol_version" INTEGER,
    "session_uuid" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "assessment_started_at" TIMESTAMP(3),
    "assessment_ended_at" TIMESTAMP(3),
    "status" TEXT,
    "quit_early" BOOLEAN NOT NULL DEFAULT false,
    "n_trials_completed" INTEGER,
    "context_snapshot_id" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptLog_pkey" PRIMARY KEY ("prompt_id")
);

-- CreateTable
CREATE TABLE "SessionUpload" (
    "session_uuid" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "study_id" TEXT NOT NULL,
    "prompt_id" TEXT NOT NULL,
    "protocol_version" INTEGER,
    "activity_id" TEXT NOT NULL,
    "activity_version" TEXT,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "canceled" BOOLEAN,
    "trials_json" JSONB NOT NULL,
    "scoring_json" JSONB NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionUpload_pkey" PRIMARY KEY ("session_uuid")
);

-- CreateTable
CREATE TABLE "ContextSnapshot" (
    "snapshot_id" TEXT NOT NULL,
    "prompt_id" TEXT,
    "participant_id" TEXT NOT NULL,
    "study_id" TEXT,
    "protocol_version" INTEGER,
    "captured_at" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gps_accuracy_meters" DOUBLE PRECISION,
    "battery_level" DOUBLE PRECISION,
    "is_charging" BOOLEAN,
    "network_type" TEXT,
    "payload_json" JSONB,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContextSnapshot_pkey" PRIMARY KEY ("snapshot_id")
);

-- CreateTable
CREATE TABLE "SurveyItemResponse" (
    "record_id" TEXT NOT NULL,
    "session_uuid" TEXT,
    "prompt_id" TEXT,
    "participant_id" TEXT NOT NULL,
    "study_id" TEXT,
    "protocol_version" INTEGER,
    "survey_id" TEXT NOT NULL,
    "survey_version" INTEGER,
    "item_id" TEXT NOT NULL,
    "response_status" TEXT NOT NULL,
    "response_value" JSONB,
    "captured_at" TIMESTAMP(3),
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyItemResponse_pkey" PRIMARY KEY ("record_id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "job_id" TEXT NOT NULL,
    "study_id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "download_url" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("job_id")
);

-- CreateIndex
CREATE INDEX "Participant_study_id_idx" ON "Participant"("study_id");

-- CreateIndex
CREATE INDEX "StudyProtocolVersion_study_id_created_at_idx" ON "StudyProtocolVersion"("study_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "StudyProtocolVersion_study_id_version_key" ON "StudyProtocolVersion"("study_id", "version");

-- CreateIndex
CREATE INDEX "PromptLog_participant_id_idx" ON "PromptLog"("participant_id");

-- CreateIndex
CREATE INDEX "PromptLog_study_id_idx" ON "PromptLog"("study_id");

-- CreateIndex
CREATE INDEX "SessionUpload_participant_id_idx" ON "SessionUpload"("participant_id");

-- CreateIndex
CREATE INDEX "SessionUpload_study_id_idx" ON "SessionUpload"("study_id");

-- CreateIndex
CREATE INDEX "SessionUpload_prompt_id_idx" ON "SessionUpload"("prompt_id");

-- CreateIndex
CREATE INDEX "ContextSnapshot_participant_id_idx" ON "ContextSnapshot"("participant_id");

-- CreateIndex
CREATE INDEX "ContextSnapshot_prompt_id_idx" ON "ContextSnapshot"("prompt_id");

-- CreateIndex
CREATE INDEX "SurveyItemResponse_participant_id_idx" ON "SurveyItemResponse"("participant_id");

-- CreateIndex
CREATE INDEX "SurveyItemResponse_prompt_id_idx" ON "SurveyItemResponse"("prompt_id");

-- CreateIndex
CREATE INDEX "SurveyItemResponse_session_uuid_idx" ON "SurveyItemResponse"("session_uuid");

-- CreateIndex
CREATE INDEX "SurveyItemResponse_survey_id_survey_version_idx" ON "SurveyItemResponse"("survey_id", "survey_version");

-- CreateIndex
CREATE INDEX "ExportJob_study_id_idx" ON "ExportJob"("study_id");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_study_id_fkey" FOREIGN KEY ("study_id") REFERENCES "Study"("study_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyProtocolVersion" ADD CONSTRAINT "StudyProtocolVersion_study_id_fkey" FOREIGN KEY ("study_id") REFERENCES "Study"("study_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptLog" ADD CONSTRAINT "PromptLog_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "Participant"("participant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionUpload" ADD CONSTRAINT "SessionUpload_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "Participant"("participant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextSnapshot" ADD CONSTRAINT "ContextSnapshot_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "Participant"("participant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyItemResponse" ADD CONSTRAINT "SurveyItemResponse_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "Participant"("participant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_study_id_fkey" FOREIGN KEY ("study_id") REFERENCES "Study"("study_id") ON DELETE CASCADE ON UPDATE CASCADE;
