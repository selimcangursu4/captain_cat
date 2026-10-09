-- Misafir hesaplar: e-posta ve şifre isteğe bağlı (hesap sonradan kaydedilebilir).
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
