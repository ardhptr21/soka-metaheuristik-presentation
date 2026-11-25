# Task Scheduling dengan Metaheuristik

Presentasi HTML interaktif berbahasa Indonesia, 28 slide. Materi berdiri sendiri dan tidak mengacu pada program atau eksperimen yang sudah ada. Cocok untuk pemaparan sekitar 35–45 menit termasuk demonstrasi.

## Membuka presentasi

Buka `presentasi-task-scheduling.html` dengan Chrome, Edge, atau Firefox. File ini sudah memuat CSS, JavaScript, dan foto sehingga dapat berjalan tanpa internet. Tidak perlu instalasi, server, akun, atau koneksi ke layanan lain. Internet hanya diperlukan untuk membuka referensi.

Versi sumber dapat dibuka melalui `index.html` dengan semua file pendamping tetap berada dalam folder yang sama. Untuk membangun presentasi beserta aplikasi 3D, jalankan `npm install` sekali, lalu `npm run build` dari folder `presentation`.

## Laboratorium visualisasi 3D

Buka https://sma-ao.surge.sh/visualization/ atau gunakan tombol **Buka Visualisasi 3D** pada cover, slide SMA, AO, dan perbandingan. Halaman ini merupakan aplikasi terpisah berbahasa Indonesia, bukan slide. Tombol kembali di kiri atas menuju slide asal. Parameter aktif dari simulasi slide dibawa ke halaman baru; pencarian dimulai pada iterasi nol.

- Pilih SMA, AO, atau Perbandingan. Satu objek organik/elang mewakili satu kandidat jadwal lengkap.
- Tiga sumbu berasal dari tiga koordinat vektor yang dipilih. Ini proyeksi, bukan keseluruhan ruang solusi atau landscape fitness. Bentuk organisme adalah metafora.
- Warna tubuh yang lebih cerah berarti fitness lebih baik. Rentang numerik ditetapkan dari populasi awal dan tetap sepanjang eksperimen; SMA dan AO memakai rentang yang sama. Nilai di luar rentang menggunakan warna ujung legenda. Penanda emas menunjukkan posisi arsip terbaik. Pada AO, ujung sayap menunjukkan strategi X1–X4.
- Klik objek atau pilih kandidat pada inspector. Periksa posisi awal, proposal mentah, hasil clip, posisi akhir, koefisien, substitusi angka, fitness, dan assignment VM.
- SMA memperlihatkan garis pengaruh best/A/B jika cabang mendekat aktif pada koordinat yang terlihat. AO memperlihatkan proposal yang ditolak secara transparan; nilai proposal dan alasan penolakannya tersedia di inspector.
- Gunakan Jalankan/Jeda, Satu Iterasi, Ulangi, kecepatan 0,25–4×, dan slider riwayat. Mengulang snapshot tidak mengubah RNG atau menghitung evaluasi baru. Jika playback mencapai riwayat terbaru, pencarian berlanjut hingga T.
- Tombol **Mode Fokus** atau tombol **F** menyembunyikan header, parameter, inspector, metrik, dan grafik agar visualisasi memenuhi layar. Kontrol playback tetap tersedia. Tekan **Esc**, **F**, atau **Tampilkan Panel** untuk kembali tanpa mengulang simulasi. Klik objek dalam Mode Fokus tidak membuka inspector secara otomatis.
- Tombol **＋ / − / Paskan** di area visualisasi mengatur pembesaran dan membingkai seluruh ruang pencarian sesuai ukuran viewport. Label sumbu dan arsip menggunakan tekstur teks yang dipaskan agar lebih terbaca.
- **Mode Belajar** menguraikan satu pembaruan kandidat menjadi lima tahap: posisi awal, aturan pembaruan, proposal mentah, clip & evaluasi, lalu keputusan. Jika dibuka pada iterasi nol, satu iterasi dicatat terlebih dahulu. Berpindah tahap hanya membaca catatan tersebut; tidak mengambil angka acak atau menambah evaluasi pencarian. Setelah tahap keputusan, **Iterasi berikutnya** membaca riwayat berikutnya atau menghitung satu iterasi baru bila diperlukan.
- Setiap tahap juga ditandai langsung pada kanvas: awal biru, masukan rumus dengan garis putus-putus, proposal mentah jingga, hasil clip ungu, serta keputusan hijau/merah muda. Angka koordinat awal dan hasil tahap tampil di bagian bawah kanvas. Penanda tambahan memakai warna peran; warna tubuh kandidat tetap menunjukkan fitness. Kamera otomatis mengambil sudut samping perpindahan untuk menghindari posisi yang tampak bertumpuk akibat perspektif. Gunakan **Fokus langkah** setelah memutar kamera, atau **Paskan** untuk melihat ruang keseluruhan. Keluar dari Mode Belajar mengembalikan kamera sebelumnya.
- Panah menunjukkan hubungan koordinat yang tercatat, bukan subiterasi pencarian tambahan. Untuk proposal mentah yang sangat jauh, objek proposal tetap berada pada koordinat sebenarnya dan panah arah dipendekkan dengan label **ARAH MENTAH** atau **DARI LUAR BATAS**. Jika mentah/clip atau awal/akhir berimpit dalam proyeksi, aplikasi menjelaskannya; perubahan visual tidak dibuat-buat.
- Kandidat terpilih diisolasi secara visual selama Mode Belajar. Opsi **Isolasi kandidat terpilih** juga tersedia untuk penggunaan biasa. Kandidat lain diredupkan tanpa menggeser koordinat. Klik titik yang bertumpuk membuka daftar kandidat agar semuanya dapat dipilih.
- **Batas VM** menampilkan bidang pada k/m untuk ketiga koordinat yang terlihat. Mode Belajar mengaktifkannya otomatis. Indeks decoder adalah 0 sampai m−1, sedangkan label UI menampilkan VM 1 sampai m. Proposal mentah di luar kubus memakai posisi mentah sebenarnya dan penanda pada batas clip agar arahnya tetap dapat ditemukan.
- Jadwal kandidat menyorot tugas yang berpindah VM. Garis putus-putus menunjukkan jadwal awal, disertai perubahan makespan dan biaya. Tahap clip menampilkan pratinjau proposal; tahap keputusan menampilkan jadwal yang benar-benar diterapkan. Perpindahan dari proposal AO yang ditolak ditandai dibatalkan.
- Klik kandidat dalam Mode Fokus membuka kartu ringkas yang dapat ditutup, berisi strategi, perubahan fitness, keputusan, dan perpindahan tugas. Tombol **Pelajari langkah** membuka Mode Belajar tanpa perlu menampilkan seluruh panel.
- Kedua algoritma dihitung sinkron walaupun hanya satu yang terlihat, dengan populasi awal dan workload yang sama. Kamera kedua viewport perbandingan tersinkron.
- Seed workload dan seed pencarian terpisah, keduanya default 42. Perubahan parameter baru aktif setelah **Terapkan & Ulangi**. Tombol Bagikan menyalin URL konfigurasi, tanpa riwayat pencarian.
- WebGL2 diperlukan untuk 3D. Jika tidak tersedia atau konteks grafis hilang, aplikasi beralih ke proyeksi 2D X/Y; seluruh kontrol serta perhitungan tetap berjalan. Mode 2D juga bisa dipilih manual.
- Pada ponsel, parameter dan inspector menjadi drawer, sedangkan perbandingan tersusun vertikal. Preferensi reduced motion menonaktifkan interpolasi dan gerakan sayap.

