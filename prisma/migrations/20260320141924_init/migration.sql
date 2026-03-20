-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generating',
    "pipelineStage" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "imagePrompt" TEXT NOT NULL,
    "imageUrl" TEXT,
    CONSTRAINT "Scene_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "translatedScript" TEXT NOT NULL,
    "ttsUrl" TEXT,
    "srtUrl" TEXT,
    "videoUrl" TEXT,
    "youtubeVideoId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "tags" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Variant_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "language" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "channelId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Credential_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadTime1" TEXT NOT NULL DEFAULT '07:00',
    "uploadTime2" TEXT NOT NULL DEFAULT '21:00',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul'
);

-- CreateTable
CREATE TABLE "QuotaTracker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "usedUnits" INTEGER NOT NULL DEFAULT 0,
    "maxUnits" INTEGER NOT NULL DEFAULT 10000
);

-- CreateIndex
CREATE UNIQUE INDEX "Variant_videoId_language_key" ON "Variant"("videoId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_language_key" ON "Channel"("language");

-- CreateIndex
CREATE UNIQUE INDEX "Credential_channelId_key" ON "Credential"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaTracker_date_key" ON "QuotaTracker"("date");
