warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "NewsSource" AS ENUM ('GDELT', 'SEC_RSS', 'KAP', 'GOOGLE_NEWS');

-- CreateEnum
CREATE TYPE "Market" AS ENUM ('BIST', 'USA', 'CRYPTO', 'MACRO');

-- CreateTable
CREATE TABLE "news_items" (
    "id" UUID NOT NULL,
    "source" "NewsSource" NOT NULL,
    "source_id" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "summary" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickers" (
    "id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "market" "Market" NOT NULL,
    "name" TEXT,

    CONSTRAINT "tickers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_item_tags" (
    "news_item_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_item_tags_pkey" PRIMARY KEY ("news_item_id","tag_id")
);

-- CreateTable
CREATE TABLE "news_item_tickers" (
    "news_item_id" UUID NOT NULL,
    "ticker_id" UUID NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_item_tickers_pkey" PRIMARY KEY ("news_item_id","ticker_id")
);

-- CreateTable
CREATE TABLE "ingestion_cursors" (
    "source" "NewsSource" NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingestion_cursors_pkey" PRIMARY KEY ("source","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_items_url_key" ON "news_items"("url");

-- CreateIndex
CREATE INDEX "news_items_published_at_idx" ON "news_items"("published_at" DESC);

-- CreateIndex
CREATE INDEX "news_items_source_idx" ON "news_items"("source");

-- CreateIndex
CREATE INDEX "news_items_created_at_idx" ON "news_items"("created_at" DESC);

-- CreateIndex
CREATE INDEX "news_items_source_published_at_idx" ON "news_items"("source", "published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "tags_name_idx" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tickers_symbol_key" ON "tickers"("symbol");

-- CreateIndex
CREATE INDEX "tickers_symbol_idx" ON "tickers"("symbol");

-- CreateIndex
CREATE INDEX "tickers_market_idx" ON "tickers"("market");

-- CreateIndex
CREATE INDEX "news_item_tags_tag_id_idx" ON "news_item_tags"("tag_id");

-- CreateIndex
CREATE INDEX "news_item_tags_news_item_id_idx" ON "news_item_tags"("news_item_id");

-- CreateIndex
CREATE INDEX "news_item_tickers_ticker_id_idx" ON "news_item_tickers"("ticker_id");

-- CreateIndex
CREATE INDEX "news_item_tickers_news_item_id_idx" ON "news_item_tickers"("news_item_id");

-- AddForeignKey
ALTER TABLE "news_item_tags" ADD CONSTRAINT "news_item_tags_news_item_id_fkey" FOREIGN KEY ("news_item_id") REFERENCES "news_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_item_tags" ADD CONSTRAINT "news_item_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_item_tickers" ADD CONSTRAINT "news_item_tickers_news_item_id_fkey" FOREIGN KEY ("news_item_id") REFERENCES "news_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_item_tickers" ADD CONSTRAINT "news_item_tickers_ticker_id_fkey" FOREIGN KEY ("ticker_id") REFERENCES "tickers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