`engine.js` menambahkan opsi `captureDetails`, default `false`. Mode ini hanya mencatat nilai yang sudah dihitung, tanpa menambah sampel acak atau evaluasi. Snapshot tambahan berisi posisi lengkap, ID, assignment, posisi arsip, dan detail proposal setiap kandidat. Hasil optimizer lama tetap identik pada 18 skenario acuan.

UI memakai Three.js 0.187.0 dan Vite 8.3.6, dikunci dalam package-lock. Tidak ada CDN atau backend saat runtime. Build menghasilkan `deploy/index.html` untuk presentasi dan `deploy/visualization/` untuk aplikasi. CNAME tetap `sma-ao.surge.sh`. Untuk pengembangan UI jalankan `npm run dev`. Untuk memeriksa seluruh situs hasil build, jalankan `node qa/serve.cjs`, lalu buka http://127.0.0.1:4173/ . Halaman 3D membutuhkan HTTP/HTTPS dan tidak dibuka langsung melalui file://. Presentasi HTML mandiri tetap dapat digunakan offline; tombol 3D dari file mandiri membuka situs publik.

Pengujian: `npm test` memeriksa evaluator dan detail pencatatan. Dengan preview berjalan, `node qa/visualization-check.cjs` memeriksa posisi 3D, klik objek, kontrol, perbandingan, riwayat, parameter maksimum, URL, navigasi presentasi, ponsel, kehilangan konteks grafis, dan fallback 2D. `node qa/focus-mode.cjs` memeriksa area fokus, kamera, dan playback. `node qa/education-check.cjs` memeriksa lima tahap pembelajaran, proposal dan keputusan, perpindahan VM, skala warna tetap, pemilihan objek bertumpuk, isolasi tanpa perubahan koordinat, kartu ringkas, ponsel, dan pembelajaran 2D. Browser QA membutuhkan dependensi Playwright pada folder `qa`.

## Kendali

