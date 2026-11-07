import { readFile } from 'node:fs/promises';

const script = await readFile(new URL('./set-tripmate-https-ip.sh', import.meta.url), 'utf8');
const updater = await readFile(new URL('./update-tripmate.sh', import.meta.url), 'utf8');
const installer = await readFile(new URL('./install.sh', import.meta.url), 'utf8');

const required = [
  '--preferred-profile shortlived',
  '--key-type rsa',
  '--rsa-key-size 2048',
  '--preferred-chain "ISRG Root X1"',
  '--webroot-path /var/www/certbot',
  '--ip-address "$PUBLIC_IP"',
  '--cert-name tripmate-ip-rsa',
  'openssl rsa -in /etc/letsencrypt/live/tripmate-ip-rsa/privkey.pem -check -noout',
  'tripmate-certbot-renew.timer',
  'OnUnitActiveSec=8h',
  'return 308 https://$PUBLIC_IP\\$request_uri',
  'cp -a "$BACKUP" /etc/nginx/sites-available/tripmate',
  'nginx -t',
];

for (const marker of required) {
  if (!script.includes(marker)) throw new Error(`HTTPS 脚本缺少安全标记：${marker}`);
}
if (!updater.includes('set-tripmate-https-ip.sh')) throw new Error('升级脚本没有安装 HTTPS 助手');
if (!installer.includes('set-tripmate-https-ip.sh')) throw new Error('安装脚本没有安装 HTTPS 助手');
if (/rm\s+-rf\s+\/var\/lib\/tripmate/.test(script)) throw new Error('HTTPS 脚本不得删除 TripMate 数据');

console.log('v41 RSA 公网 IP HTTPS、自动续期、失败恢复与数据保护：ok');
