(() => {
  'use strict';
  const hosts = { domestic: 'https://111.230.133.155', overseas: 'https://tripmate-travel-planner.xuantingjiang39.chatgpt.site' };
  const localeRows = {
  "zh-CN": "简体中文|设置|关闭|国内站|国际站|切换到国际站|切换到国内站|语言|字号|标准|大字|减少动画|软件下载|登录|注册|保存",
  "zh-TW": "繁體中文|設定|關閉|中國站|國際站|切換到國際站|切換到中國站|語言|字體大小|標準|大字|減少動畫|軟體下載|登入|註冊|儲存",
  "en": "English|Settings|Close|China site|Global site|Go to global site|Go to China site|Language|Text size|Standard|Large|Reduce motion|Downloads|Sign in|Sign up|Save",
  "ja": "日本語|設定|閉じる|中国サイト|国際サイト|国際サイトへ|中国サイトへ|言語|文字サイズ|標準|大きい|動きを減らす|ダウンロード|ログイン|登録|保存",
  "ko": "한국어|설정|닫기|중국 사이트|국제 사이트|국제 사이트로|중국 사이트로|언어|글자 크기|기본|크게|동작 줄이기|다운로드|로그인|가입|저장",
  "fr": "Français|Paramètres|Fermer|Site Chine|Site international|Site international|Site Chine|Langue|Taille du texte|Standard|Grande|Réduire les animations|Téléchargements|Connexion|Inscription|Enregistrer",
  "de": "Deutsch|Einstellungen|Schließen|China-Seite|Internationale Seite|Zur internationalen Seite|Zur China-Seite|Sprache|Textgröße|Standard|Groß|Bewegung reduzieren|Downloads|Anmelden|Registrieren|Speichern",
  "es": "Español|Ajustes|Cerrar|Sitio de China|Sitio internacional|Ir al sitio internacional|Ir al sitio de China|Idioma|Tamaño del texto|Normal|Grande|Reducir movimiento|Descargas|Iniciar sesión|Registrarse|Guardar",
  "pt": "Português|Configurações|Fechar|Site da China|Site internacional|Ir ao site internacional|Ir ao site da China|Idioma|Tamanho do texto|Padrão|Grande|Reduzir movimento|Downloads|Entrar|Cadastrar-se|Salvar",
  "it": "Italiano|Impostazioni|Chiudi|Sito cinese|Sito internazionale|Vai al sito internazionale|Vai al sito cinese|Lingua|Dimensione testo|Normale|Grande|Riduci animazioni|Download|Accedi|Registrati|Salva",
  "ru": "Русский|Настройки|Закрыть|Китайский сайт|Международный сайт|На международный сайт|На китайский сайт|Язык|Размер текста|Обычный|Крупный|Уменьшить анимацию|Загрузки|Войти|Регистрация|Сохранить",
  "uk": "Українська|Налаштування|Закрити|Китайський сайт|Міжнародний сайт|На міжнародний сайт|На китайський сайт|Мова|Розмір тексту|Звичайний|Великий|Зменшити анімацію|Завантаження|Увійти|Реєстрація|Зберегти",
  "ar": "العربية|الإعدادات|إغلاق|موقع الصين|الموقع الدولي|إلى الموقع الدولي|إلى موقع الصين|اللغة|حجم النص|عادي|كبير|تقليل الحركة|التنزيلات|تسجيل الدخول|إنشاء حساب|حفظ",
  "he": "עברית|הגדרות|סגירה|האתר הסיני|האתר הבינלאומי|לאתר הבינלאומי|לאתר הסיני|שפה|גודל טקסט|רגיל|גדול|הפחתת תנועה|הורדות|כניסה|הרשמה|שמירה",
  "fa": "فارسی|تنظیمات|بستن|سایت چین|سایت بین‌المللی|رفتن به سایت بین‌المللی|رفتن به سایت چین|زبان|اندازه متن|عادی|بزرگ|کاهش حرکت|دانلودها|ورود|ثبت‌نام|ذخیره",
  "ur": "اردو|ترتیبات|بند کریں|چین کی سائٹ|بین الاقوامی سائٹ|بین الاقوامی سائٹ پر جائیں|چین کی سائٹ پر جائیں|زبان|متن کا سائز|معیاری|بڑا|حرکت کم کریں|ڈاؤن لوڈ|لاگ ان|رجسٹر کریں|محفوظ کریں",
  "hi": "हिन्दी|सेटिंग्स|बंद करें|चीन साइट|अंतरराष्ट्रीय साइट|अंतरराष्ट्रीय साइट पर जाएँ|चीन साइट पर जाएँ|भाषा|पाठ का आकार|सामान्य|बड़ा|गतिविधि कम करें|डाउनलोड|लॉग इन|पंजीकरण|सहेजें",
  "bn": "বাংলা|সেটিংস|বন্ধ করুন|চীনের সাইট|আন্তর্জাতিক সাইট|আন্তর্জাতিক সাইটে যান|চীনের সাইটে যান|ভাষা|লেখার আকার|স্বাভাবিক|বড়|অ্যানিমেশন কমান|ডাউনলোড|লগ ইন|নিবন্ধন|সংরক্ষণ",
  "ta": "தமிழ்|அமைப்புகள்|மூடு|சீனத் தளம்|சர்வதேசத் தளம்|சர்வதேசத் தளத்திற்குச் செல்|சீனத் தளத்திற்குச் செல்|மொழி|எழுத்து அளவு|இயல்பு|பெரியது|இயக்கத்தைக் குறை|பதிவிறக்கங்கள்|உள்நுழை|பதிவு செய்|சேமி",
  "te": "తెలుగు|సెట్టింగ్‌లు|మూసివేయి|చైనా సైట్|అంతర్జాతీయ సైట్|అంతర్జాతీయ సైట్‌కు వెళ్లు|చైనా సైట్‌కు వెళ్లు|భాష|అక్షర పరిమాణం|సాధారణం|పెద్దది|కదలికను తగ్గించు|డౌన్‌లోడ్‌లు|లాగిన్|నమోదు|సేవ్",
  "mr": "मराठी|सेटिंग्ज|बंद करा|चीन संकेतस्थळ|आंतरराष्ट्रीय संकेतस्थळ|आंतरराष्ट्रीय संकेतस्थळावर जा|चीन संकेतस्थळावर जा|भाषा|मजकुराचा आकार|सामान्य|मोठा|हालचाल कमी करा|डाउनलोड|लॉग इन|नोंदणी|जतन करा",
  "id": "Bahasa Indonesia|Pengaturan|Tutup|Situs Tiongkok|Situs global|Ke situs global|Ke situs Tiongkok|Bahasa|Ukuran teks|Standar|Besar|Kurangi gerakan|Unduhan|Masuk|Daftar|Simpan",
  "ms": "Bahasa Melayu|Tetapan|Tutup|Laman China|Laman antarabangsa|Ke laman antarabangsa|Ke laman China|Bahasa|Saiz teks|Biasa|Besar|Kurangkan gerakan|Muat turun|Log masuk|Daftar|Simpan",
  "vi": "Tiếng Việt|Cài đặt|Đóng|Trang Trung Quốc|Trang quốc tế|Đến trang quốc tế|Đến trang Trung Quốc|Ngôn ngữ|Cỡ chữ|Tiêu chuẩn|Lớn|Giảm chuyển động|Tải xuống|Đăng nhập|Đăng ký|Lưu",
  "th": "ไทย|การตั้งค่า|ปิด|เว็บไซต์จีน|เว็บไซต์สากล|ไปเว็บไซต์สากล|ไปเว็บไซต์จีน|ภาษา|ขนาดข้อความ|มาตรฐาน|ใหญ่|ลดการเคลื่อนไหว|ดาวน์โหลด|เข้าสู่ระบบ|สมัครสมาชิก|บันทึก",
  "fil": "Filipino|Mga setting|Isara|Site ng China|Pandaigdigang site|Pumunta sa pandaigdigang site|Pumunta sa site ng China|Wika|Laki ng teksto|Karaniwan|Malaki|Bawasan ang galaw|Mga download|Mag-sign in|Magrehistro|I-save",
  "tr": "Türkçe|Ayarlar|Kapat|Çin sitesi|Uluslararası site|Uluslararası siteye git|Çin sitesine git|Dil|Metin boyutu|Standart|Büyük|Hareketi azalt|İndirilenler|Giriş yap|Kaydol|Kaydet",
  "nl": "Nederlands|Instellingen|Sluiten|Chinese site|Internationale site|Naar internationale site|Naar Chinese site|Taal|Tekstgrootte|Standaard|Groot|Beweging verminderen|Downloads|Inloggen|Registreren|Opslaan",
  "pl": "Polski|Ustawienia|Zamknij|Strona chińska|Strona międzynarodowa|Do strony międzynarodowej|Do strony chińskiej|Język|Rozmiar tekstu|Standardowy|Duży|Ogranicz animacje|Pobieranie|Zaloguj się|Zarejestruj się|Zapisz",
  "cs": "Čeština|Nastavení|Zavřít|Čínský web|Mezinárodní web|Na mezinárodní web|Na čínský web|Jazyk|Velikost textu|Běžná|Velká|Omezit pohyb|Stažení|Přihlásit se|Registrace|Uložit",
  "sk": "Slovenčina|Nastavenia|Zavrieť|Čínska stránka|Medzinárodná stránka|Na medzinárodnú stránku|Na čínsku stránku|Jazyk|Veľkosť textu|Bežná|Veľká|Obmedziť pohyb|Stiahnutie|Prihlásiť sa|Registrácia|Uložiť",
  "hu": "Magyar|Beállítások|Bezárás|Kínai oldal|Nemzetközi oldal|A nemzetközi oldalra|A kínai oldalra|Nyelv|Betűméret|Normál|Nagy|Mozgás csökkentése|Letöltések|Bejelentkezés|Regisztráció|Mentés",
  "ro": "Română|Setări|Închide|Site chinezesc|Site internațional|La site-ul internațional|La site-ul chinezesc|Limbă|Mărimea textului|Standard|Mare|Reduce mișcarea|Descărcări|Autentificare|Înregistrare|Salvează",
  "el": "Ελληνικά|Ρυθμίσεις|Κλείσιμο|Κινεζικός ιστότοπος|Διεθνής ιστότοπος|Στον διεθνή ιστότοπο|Στον κινεζικό ιστότοπο|Γλώσσα|Μέγεθος κειμένου|Κανονικό|Μεγάλο|Μείωση κίνησης|Λήψεις|Σύνδεση|Εγγραφή|Αποθήκευση",
  "sv": "Svenska|Inställningar|Stäng|Kinesisk webbplats|Internationell webbplats|Till internationell webbplats|Till kinesisk webbplats|Språk|Textstorlek|Standard|Stor|Minska rörelse|Nedladdningar|Logga in|Registrera|Spara",
  "da": "Dansk|Indstillinger|Luk|Kinesisk side|International side|Til international side|Til kinesisk side|Sprog|Tekststørrelse|Standard|Stor|Reducer bevægelse|Downloads|Log ind|Tilmeld|Gem",
  "fi": "Suomi|Asetukset|Sulje|Kiinan sivusto|Kansainvälinen sivusto|Kansainväliselle sivustolle|Kiinan sivustolle|Kieli|Tekstin koko|Normaali|Suuri|Vähennä liikettä|Lataukset|Kirjaudu|Rekisteröidy|Tallenna",
  "nb": "Norsk bokmål|Innstillinger|Lukk|Kinesisk nettsted|Internasjonalt nettsted|Til internasjonalt nettsted|Til kinesisk nettsted|Språk|Tekststørrelse|Standard|Stor|Reduser bevegelse|Nedlastinger|Logg inn|Registrer|Lagre",
  "sw": "Kiswahili|Mipangilio|Funga|Tovuti ya China|Tovuti ya kimataifa|Nenda tovuti ya kimataifa|Nenda tovuti ya China|Lugha|Ukubwa wa maandishi|Kawaida|Kubwa|Punguza mwendo|Vipakuliwa|Ingia|Jisajili|Hifadhi",
  "af": "Afrikaans|Instellings|Sluit|China-webwerf|Internasionale webwerf|Na internasionale webwerf|Na China-webwerf|Taal|Teksgrootte|Standaard|Groot|Verminder beweging|Aflaaie|Meld aan|Registreer|Stoor",
  "ca": "Català|Configuració|Tanca|Lloc de la Xina|Lloc internacional|Ves al lloc internacional|Ves al lloc de la Xina|Llengua|Mida del text|Normal|Gran|Redueix el moviment|Baixades|Inicia sessió|Registra’t|Desa",
  "bg": "Български|Настройки|Затвори|Китайски сайт|Международен сайт|Към международния сайт|Към китайския сайт|Език|Размер на текста|Стандартен|Голям|Намаляване на движението|Изтегляния|Вход|Регистрация|Запази",
  "hr": "Hrvatski|Postavke|Zatvori|Kineska stranica|Međunarodna stranica|Na međunarodnu stranicu|Na kinesku stranicu|Jezik|Veličina teksta|Standardno|Veliko|Smanji kretanje|Preuzimanja|Prijava|Registracija|Spremi",
  "sr": "Српски|Подешавања|Затвори|Кинески сајт|Међународни сајт|На међународни сајт|На кинески сајт|Језик|Величина текста|Стандардна|Велика|Смањи кретање|Преузимања|Пријава|Регистрација|Сачувај"
};
  const localeData = Object.fromEntries(Object.entries(localeRows).map(([code,row])=>[code,row.split('|')]));
  const languages = Object.keys(localeData);
  const fullLanguages = ['zh-CN','en','ja'];
  const region = document.documentElement.dataset.tripmateRegion === 'overseas' ? 'overseas' : 'domestic';
  const pairs = [
    ['进入你的旅行空间','Your travel workspace','あなたの旅行ワークスペース'],
    ['登录后，行程与提醒会安全地同步到你的其他设备。','Sign in to sync your trips and reminders across your devices.','ログインして旅程とリマインダーを他の端末と同期します。'],
    ['不需要 ChatGPT 账号。注册申请由管理员审核，审核通过后才能登录和使用 AI。','No ChatGPT account is required. An administrator reviews sign-up requests before sign-in and AI access.','ChatGPT アカウントは不要です。登録申請の管理者承認後にログインと AI を利用できます。'],
    ['密码（至少 10 位）','Password (at least 10 characters)','パスワード（10 文字以上）'],['再次输入密码','Confirm password','パスワードを再入力'],['提交注册申请','Request an account','登録を申請'],
    ['邮箱只作为登录账号；注册后需等待管理员批准。','Your email is your sign-in ID. Please wait for administrator approval after applying.','メールアドレスをログインに使用します。申請後は管理者の承認をお待ちください。'],
    ['等待登录','Waiting for sign-in','ログイン待ち'],['账号审核','Account approvals','登録申請の審査'],
    ['写下目的地、天数、同行人和预算，规划每天的路线、住宿与花费。','Enter your destination, dates, travelers and budget to plan each day.','目的地、日数、同行者、予算を入力して毎日の予定を作成します。'],
    ['等待生成专属行程','Ready to plan your trip','旅程の作成を待っています'],['已为你准备好一份示例攻略。','An example itinerary is shown below.','下にサンプル旅程を表示しています。'],
    ['旅行总览','Trip overview','旅行の概要'],['每日行程','Daily itinerary','毎日の旅程'],['交通路线','Routes','交通ルート'],['酒店餐厅','Hotels & restaurants','ホテル・レストラン'],['预算清单','Budget details','予算の内訳'],
    ['行程天数','Trip length','旅行日数'],['交通分段','Transport legs','移動区間'],['等待生成','Not generated yet','未生成'],['总预算','Total budget','総予算'],['生成状态','Plan status','作成状況'],['示例攻略','Example itinerary','サンプル旅程'],
    ['编辑全部内容','Edit itinerary','旅程を編集'],['保存当前攻略','Save this itinerary','この旅程を保存'],['下载 PDF（表格版）','Download PDF','PDF をダウンロード'],['打开旅行工具','Open travel tools','旅行ツールを開く'],['复制给家人','Copy for family','家族用にコピー'],
    ['上一天','Previous day','前日'],['下一天','Next day','翌日'],['AI 已优化','AI draft','AI の下書き'],['出发前注意','Before you leave','出発前の確認'],
    ['预算预估','Estimated budget','概算予算'],['交通','Transport','交通'],['住宿','Accommodation','宿泊'],['餐饮与门票','Food & admission','食事・入場料'],['总计','Total','合計'],
    ['在哪里买票','Booking channels','予約先'],['火车 / 高铁','Train / high-speed rail','鉄道 / 高速鉄道'],['飞机票','Flights','航空券'],['酒店','Hotels','ホテル'],['景点门票','Admission tickets','入場券'],['出发清单','Packing checklist','出発チェックリスト'],
    ['问问旅伴 AI','Ask TripMate AI','TripMate AI に相談'],['再轻松一点','Make it more relaxed','もっとゆったり'],['适合长辈的餐厅','Restaurants for older travelers','年配の方に合う食事'],['购票与预约','Tickets & reservations','チケット・予約'],
    ['今日出行助手','Today’s travel assistant','今日の旅行アシスタント'],['选择行程日','Choose a day','日付を選択'],['今天的时间线','Today’s itinerary','今日の日程'],['今天的交通','Today’s transport','今日の交通'],
    ['从当前攻略导入','Import from itinerary','旅程から取り込む'],['添加订单','Add booking','予約を追加'],['订单类型','Booking type','予約の種類'],['名称','Name','名称'],['日期','Date','日付'],['金额（元）','Amount (CNY)','金額（人民元）'],['状态','Status','状態'],
    ['待预订','Not booked','未予約'],['已预订','Booked','予約済み'],['已付款','Paid','支払済み'],['已使用','Used','使用済み'],['预订渠道','Booking channel','予約先'],['加入订单中心','Save booking','予約を保存'],
    ['。安卓请在系统提示中核对安装来源；Windows 安装包尚未商业签名。','. Check the installation source in Android’s prompt. The Windows installer is not commercially code-signed.','。Android の表示でインストール元を確認してください。Windows 版は商用コード署名を取得していません。'],
    ['1.0.1 · Windows 10 / 11（64 位）· 118.2 MiB','1.0.1 · Windows 10 / 11 (64-bit) · 118.2 MiB','1.0.1 · Windows 10 / 11（64 ビット）· 118.2 MiB'],
    ['国内站与海外站账号独立，切换后需要在对应站点登录。界面语言不会自动翻译已生成的攻略。','China and global sites have separate accounts. Sign in on the selected site. Interface language does not translate existing itineraries.','中国サイトと海外サイトのアカウントは別です。切替先でログインしてください。表示言語を変えても既存の旅程は翻訳されません。'],
    ['海外下载经本站转发 GitHub 公开安装包，支持断点续传。速度取决于下载线路和你的网络。','Global downloads stream the public installer from GitHub through this site and support resume. Speed depends on the route and your network.','海外のダウンロードは GitHub の公開ファイルをこのサイト経由で転送します。中断後の再開に対応しています。速度は経路と通信環境に依存します。'],
    ['安装包由本站服务器提供，支持断点续传。速度取决于服务器带宽和你的网络；下载中断时可在浏览器下载列表中继续。','Installers are served by the China server with resumable downloads. Speed depends on server bandwidth and your network. Resume interrupted transfers in your browser.','中国サーバーからダウンロードし、中断後の再開に対応します。速度は帯域と通信環境に依存します。ブラウザーのダウンロード一覧から再開できます。'],
    ['软件下载','Downloads','ダウンロード'],['返回工作台 →','Back to workspace →','ワークスペースへ →'],
    ['把旅行计划，带在身边。','Keep your travel plans close.','旅の計画を、いつもそばに。'],
    ['在电脑上慢慢规划，在手机上随时查看。下载 TripMate，登录同一个账号，继续自己的行程。','Plan on your computer, then check your itinerary on your phone. Sign in to continue on the same service.','パソコンで計画して、スマートフォンで確認。同じサービスにログインして旅程を続けられます。'],
    ['选择适合设备的版本，直接从本站下载安装包。','Choose a version for your device. Downloads use this site’s selected route.','端末に合ったバージョンを選択してください。選択したサイトの経路でダウンロードします。'],
    ['适合当前设备','For this device','この端末向け'],['随身查看与管理行程','View and manage your itinerary on the go','旅程をいつでも確認・管理'],
    ['下载安卓 APK','Download Android APK','Android APK をダウンロード'],['支持 ARMv7 / ARM64 手机和平板','ARMv7 / ARM64 phones and tablets','ARMv7 / ARM64 のスマートフォン・タブレット'],
    ['大屏规划、编辑行程与导出 PDF','Plan, edit and export a PDF on a larger screen','大画面で計画・編集・PDF 出力'],
    ['下载 Windows 版','Download for Windows','Windows 版をダウンロード'],['安装版 · 保留已有账号与行程','Installer · keeps existing app data','インストーラー · 既存データを保持'],
    ['不安装，也可以出发。','Use TripMate without installing.','インストールせずに使えます。'],
    ['iPhone、iPad、Mac 和其他设备可直接使用网页版。','Use the web app on iPhone, iPad, Mac and other devices.','iPhone、iPad、Mac などではウェブ版をご利用いただけます。'],
    ['打开网页版 →','Open web app →','ウェブ版を開く →'],['GitHub 备用下载','GitHub backup download','GitHub 予備ダウンロード'],
    ['安装包免费下载，使用时需要联网。AI 生成按账号额度和页面价格提示使用。网页、Windows 和安卓的功能支持可能不同。','Installers are free to download and require an internet connection. AI uses account credits and the price shown before generation. Features vary by platform.','インストーラーは無料です。利用にはネット接続が必要です。AI はアカウントのクレジットと生成前の価格表示に従います。機能は端末ごとに異なります。'],
    ['查看安装包 SHA-256 校验值','Show installer SHA-256 checksums','SHA-256 チェックサムを表示'],['安卓 APK','Android APK','Android APK'],['Windows 安装版','Windows installer','Windows インストーラー'],
    ['遇到问题？告诉我们','Report a problem','問題を報告'],['旅伴 TripMate · 带爸妈旅行，少走冤枉路。','TripMate · Easier trips with your family.','TripMate · 家族との旅行を、もっと気軽に。'],
    ['欢迎回来','Welcome back','おかえりなさい'],['登录','Sign in','ログイン'],['注册','Sign up','登録'],['邮箱','Email','メール'],['密码','Password','パスワード'],
    ['登录 TripMate','Sign in to TripMate','TripMate にログイン'],['跳过登录，游客观看','Continue as a guest','ゲストとして続ける'],['账号','Account','アカウント'],
    ['登录 / 注册','Sign in / Sign up','ログイン / 登録'],['忘记密码？','Forgot password?','パスワードを忘れた場合'],['退出登录','Sign out','ログアウト'],
    ['昵称','Name','表示名'],['设置密码','Create password','パスワードを設定'],['发送验证码','Send code','認証コードを送信'],['邮箱验证码','Email code','メール認証コード'],
    ['创建账号','Create account','アカウントを作成'],['验证并创建账号','Verify and create account','確認してアカウントを作成'],
    ['AI 规划','AI planner','AI プランナー'],['今日助手','Today','今日の予定'],['我的行程','My trips','マイ旅程'],['订单中心','Bookings','予約'],
    ['提醒中心','Reminders','リマインダー'],['旅行工具','Travel tools','旅行ツール'],['旅行偏好','Preferences','旅行の設定'],['AI 额度','AI credits','AI クレジット'],['管理后台','Admin','管理'],
    ['生成攻略','Plan my trip','旅程を作成'],['下一站，想去哪儿？','Where would you like to go?','次はどこへ行きますか？'],['AI 旅行规划师','AI travel planner','AI 旅行プランナー'],
    ['每日安排','Itinerary','日程'],['怎么去','Transport','交通'],['住哪吃哪','Stay & eat','宿泊・食事'],['钱花在哪','Budget','予算'],
    ['生成攻略后显示每日安排','Your daily itinerary will appear here','旅程を生成すると日程が表示されます'],['出发地','From','出発地'],['目的地','Destination','目的地'],['天数','Days','日数'],['人数','Travelers','人数'],['预算','Budget','予算'],
    ['保存','Save','保存'],['取消','Cancel','キャンセル'],['关闭','Close','閉じる'],['查看','View','表示'],['删除','Delete','削除'],['全部','All','すべて'],
    ['旅行需求','Travel request','旅行の希望'],['至少 8 位','At least 8 characters','8 文字以上'],['怎么称呼你','Your display name','表示名'],['6 位验证码','6-digit code','6 桁の認証コード'],
    ['登录后继续规划，并在不同设备查看自己的行程。','Sign in to continue planning and access your trips across devices.','ログインして計画を続け、他の端末でも旅程を確認できます。'],
    ['下载安卓 / Windows 软件 →','Download Android / Windows →','Android / Windows をダウンロード →'],
    ['1.1.5 · Android 7.0 及以上','1.1.5 · Android 7.0 or later','1.1.5 · Android 7.0 以降'],
    ['你正在使用安卓设备，可以下载 APK；也可继续使用网页版。','You are on Android. Download the APK or continue on the web.','Android では APK またはウェブ版をご利用いただけます。'],
    ['你正在使用 Windows，建议下载 Windows 版。','You are on Windows. Choose the Windows installer.','Windows 用のインストーラーをご利用ください。'],
    ['你正在使用 iPhone 或 iPad，目前请使用网页版，无需安装。','On iPhone or iPad, use the web app without installing.','iPhone / iPad ではインストール不要のウェブ版をご利用ください。']
  ];
  const index = new Map(pairs.map(row => [row[0], row]));
  let language;
  try { language = new URL(location.href).searchParams.get('lang') || localStorage.getItem('tripmate.ui.language'); } catch {}
  if (!languages.includes(language)) {
    const candidate=(navigator.language||'').split('-')[0];
    language=languages.includes(candidate)?candidate:'zh-CN';
  }
  const records = new WeakMap();
  const attributeRecords = new WeakMap();
  const ignored = 'script,style,textarea,code,pre,[data-no-translate],[contenteditable],#days,.event,.transport-leg,.recommendation-card';
  const translate = text => {
    const leading = text.match(/^\s*/)[0], trailing = text.match(/\s*$/)[0], value = text.trim();
    const plain = value.replace(/^[^\p{L}\p{N}]+/u, '');
    const row = index.get(value) || index.get(plain);
    return row ? leading + value.slice(0, value.length - (index.has(value) ? value.length : plain.length)) + row[fullLanguages.includes(language)?fullLanguages.indexOf(language):1] + trailing : text;
  };
  // Settings are local to this browser; no account, itinerary or credential leaves this site.
  const readSetting=(key,fallback)=>{try{return localStorage.getItem('tripmate.ui.'+key)||fallback;}catch{return fallback;}};
  const saveSetting=(key,value)=>{try{localStorage.setItem('tripmate.ui.'+key,value);}catch{}};
  let textSize=readSetting('textSize','standard');
  if(!['standard','large'].includes(textSize))textSize='standard';
  let reduceMotion=readSetting('reduceMotion','system');
  if(!['system','true','false'].includes(reduceMotion))reduceMotion='system';
  const copy=()=>localeData[language];
  const isChinese=()=>language.startsWith('zh');
  const info=(zh,en)=>isChinese()?zh:en;
  const coreKeys={'设置':1,'关闭':2,'国内站':3,'海外站':4,'国际站':4,'界面语言':7,'语言':7,'软件下载':12,'登录':13,'注册':14,'保存':15};
  const originalTranslate=translate;
  const localize=text=>{
    const value=text.trim(),key=coreKeys[value];
    return key===undefined?originalTranslate(text):text.slice(0,text.indexOf(value))+copy()[key]+text.slice(text.indexOf(value)+value.length);
  };
  const bar = document.createElement('nav');
  bar.dataset.noTranslate='true';bar.className='tripmate-region-bar';
  bar.innerHTML='<a class="region-download" href="/download">软件下载</a><span id="tripmate-current-region"></span><a id="tripmate-region-switch" class="region-switch"></a><button id="tripmate-settings-toggle" type="button" aria-expanded="false" aria-controls="tripmate-settings-panel"></button>';
  const panel=document.createElement('section');
  panel.id='tripmate-settings-panel';panel.dataset.noTranslate='true';panel.hidden=true;
  panel.setAttribute('aria-labelledby','tripmate-settings-title');
  panel.innerHTML='<header><h2 id="tripmate-settings-title"></h2><button type="button" id="tripmate-settings-close"></button></header><div class="settings-body"><label for="tripmate-language" class="setting-label" id="tripmate-language-label"></label><select id="tripmate-language"></select><p id="tripmate-language-note" class="setting-help"></p><div class="setting-row"><label for="tripmate-text-size" id="tripmate-text-label"></label><select id="tripmate-text-size"><option value="standard"></option><option value="large"></option></select></div><label class="setting-row motion-row"><span id="tripmate-motion-label"></span><input id="tripmate-reduce-motion" type="checkbox"></label><p id="tripmate-setting-note" class="setting-help"></p><div class="setting-site"><a id="tripmate-shared-records" class="region-switch" href="/account-link" target="_blank" rel="noopener">合并 / 共享记录</a><p></p><strong id="tripmate-site-label"></strong><p id="tripmate-account-note" class="setting-help"></p><a id="tripmate-settings-region" class="region-switch"></a></div></div>';
  const style=document.createElement('style');
  style.textContent=`
  body{padding-top:var(--tripmate-bar-height,64px)!important}
  .tripmate-region-bar,#tripmate-settings-panel{font:15px/1.5 "Segoe UI","Microsoft YaHei",sans-serif;color:#172846;box-sizing:border-box;text-align:start}
  .tripmate-region-bar{position:fixed;inset:0 0 auto;z-index:2147483000;min-height:64px;background:#fff;border-bottom:1px solid #dce4f0;display:flex;align-items:center;gap:12px;padding:8px max(16px,calc((100vw - 1200px)/2))}
  .tripmate-region-bar a,.tripmate-region-bar button,#tripmate-settings-panel button,#tripmate-settings-panel select,#tripmate-settings-panel .region-switch{box-sizing:border-box;min-height:44px;font:inherit;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;border-radius:8px;line-height:1.4;white-space:normal}
  .tripmate-region-bar .region-download{color:#2459d3;font-weight:650;margin-inline-end:auto;flex-shrink:0}
  #tripmate-current-region{font-size:13px;color:#52627a;max-width:170px}
  .tripmate-region-bar .region-switch,#tripmate-settings-panel .region-switch{padding:8px 12px;background:#eaf0ff;color:#204cad;font-weight:650}
  .tripmate-region-bar button,#tripmate-settings-panel button{padding:8px 12px;background:#fff;border:1px solid #c8d5e9;color:#172846;cursor:pointer}
  .tripmate-region-bar a:hover,.tripmate-region-bar button:hover,#tripmate-settings-panel button:hover{background:#eaf0ff}
  .tripmate-region-bar :focus-visible,#tripmate-settings-panel :focus-visible{outline:3px solid #ad570a;outline-offset:2px}
  #tripmate-settings-panel{position:fixed;z-index:2147483001;inset-block-start:calc(var(--tripmate-bar-height,64px) + 8px);inset-inline-end:max(12px,calc((100vw - 1200px)/2));width:min(440px,calc(100vw - 24px));max-height:calc(100dvh - var(--tripmate-bar-height,64px) - 24px);overflow:auto;overscroll-behavior:contain;background:#fff;border:1px solid #c8d5e9;border-radius:12px;box-shadow:0 12px 32px #17284626}
  #tripmate-settings-panel[hidden]{display:none!important}
  #tripmate-settings-panel header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid #dce4f0}
  #tripmate-settings-panel h2{margin:0;font-size:22px;line-height:1.3}
  .settings-body{padding:20px}
  #tripmate-settings-panel select{background:#fff;border:1px solid #aebfd8;color:#172846;padding:8px 10px;max-width:100%;font-size:16px}
  #tripmate-language{width:100%;margin-top:8px}
  .setting-label{font-weight:650}
  .setting-help{color:#52627a;font-size:14px;line-height:1.65;margin:10px 0 18px}
  .setting-row{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:56px;margin:8px 0}
  .setting-row select{min-width:110px;max-width:55%!important}
  .motion-row{cursor:pointer}
  #tripmate-reduce-motion{width:23px;height:23px;min-width:23px;accent-color:#285de0;margin:0}
  .setting-site{border-top:1px solid #dce4f0;margin-top:22px;padding-top:20px}
  .tripmate-large-text :is(p,label,input,textarea,select,button,li){font-size:max(1em,18px)!important}
  .tripmate-reduce-motion *,.tripmate-reduce-motion *::before,.tripmate-reduce-motion *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
  @media(max-width:560px){.tripmate-region-bar{gap:7px;padding:8px 12px;font-size:13px}.tripmate-region-bar .region-switch{max-width:49vw;padding:8px 10px}#tripmate-current-region{display:none}#tripmate-settings-toggle{max-width:28vw;padding:8px}.auth-gate{padding-top:calc(var(--tripmate-bar-height,64px) + 18px)!important}}
  @media print{.tripmate-region-bar,#tripmate-settings-panel{display:none!important}body{padding-top:0!important}}
  `;
  document.head.append(style);document.body.prepend(bar);document.body.append(panel);
  const measureBar=()=>document.documentElement.style.setProperty('--tripmate-bar-height',bar.getBoundingClientRect().height+'px');
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(measureBar).observe(bar);
  else window.addEventListener('resize',measureBar);
  const languageSelect=panel.querySelector('#tripmate-language');
  for(const code of languages){const option=document.createElement('option');option.value=code;option.lang=code;option.textContent=localeData[code][0];languageSelect.append(option);}
  const toggle=bar.querySelector('button'),close=panel.querySelector('button'),textSelect=panel.querySelector('#tripmate-text-size'),motion=panel.querySelector('#tripmate-reduce-motion');
  const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
  const applyAppearance=()=>{
    document.documentElement.classList.toggle('tripmate-large-text',textSize==='large');
    const reduced=reduceMotion==='system'?motionQuery.matches:reduceMotion==='true';
    document.documentElement.classList.toggle('tripmate-reduce-motion',reduced);motion.checked=reduced;textSelect.value=textSize;
  };
  if(motionQuery.addEventListener)motionQuery.addEventListener('change',applyAppearance);
  const regionUrl=()=>{const target=new URL(location.pathname.startsWith('/download')?'/download':'/',hosts[region==='domestic'?'overseas':'domestic']);target.searchParams.set('lang',language);target.searchParams.set('textSize',textSize);target.searchParams.set('motion',reduceMotion);return target.href;};
  // Transfer only these three explicit UI preferences, never the source query string.
  const incoming=new URL(location.href).searchParams;
  if(['standard','large'].includes(incoming.get('textSize')))textSize=incoming.get('textSize');
  if(['system','true','false'].includes(incoming.get('motion')))reduceMotion=incoming.get('motion');
  const repaint = () => {
    const labels=copy();document.documentElement.lang=language;
    document.documentElement.dir=['ar','he','fa','ur'].includes(language)?'rtl':'ltr';
    bar.setAttribute('aria-label',info('站点与设置','Site and settings'));
    bar.querySelector('.region-download').textContent=labels[12];bar.querySelector('.region-download').href='/download?lang='+encodeURIComponent(language);
    bar.querySelector('#tripmate-current-region').textContent=labels[region==='domestic'?3:4];
    for(const link of [bar.querySelector('#tripmate-region-switch'),panel.querySelector('#tripmate-settings-region')]){link.textContent=labels[region==='domestic'?5:6];link.href=regionUrl();}
    toggle.textContent=labels[1];close.textContent=labels[2];panel.querySelector('h2').textContent=labels[1];
    panel.querySelector('#tripmate-language-label').textContent=labels[7]+' / Language';languageSelect.value=language;
    panel.querySelector('#tripmate-text-label').textContent=labels[8];textSelect.options[0].textContent=labels[9];textSelect.options[1].textContent=labels[10];
    panel.querySelector('#tripmate-motion-label').textContent=labels[11];
    panel.querySelector('#tripmate-language-note').textContent=info('44 种语言，覆盖设置与基础按钮；中英日覆盖更多页面文字。未覆盖内容显示英文或原文，已有攻略不自动翻译。','44 languages for settings and basic buttons. Chinese, English and Japanese cover more text. Other text may remain in English or its original language; existing trips stay unchanged.');
    panel.querySelector('#tripmate-setting-note').textContent=info('选择后立即生效，并保存在当前浏览器。字号和动画偏好会随站点切换带过去。','Changes apply immediately and stay in this browser. Text and motion preferences follow the site switch.');
    panel.querySelector('#tripmate-shared-records').textContent=info('合并 / 共享记录','Merge / share records');
    panel.querySelector('#tripmate-site-label').textContent=labels[region==='domestic'?3:4];
    panel.querySelector('#tripmate-account-note').textContent=info('两边分别登录，可在“合并 / 共享记录”里验证并连接账号。未连接前，记录独立。','Sign in separately. Link your accounts in Merge / share records to use shared travel records. Until linked, records stay separate.');
    document.querySelectorAll('select:not(#tripmate-language):not(#tripmate-text-size) option:not([value])').forEach(option=>option.setAttribute('value',option.textContent));
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode())){
      if(!node.parentElement||node.parentElement.closest(ignored))continue;
      let record=records.get(node);
      if(!record||node.nodeValue!==record.last)record={original:node.nodeValue,last:node.nodeValue};
      const next=localize(record.original);if(node.nodeValue!==next)node.nodeValue=next;
      record.last=next;records.set(node,record);
    }
    document.querySelectorAll('[placeholder],[aria-label]').forEach(element=>{
      if(element.closest(ignored))return;
      let originals=attributeRecords.get(element);if(!originals){originals={};attributeRecords.set(element,originals);}
      for(const key of ['placeholder','aria-label'])if(element.hasAttribute(key)){if(!(key in originals))originals[key]=element.getAttribute(key);const next=localize(originals[key]);if(element.getAttribute(key)!==next)element.setAttribute(key,next);}
    });
    applyAppearance();
    measureBar();
  };
  const setOpen=open=>{panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)languageSelect.focus();else toggle.focus();};
  toggle.onclick=()=>setOpen(panel.hidden);close.onclick=()=>setOpen(false);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();setOpen(false);}});
  document.addEventListener('click',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!toggle.contains(event.target)){panel.hidden=true;toggle.setAttribute('aria-expanded','false');}});
  const persist=()=>{saveSetting('language',language);saveSetting('textSize',textSize);saveSetting('reduceMotion',reduceMotion);const url=new URL(location.href);url.searchParams.set('lang',language);url.searchParams.set('textSize',textSize);url.searchParams.set('motion',reduceMotion);history.replaceState(history.state,'',url);repaint();};
  languageSelect.onchange=()=>{language=languageSelect.value;persist();};
  textSelect.onchange=()=>{textSize=textSelect.value;persist();};
  motion.onchange=()=>{reduceMotion=String(motion.checked);persist();};
  let queued=false;
  new MutationObserver(changes=>{if(changes.every(change=>bar.contains(change.target)||panel.contains(change.target)))return;if(!queued){queued=true;queueMicrotask(()=>{queued=false;repaint();});}}).observe(document.body,{childList:true,characterData:true,subtree:true});
  saveSetting('language',language);saveSetting('textSize',textSize);saveSetting('reduceMotion',reduceMotion);
  repaint();

})();
