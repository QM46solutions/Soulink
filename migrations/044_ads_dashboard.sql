-- Paid ads: the Soulink team runs each ad for a customer (owner_id), with a budget and a price per 1,000 views.
-- Spent = views × price ÷ 1,000 (never more than the budget); the ad stops showing once the budget is used.
-- The customer sees their own dashboard (spent, left, paid, views, people reached, clicks, day by day).
ALTER TABLE ad_campaigns ADD
  owner_id     UNIQUEIDENTIFIER NULL CONSTRAINT fk_ad_owner REFERENCES users(id),
  budget_paise INT NULL,
  cpm_paise    INT NULL,
  paid_paise   INT NOT NULL CONSTRAINT df_ad_paid DEFAULT 0,
  reach        INT NOT NULL CONSTRAINT df_ad_reach DEFAULT 0;
GO
CREATE INDEX ix_ads_owner ON ad_campaigns (owner_id);
GO
CREATE TABLE ad_daily (
  ad_id       UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_addaily_ad REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  day         DATE NOT NULL,
  impressions INT NOT NULL CONSTRAINT df_addaily_impr DEFAULT 0,
  clicks      INT NOT NULL CONSTRAINT df_addaily_clicks DEFAULT 0,
  CONSTRAINT pk_ad_daily PRIMARY KEY (ad_id, day)
);
GO
-- who has seen an ad (only to count people reached; never shown to anyone)
CREATE TABLE ad_viewers (
  ad_id   UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_adview_ad REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  user_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_adview_user REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT pk_ad_viewers PRIMARY KEY (ad_id, user_id)
);
GO
