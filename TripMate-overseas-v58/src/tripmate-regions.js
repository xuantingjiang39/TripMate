(() => {
  'use strict';
  const hosts = { domestic: 'https://111.230.133.155', overseas: 'https://tripmate-travel-planner.xuantingjiang39.chatgpt.site' };
  const languages = ['zh-CN', 'en', 'ja'];
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
  if (!languages.includes(language)) language = 'zh-CN';
  const records = new WeakMap();
  const attributeRecords = new WeakMap();
  const ignored = 'script,style,textarea,code,pre,[data-no-translate],[contenteditable],#days,.event,.transport-leg,.recommendation-card';
  const translate = text => {
    const leading = text.match(/^\s*/)[0], trailing = text.match(/\s*$/)[0], value = text.trim();
    const plain = value.replace(/^[^\p{L}\p{N}]+/u, '');
    const row = index.get(value) || index.get(plain);
    return row ? leading + value.slice(0, value.length - (index.has(value) ? value.length : plain.length)) + row[languages.indexOf(language)] + trailing : text;
  };
  const bar = document.createElement('nav');
  bar.dataset.noTranslate = 'true';bar.className = 'tripmate-region-bar';bar.setAttribute('aria-label','Site and language');
  bar.innerHTML = '<a class="region-download" href="/download">软件下载</a><label><span class="region-label"></span><select id="tripmate-region"><option value="domestic"></option><option value="overseas"></option></select></label><label><span class="language-label"></span><select id="tripmate-language"><option value="zh-CN">简体中文</option><option value="en">English</option><option value="ja">日本語</option></select></label>';
  const style = document.createElement('style');
  style.textContent = 'body{padding-top:62px!important}.tripmate-region-bar{position:fixed;inset:0 0 auto;z-index:9999;min-height:58px;background:#fff;border-bottom:1px solid #dce4f0;display:flex;align-items:center;justify-content:flex-end;gap:18px;padding:7px max(16px,calc((100vw - 1200px)/2));font:14px/1.4 "Segoe UI","Microsoft YaHei",sans-serif;color:#172846}.tripmate-region-bar label{display:flex;align-items:center;gap:7px}.tripmate-region-bar select{min-height:42px;max-width:140px;border:1px solid #c8d5e9;border-radius:8px;background:#fff;color:#172846;font:inherit;padding:5px 9px}.tripmate-region-bar a{min-height:42px;display:flex;align-items:center;color:#2459d3;font-weight:600;text-decoration:none;margin-right:auto}.tripmate-region-bar :focus-visible{outline:3px solid #ce7618;outline-offset:2px}@media(max-width:560px){.tripmate-region-bar{gap:8px;padding:7px 12px}.tripmate-region-bar label>span{display:none}.tripmate-region-bar select{max-width:122px;font-size:13px}.tripmate-region-bar a{font-size:13px}.auth-gate{padding-top:78px!important}}@media print{.tripmate-region-bar{display:none}body{padding-top:0!important}}';
  document.head.append(style);document.body.prepend(bar);
  const regionSelect = bar.querySelector('#tripmate-region'), languageSelect = bar.querySelector('#tripmate-language');
  regionSelect.value = region;languageSelect.value = language;
  const repaint = () => {
    document.documentElement.lang = language;
    // Text-only <option> elements otherwise change their submitted value when translated.
    document.querySelectorAll('select:not(#tripmate-region):not(#tripmate-language) option:not([value])').forEach(option=>option.setAttribute('value',option.textContent));
    const labels = { 'zh-CN':['软件下载','站点','界面语言','国内站','海外站'], en:['Downloads','Site','Language','China site','Global site'], ja:['ダウンロード','サイト','言語','中国サイト','海外サイト'] }[language];
    bar.querySelector('a').textContent=labels[0];bar.querySelector('.region-label').textContent=labels[1];bar.querySelector('.language-label').textContent=labels[2];
    regionSelect.options[0].textContent=labels[3];regionSelect.options[1].textContent=labels[4];regionSelect.setAttribute('aria-label',labels[1]);languageSelect.setAttribute('aria-label',labels[2]);
    bar.querySelector('a').href='/download?lang='+language;
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode())){
      if(!node.parentElement||node.parentElement.closest(ignored))continue;
      let record=records.get(node);
      if(!record||node.nodeValue!==record.last)record={original:node.nodeValue,last:node.nodeValue};
      const next=translate(record.original);if(node.nodeValue!==next)node.nodeValue=next;
      record.last=next;records.set(node,record);
    }
    document.querySelectorAll('[placeholder],[aria-label]').forEach(element=>{
      if(element.closest(ignored))return;
      let originals=attributeRecords.get(element);if(!originals){originals={};attributeRecords.set(element,originals);}
      for(const key of ['placeholder','aria-label'])if(element.hasAttribute(key)){if(!(key in originals))originals[key]=element.getAttribute(key);element.setAttribute(key,translate(originals[key]));}
    });
  };
  languageSelect.onchange=()=>{language=languageSelect.value;try{localStorage.setItem('tripmate.ui.language',language);}catch{}repaint();};
  regionSelect.onchange=()=>{const target=new URL(location.pathname.startsWith('/download')?'/download':'/',hosts[regionSelect.value]);target.searchParams.set('lang',language);location.assign(target.href);};
  let queued=false;
  new MutationObserver(changes=>{if(changes.every(change=>bar.contains(change.target)))return;if(!queued){queued=true;queueMicrotask(()=>{queued=false;repaint();});}}).observe(document.body,{childList:true,characterData:true,subtree:true});
  repaint();
})();
