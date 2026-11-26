-- Soul DNA v5: the 7 games replace the long scenario quiz.
--  users.soul_version  which Soul DNA a person has (4 = the old quiz, 5 = the games). A v4 Soul DNA keeps working
--                      for matching until its owner plays the games; the app nudges them to play once.
ALTER TABLE users ADD soul_version TINYINT NULL;
GO
UPDATE users SET soul_version = 4 WHERE soul_ready = 1;