- Panah kiri/kanan, Page Up/Page Down, atau spasi: pindah slide.
- Home/End: slide pertama/terakhir.
- O: daftar slide. N: catatan pembicara. F: layar penuh.
- B: layar gelap sementara. Esc: menutup panel atau layar gelap.
- Tombol `?`: panduan, mode baca, dan cetak.
- Pada layar sentuh, geser kiri/kanan di daerah noninteraktif.
- Rasio desain 16:9, otomatis menyesuaikan ukuran jendela. Untuk teks besar di ponsel, gunakan orientasi lanskap dan layar penuh. Mode baca menggunakan kanvas 1600 px dan dapat digulir.

## Interaksi dalam materi

1. Perbandingan Gantt penempatan satu VM, Round Robin, dan EFT.
2. Penghitung ruang pencarian m^n.
3. Tahapan metaheuristik yang dapat dipilih.
4. Slider posisi kontinu setiap tugas dengan decoder langsung ke VM.
5. Slider bobot waktu/biaya dan evaluasi empat kandidat.
6. Laboratorium SMA dan AO: parameter, +1 iterasi, putar/jeda, selesaikan, serta ulangi seed.
7. Perbandingan dua algoritma dengan populasi awal dan anggaran identik.
8. Eksperimen 20 seed pencarian pada satu workload tetap, statistik, dan ekspor CSV.
9. Enumerasi eksak 729 penempatan untuk enam tugas dan tiga VM.
10. Kuis tiga pertanyaan dengan umpan balik dan skor.

Parameter yang diubah baru aktif setelah `Terapkan` ditekan. `Ulangi seed` mengulang parameter aktif. Animasi berhenti ketika pindah slide atau membuka panel. Data tidak dikirim keluar browser.

## Model dan fungsi objektif

- Semua tugas independen dan tiba pada waktu nol.
- Setiap VM mengeksekusi satu tugas pada satu waktu, tanpa preemption.
- Urutan tugas di setiap VM mengikuti ID input. Variabel optimasi hanya penempatan.
- Panjang tugas dalam MI, kecepatan VM dalam MIPS, durasi = panjang/kecepatan.
- Makespan adalah maksimum total waktu sibuk VM.
- Biaya adalah total durasi eksekusi dikali tarif aktif VM. Unit biaya (UB) bersifat sintetis. Tidak ada biaya idle atau pembulatan tagihan.
- RAM, jaringan, core tambahan, deadline, overhead, dan dependency tidak dimodelkan.
- Fitness = w × makespan/makespan_RR + (1−w) × biaya/biaya_RR. RR dihitung dari workload yang sama dan tidak berubah selama pencarian. Semakin kecil semakin baik.
- Utilisasi yang ditampilkan = jumlah durasi seluruh tugas / (jumlah VM × makespan), yaitu rerata utilisasi waktu VM dalam model ini.

VM sintetis:

| VM | MIPS | Tarif UB/detik |
|---|---:|---:|
| 1 | 1000 | 0.010 |
| 2 | 1600 | 0.022 |
| 3 | 2400 | 0.048 |
| 4 | 3200 | 0.080 |

## Pilihan implementasi algoritma

Ini adaptasi pendidikan berbasis persamaan SMA dan AO untuk scheduling diskret. Ini bukan replikasi benchmark paper dan bukan klaim bahwa paper asli menggunakan decoder atau evaluator ini.

**Representasi:** individu adalah vektor D bilangan real pada [0,1]. Setelah posisi baru dihitung, nilai dipotong (clip) ke batas lalu didecode menggunakan min(m−1, floor(m×x)). Semua tugas feasible pada seluruh VM. Perubahan real di dalam satu interval tidak mengubah assignment.

**Inisialisasi:** vektor disampel seragam. SMA dan AO memakai populasi awal persis sama untuk seed yang sama. Aliran acak pembaruan dipisahkan dengan seed turunan. Generator deterministik Mulberry32 digunakan untuk reproduksibilitas.

**SMA:** t=1…T, z=0.03. Pilihan restart berlaku per individu, kemudian cabang mendekat/kontraksi berlaku per dimensi. W menggunakan peringkat fitness populasi, log basis 10, dan sampel per dimensi. p=tanh(abs(f_i−f_best)); a=atanh(1−t/T), b=1−t/T, vb~U(−a,a), vc~U(−b,b). Jika seluruh fitness sama, rasio bobot ditetapkan nol. Pembaruan sinkron memakai snapshot populasi lama. Individu menerima posisi baru tanpa seleksi greedy; arsip terbaik sepanjang pencarian disimpan terpisah. A dan B dipilih dengan pengembalian dari populasi.

