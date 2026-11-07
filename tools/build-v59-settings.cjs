// Build the shared, dependency-free site settings layer from the retained v58 dictionary.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const locales={
 'zh-CN':'简体中文|设置|关闭|国内站|国际站|切换到国际站|切换到国内站|语言|字号|标准|大字|减少动画|软件下载|登录|注册|保存',
 'zh-TW':'繁體中文|設定|關閉|中國站|國際站|切換到國際站|切換到中國站|語言|字體大小|標準|大字|減少動畫|軟體下載|登入|註冊|儲存',
 en:'English|Settings|Close|China site|Global site|Go to global site|Go to China site|Language|Text size|Standard|Large|Reduce motion|Downloads|Sign in|Sign up|Save',
 ja:'日本語|設定|閉じる|中国サイト|国際サイト|国際サイトへ|中国サイトへ|言語|文字サイズ|標準|大きい|動きを減らす|ダウンロード|ログイン|登録|保存',
 ko:'한국어|설정|닫기|중국 사이트|국제 사이트|국제 사이트로|중국 사이트로|언어|글자 크기|기본|크게|동작 줄이기|다운로드|로그인|가입|저장',
 fr:'Français|Paramètres|Fermer|Site Chine|Site international|Site international|Site Chine|Langue|Taille du texte|Standard|Grande|Réduire les animations|Téléchargements|Connexion|Inscription|Enregistrer',
 de:'Deutsch|Einstellungen|Schließen|China-Seite|Internationale Seite|Zur internationalen Seite|Zur China-Seite|Sprache|Textgröße|Standard|Groß|Bewegung reduzieren|Downloads|Anmelden|Registrieren|Speichern',
 es:'Español|Ajustes|Cerrar|Sitio de China|Sitio internacional|Ir al sitio internacional|Ir al sitio de China|Idioma|Tamaño del texto|Normal|Grande|Reducir movimiento|Descargas|Iniciar sesión|Registrarse|Guardar',
 pt:'Português|Configurações|Fechar|Site da China|Site internacional|Ir ao site internacional|Ir ao site da China|Idioma|Tamanho do texto|Padrão|Grande|Reduzir movimento|Downloads|Entrar|Cadastrar-se|Salvar',
 it:'Italiano|Impostazioni|Chiudi|Sito cinese|Sito internazionale|Vai al sito internazionale|Vai al sito cinese|Lingua|Dimensione testo|Normale|Grande|Riduci animazioni|Download|Accedi|Registrati|Salva',
 ru:'Русский|Настройки|Закрыть|Китайский сайт|Международный сайт|На международный сайт|На китайский сайт|Язык|Размер текста|Обычный|Крупный|Уменьшить анимацию|Загрузки|Войти|Регистрация|Сохранить',
 uk:'Українська|Налаштування|Закрити|Китайський сайт|Міжнародний сайт|На міжнародний сайт|На китайський сайт|Мова|Розмір тексту|Звичайний|Великий|Зменшити анімацію|Завантаження|Увійти|Реєстрація|Зберегти',
 ar:'العربية|الإعدادات|إغلاق|موقع الصين|الموقع الدولي|إلى الموقع الدولي|إلى موقع الصين|اللغة|حجم النص|عادي|كبير|تقليل الحركة|التنزيلات|تسجيل الدخول|إنشاء حساب|حفظ',
 he:'עברית|הגדרות|סגירה|האתר הסיני|האתר הבינלאומי|לאתר הבינלאומי|לאתר הסיני|שפה|גודל טקסט|רגיל|גדול|הפחתת תנועה|הורדות|כניסה|הרשמה|שמירה',
 fa:'فارسی|تنظیمات|بستن|سایت چین|سایت بین‌المللی|رفتن به سایت بین‌المللی|رفتن به سایت چین|زبان|اندازه متن|عادی|بزرگ|کاهش حرکت|دانلودها|ورود|ثبت‌نام|ذخیره',
 ur:'اردو|ترتیبات|بند کریں|چین کی سائٹ|بین الاقوامی سائٹ|بین الاقوامی سائٹ پر جائیں|چین کی سائٹ پر جائیں|زبان|متن کا سائز|معیاری|بڑا|حرکت کم کریں|ڈاؤن لوڈ|لاگ ان|رجسٹر کریں|محفوظ کریں',
 hi:'हिन्दी|सेटिंग्स|बंद करें|चीन साइट|अंतरराष्ट्रीय साइट|अंतरराष्ट्रीय साइट पर जाएँ|चीन साइट पर जाएँ|भाषा|पाठ का आकार|सामान्य|बड़ा|गतिविधि कम करें|डाउनलोड|लॉग इन|पंजीकरण|सहेजें',
 bn:'বাংলা|সেটিংস|বন্ধ করুন|চীনের সাইট|আন্তর্জাতিক সাইট|আন্তর্জাতিক সাইটে যান|চীনের সাইটে যান|ভাষা|লেখার আকার|স্বাভাবিক|বড়|অ্যানিমেশন কমান|ডাউনলোড|লগ ইন|নিবন্ধন|সংরক্ষণ',
 ta:'தமிழ்|அமைப்புகள்|மூடு|சீனத் தளம்|சர்வதேசத் தளம்|சர்வதேசத் தளத்திற்குச் செல்|சீனத் தளத்திற்குச் செல்|மொழி|எழுத்து அளவு|இயல்பு|பெரியது|இயக்கத்தைக் குறை|பதிவிறக்கங்கள்|உள்நுழை|பதிவு செய்|சேமி',
 te:'తెలుగు|సెట్టింగ్‌లు|మూసివేయి|చైనా సైట్|అంతర్జాతీయ సైట్|అంతర్జాతీయ సైట్‌కు వెళ్లు|చైనా సైట్‌కు వెళ్లు|భాష|అక్షర పరిమాణం|సాధారణం|పెద్దది|కదలికను తగ్గించు|డౌన్‌లోడ్‌లు|లాగిన్|నమోదు|సేవ్',
 mr:'मराठी|सेटिंग्ज|बंद करा|चीन संकेतस्थळ|आंतरराष्ट्रीय संकेतस्थळ|आंतरराष्ट्रीय संकेतस्थळावर जा|चीन संकेतस्थळावर जा|भाषा|मजकुराचा आकार|सामान्य|मोठा|हालचाल कमी करा|डाउनलोड|लॉग इन|नोंदणी|जतन करा',
 id:'Bahasa Indonesia|Pengaturan|Tutup|Situs Tiongkok|Situs global|Ke situs global|Ke situs Tiongkok|Bahasa|Ukuran teks|Standar|Besar|Kurangi gerakan|Unduhan|Masuk|Daftar|Simpan',
 ms:'Bahasa Melayu|Tetapan|Tutup|Laman China|Laman antarabangsa|Ke laman antarabangsa|Ke laman China|Bahasa|Saiz teks|Biasa|Besar|Kurangkan gerakan|Muat turun|Log masuk|Daftar|Simpan',
 vi:'Tiếng Việt|Cài đặt|Đóng|Trang Trung Quốc|Trang quốc tế|Đến trang quốc tế|Đến trang Trung Quốc|Ngôn ngữ|Cỡ chữ|Tiêu chuẩn|Lớn|Giảm chuyển động|Tải xuống|Đăng nhập|Đăng ký|Lưu',
 th:'ไทย|การตั้งค่า|ปิด|เว็บไซต์จีน|เว็บไซต์สากล|ไปเว็บไซต์สากล|ไปเว็บไซต์จีน|ภาษา|ขนาดข้อความ|มาตรฐาน|ใหญ่|ลดการเคลื่อนไหว|ดาวน์โหลด|เข้าสู่ระบบ|สมัครสมาชิก|บันทึก',
 fil:'Filipino|Mga setting|Isara|Site ng China|Pandaigdigang site|Pumunta sa pandaigdigang site|Pumunta sa site ng China|Wika|Laki ng teksto|Karaniwan|Malaki|Bawasan ang galaw|Mga download|Mag-sign in|Magrehistro|I-save',
 tr:'Türkçe|Ayarlar|Kapat|Çin sitesi|Uluslararası site|Uluslararası siteye git|Çin sitesine git|Dil|Metin boyutu|Standart|Büyük|Hareketi azalt|İndirilenler|Giriş yap|Kaydol|Kaydet',
 nl:'Nederlands|Instellingen|Sluiten|Chinese site|Internationale site|Naar internationale site|Naar Chinese site|Taal|Tekstgrootte|Standaard|Groot|Beweging verminderen|Downloads|Inloggen|Registreren|Opslaan',
 pl:'Polski|Ustawienia|Zamknij|Strona chińska|Strona międzynarodowa|Do strony międzynarodowej|Do strony chińskiej|Język|Rozmiar tekstu|Standardowy|Duży|Ogranicz animacje|Pobieranie|Zaloguj się|Zarejestruj się|Zapisz',
 cs:'Čeština|Nastavení|Zavřít|Čínský web|Mezinárodní web|Na mezinárodní web|Na čínský web|Jazyk|Velikost textu|Běžná|Velká|Omezit pohyb|Stažení|Přihlásit se|Registrace|Uložit',
 sk:'Slovenčina|Nastavenia|Zavrieť|Čínska stránka|Medzinárodná stránka|Na medzinárodnú stránku|Na čínsku stránku|Jazyk|Veľkosť textu|Bežná|Veľká|Obmedziť pohyb|Stiahnutie|Prihlásiť sa|Registrácia|Uložiť',
 hu:'Magyar|Beállítások|Bezárás|Kínai oldal|Nemzetközi oldal|A nemzetközi oldalra|A kínai oldalra|Nyelv|Betűméret|Normál|Nagy|Mozgás csökkentése|Letöltések|Bejelentkezés|Regisztráció|Mentés',
 ro:'Română|Setări|Închide|Site chinezesc|Site internațional|La site-ul internațional|La site-ul chinezesc|Limbă|Mărimea textului|Standard|Mare|Reduce mișcarea|Descărcări|Autentificare|Înregistrare|Salvează',
 el:'Ελληνικά|Ρυθμίσεις|Κλείσιμο|Κινεζικός ιστότοπος|Διεθνής ιστότοπος|Στον διεθνή ιστότοπο|Στον κινεζικό ιστότοπο|Γλώσσα|Μέγεθος κειμένου|Κανονικό|Μεγάλο|Μείωση κίνησης|Λήψεις|Σύνδεση|Εγγραφή|Αποθήκευση',
 sv:'Svenska|Inställningar|Stäng|Kinesisk webbplats|Internationell webbplats|Till internationell webbplats|Till kinesisk webbplats|Språk|Textstorlek|Standard|Stor|Minska rörelse|Nedladdningar|Logga in|Registrera|Spara',
 da:'Dansk|Indstillinger|Luk|Kinesisk side|International side|Til international side|Til kinesisk side|Sprog|Tekststørrelse|Standard|Stor|Reducer bevægelse|Downloads|Log ind|Tilmeld|Gem',
 fi:'Suomi|Asetukset|Sulje|Kiinan sivusto|Kansainvälinen sivusto|Kansainväliselle sivustolle|Kiinan sivustolle|Kieli|Tekstin koko|Normaali|Suuri|Vähennä liikettä|Lataukset|Kirjaudu|Rekisteröidy|Tallenna',
 nb:'Norsk bokmål|Innstillinger|Lukk|Kinesisk nettsted|Internasjonalt nettsted|Til internasjonalt nettsted|Til kinesisk nettsted|Språk|Tekststørrelse|Standard|Stor|Reduser bevegelse|Nedlastinger|Logg inn|Registrer|Lagre',
 sw:'Kiswahili|Mipangilio|Funga|Tovuti ya China|Tovuti ya kimataifa|Nenda tovuti ya kimataifa|Nenda tovuti ya China|Lugha|Ukubwa wa maandishi|Kawaida|Kubwa|Punguza mwendo|Vipakuliwa|Ingia|Jisajili|Hifadhi',
 af:'Afrikaans|Instellings|Sluit|China-webwerf|Internasionale webwerf|Na internasionale webwerf|Na China-webwerf|Taal|Teksgrootte|Standaard|Groot|Verminder beweging|Aflaaie|Meld aan|Registreer|Stoor',
 ca:'Català|Configuració|Tanca|Lloc de la Xina|Lloc internacional|Ves al lloc internacional|Ves al lloc de la Xina|Llengua|Mida del text|Normal|Gran|Redueix el moviment|Baixades|Inicia sessió|Registra’t|Desa',
 bg:'Български|Настройки|Затвори|Китайски сайт|Международен сайт|Към международния сайт|Към китайския сайт|Език|Размер на текста|Стандартен|Голям|Намаляване на движението|Изтегляния|Вход|Регистрация|Запази',
 hr:'Hrvatski|Postavke|Zatvori|Kineska stranica|Međunarodna stranica|Na međunarodnu stranicu|Na kinesku stranicu|Jezik|Veličina teksta|Standardno|Veliko|Smanji kretanje|Preuzimanja|Prijava|Registracija|Spremi',
 sr:'Српски|Подешавања|Затвори|Кинески сајт|Међународни сајт|На међународни сајт|На кинески сајт|Језик|Величина текста|Стандардна|Велика|Смањи кретање|Преузимања|Пријава|Регистрација|Сачувај'
};
for(const [code,row] of Object.entries(locales))if(row.split('|').length!==16)throw Error(code+' has an incomplete dictionary');
let script=fs.readFileSync(path.join(root,'guest-v58/tripmate-regions.js'),'utf8');
script=script.replace("const languages = ['zh-CN', 'en', 'ja'];",`const localeRows = ${JSON.stringify(locales,null,2)};\n  const localeData = Object.fromEntries(Object.entries(localeRows).map(([code,row])=>[code,row.split('|')]));\n  const languages = Object.keys(localeData);\n  const fullLanguages = ['zh-CN','en','ja'];`);
script=script.replace("if (!languages.includes(language)) language = 'zh-CN';",`if (!languages.includes(language)) {\n    const candidate=(navigator.language||'').split('-')[0];\n    language=languages.includes(candidate)?candidate:'zh-CN';\n  }`);
script=script.replace('row[languages.indexOf(language)]',"row[fullLanguages.includes(language)?fullLanguages.indexOf(language):1]");
script=script.slice(0,script.indexOf('  const bar = document.createElement(\'nav\');'))+fs.readFileSync(path.join(root,'tools/v59-settings-ui.txt'),'utf8');
script+='\n})();\n';
fs.writeFileSync(path.join(root,'guest-v59/tripmate-regions.js'),script);
console.log('Built settings with '+languagesCount()+' language dictionaries');
function languagesCount(){return Object.keys(locales).length;}
