-- Scheduled reveal: a post goes up now but stays blurred for everyone else until reveal_at.
-- teaser_url: a tiny, heavily blurred copy of the first photo (or the video's cover) shown until then.
ALTER TABLE posts ADD reveal_at DATETIMEOFFSET NULL;
ALTER TABLE posts ADD teaser_url NVARCHAR(400) NULL;