**AO:** empat persamaan mengikuti paper [3], Pers. 3, 5, 13, 14. Mean adalah rata-rata populasi per dimensi, bukan rata-rata seluruh dimensi satu individu. Pada t/T≤2/3, pilih X1 atau X2 dengan peluang 50:50. Setelahnya, pilih X3 atau X4. Proposal diterima jika lebih baik daripada individu sebelumnya. α=δ=0.1, G1=2r−1, G2=2(1−t/T), QF=t^((2r−1)/(1−T)^2). Spiral: radius=r1+0.00565d, sudut=−0.005d+3π/2, x=radius sin(sudut), y=radius cos(sudut), r1 integer acak 1…20 per iterasi. G1, G2, dan QF dibentuk per iterasi. Pemilihan strategi berlaku per individu, bilangan acak lain disampel per dimensi.

**Lévy:** demo menggunakan Mantegna dengan Gaussian normal, beta=1.5, sigma≈0.6965745026, skala 0.01, dan pengaman pembagi 1e−12. Ini pilihan implementasi eksplisit; uraian distribusi u/v dalam naskah dan implementasi pendamping dapat berbeda. Pembatasan [0,1] dapat memotong banyak lompatan spiral/Lévy. Dampaknya terhadap decoder dibahas dalam presentasi.

**Evaluasi:** seluruh proposal selalu dievaluasi. Total N(T+1) evaluasi per algoritma, termasuk populasi awal. Arsip best-so-far menjamin kurva terbaik tidak naik, bukan menjamin optimum. Hasil dihitung dari nol di browser, tanpa angka kemenangan atau konvergensi yang ditanam sebelumnya.

**Batch 20 seed:** workload tetap memakai seed aktif dari slide perbandingan. Seed pencarian berjalan dari seed tersebut hingga seed+19. Dengan demikian, variasi tidak mencampurkan perubahan workload. Populasi awal setiap pasangan identik. Statistik melaporkan rerata, SD sampel, median, min, max. Sama berarti selisih absolut fitness <1e−10. Ini deskriptif tanpa uji signifikansi. CSV berisi parameter, fitness, makespan, biaya, jumlah evaluasi, dan assignment untuk kedua algoritma pada setiap seed.

**Pembanding:** Round Robin mengikuti ID tugas; EFT menempatkan tugas berikutnya pada VM dengan prediksi waktu selesai paling kecil, tie memilih indeks pertama. Enumerasi eksak menguji seluruh penempatan untuk enam tugas pada model yang sama. Angka output dapat berbeda jika model, decoder, atau implementasi acak diubah.

## Referensi utama

1. Li, S., Chen, H., Wang, M., Heidari, A. A., & Mirjalili, S. (2020). Slime mould algorithm: A new method for stochastic optimization. Future Generation Computer Systems, 111, 300–323. https://doi.org/10.1016/j.future.2020.03.055
2. Halaman penulis SMA: https://aliasgharheidari.com/SMA.html
3. Abualigah, L., Yousri, D., Abd Elaziz, M., Ewees, A. A., Al-qaness, M. A. A., & Gandomi, A. H. (2021). Aquila Optimizer: A novel meta-heuristic optimization algorithm. Computers & Industrial Engineering, 157, 107250. https://doi.org/10.1016/j.cie.2021.107250
4. Kode pendamping AO oleh Laith Abualigah, versi 1.0.0, 26 Maret 2021: https://www.mathworks.com/matlabcentral/fileexchange/89381-aquila-optimizer-a-meta-heuristic-optimization-algorithm

## Atribusi foto

- Physarum polycephalum plasmodium, frankenstoen, 18 Juni 2011. Sumber: https://commons.wikimedia.org/wiki/File:Physarum_polycephalum_plasmodium.jpg . Lisensi CC BY 2.5: https://creativecommons.org/licenses/by/2.5/ . File foto asli tidak disunting; tampilannya dipotong dan saturasinya dikurangi melalui CSS.
- Golden Eagle in flight - 5, Tony Hisgett, 7 Agustus 2011. Sumber: https://commons.wikimedia.org/wiki/File:Golden_Eagle_in_flight_-_5.jpg . Lisensi CC BY 2.0: https://creativecommons.org/licenses/by/2.0/ . File foto asli tidak disunting; tampilannya dipotong dan saturasinya dikurangi melalui CSS.

## Tim

- Ardhi Putra Pradana - 5027241022
- Aditya Reza Daffansyah - 5027241034
- Ica Zika Hamizah - 5027241058
- Oryza Qiara Ramadhani - 5027241084
- Erlinda Annisa Azzahra - 5027241108

## Struktur sumber

- `index.html`: seluruh isi slide.
- `style.css`: tata letak, tema, mode baca, dan cetak.
- `engine.js`: evaluator, decoder, algoritma, serta enumerasi eksak.
- `app.js`: navigasi, visualisasi, interaksi, dan catatan pembicara.
- `assets/`: foto beserta atribusi di atas.
- `build.mjs`: membuat HTML mandiri tanpa dependensi paket.

Semua sumber dapat diedit dengan editor teks. Grafik dan Gantt merupakan visualisasi data hasil perhitungan, bukan ilustrasi gerak biologis.
