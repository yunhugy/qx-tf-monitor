/*
TestFlight 名额检测 - Quantumult X Rewrite 脚本

用在 rewrite_remote / 重写资源中：
- 访问指定 TestFlight 链接时触发
- 满员不通知
- 只有页面明确出现“开始测试 / Start Testing / Accept Invitation / 接受邀请”才通知
*/

const CONFIG = {
  appName: 'Quantumult X',
  availableNotifyCooldownSec: 60
};

const FULL_PATTERNS = [
  'This beta is full',
  'This beta is currently full',
  "This beta isn't accepting any new testers right now",
  'This beta version is full',
  '此 Beta 版已满员',
  '此 Beta 版本的测试员已满',
  '此 Beta 版目前不接受任何新测试员',
  '测试员已满',
  '测试员名额已满',
  '名额已满',
  '不接受任何新测试员'
];

const CLOSED_PATTERNS = [
  "This beta isn't accepting new testers",
  'This beta is not accepting new testers',
  'not accepting new testers',
  '不接受新测试员',
  '停止接受'
];

const AVAILABLE_PATTERNS = [
  'Start Testing',
  'Accept Invitation',
  '开始测试',
  '接受邀请'
];

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function stripHtml(s) {
  return String(s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text, patterns) {
  const lower = text.toLowerCase();
  return patterns.some(p => lower.includes(String(p).toLowerCase()));
}

function classify(body, statusCode) {
  const plain = stripHtml(body);
  if (statusCode === 404 || plain.includes("couldn't be found") || plain.includes('找不到')) {
    return { status: 'not_found', message: '链接不存在或邀请码无效' };
  }
  if (includesAny(plain, FULL_PATTERNS)) {
    return { status: 'full', message: '名额已满' };
  }
  if (includesAny(plain, CLOSED_PATTERNS)) {
    return { status: 'closed', message: '当前不接受新测试员' };
  }
  if (includesAny(plain, AVAILABLE_PATTERNS)) {
    return { status: 'available', message: '发现可加入按钮，可能有名额' };
  }
  return { status: 'unknown', message: '未识别页面状态' };
}

function shouldNotify(key, cooldownSec) {
  const last = parseInt($prefs.valueForKey(key) || '0', 10);
  const t = nowSec();
  if (!last || t - last >= cooldownSec) {
    $prefs.setValueForKey(String(t), key);
    return true;
  }
  return false;
}

const body = $response && $response.body ? $response.body : '';
const statusCode = $response && $response.status ? $response.status : 200;
const url = $request && $request.url ? $request.url : 'https://testflight.apple.com/join/VCIvwk2g';
const result = classify(body, statusCode);

console.log(`[TF Rewrite] ${result.status.toUpperCase()} ${CONFIG.appName} | ${result.message} | ${url}`);

if (result.status === 'available') {
  const key = 'tf_rewrite_available_notify_' + url;
  if (shouldNotify(key, CONFIG.availableNotifyCooldownSec)) {
    $notify('TestFlight 有名额了', CONFIG.appName, '点此打开加入页：' + url, { 'open-url': url });
  }
}

$done({ body });
