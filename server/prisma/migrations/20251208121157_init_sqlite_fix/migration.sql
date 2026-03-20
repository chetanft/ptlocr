-- CreateTable
CREATE TABLE "OcrModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "standardPayloadSchema" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OcrConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moduleCode" TEXT NOT NULL,
    "consignorCode" TEXT,
    "transporterCode" TEXT,
    "prompt" TEXT,
    "fieldMappings" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "OcrModule_code_key" ON "OcrModule"("code");

-- CreateIndex
CREATE INDEX "OcrConfig_moduleCode_consignorCode_transporterCode_idx" ON "OcrConfig"("moduleCode", "consignorCode", "transporterCode");
