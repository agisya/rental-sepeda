/**
 * Alamat rute yang dipakai lapisan otorisasi.
 *
 * Berdiri sendiri tanpa impor apa pun supaya bisa dipakai proxy.ts (runtime Edge),
 * Server Component, dan Route Handler sekaligus tanpa menyeret modul khusus Node.
 */

/**
 * Tempat mengirim pemegang cookie yang tanda tangannya sah tapi penggunanya sudah
 * tidak ada atau sudah dinonaktifkan.
 *
 * Harus berupa Route Handler, bukan halaman: cookie hanya boleh ditulis dari Server
 * Function atau Route Handler, sedangkan Server Component cuma boleh membacanya.
 * Karena itu halaman yang menemukan sesi basi tidak bisa membereskannya sendiri dan
 * harus menyerahkannya ke sini.
 *
 * Berawalan /api dengan sengaja: matcher pada proxy.ts mengecualikan awalan itu.
 * Kalau rute ini ikut dijaga proxy, ia sendiri akan dialihkan ke /dashboard karena
 * cookienya masih terlihat sah — dan putaran pengalihan yang hendak diputus justru
 * kembali utuh. test/sesi-habis.test.ts mengunci syarat itu.
 */
export const RUTE_SESI_HABIS = "/api/sesi-habis";
