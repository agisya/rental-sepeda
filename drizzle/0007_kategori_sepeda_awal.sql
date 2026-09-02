INSERT INTO "categories" ("nama", "satuan", "toleransi_telat_menit", "batas_berjalan_satuan", "urutan")
SELECT 'Sepeda', 'jam', "toleransi_telat_menit", "batas_jam_rental", 0
FROM "settings" WHERE "id" = 1
ON CONFLICT ("nama") DO NOTHING;
