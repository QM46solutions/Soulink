-- How often an ad shows between organic posts / Sparks: after every N of them (chosen when the ad is booked in
-- the team console). NULL = the screen's usual spacing (older ads).
ALTER TABLE ad_campaigns ADD every_n INT NULL CONSTRAINT ck_ad_every CHECK (every_n IS NULL OR every_n BETWEEN 2 AND 50);
GO
