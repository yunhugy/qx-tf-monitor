/*
TestFlight 名额监控 - Quantumult X 定时任务脚本

功能：
- 严格判断 TestFlight 公测链接是否有名额
- 满员/关闭/无效时不通知、不打开
- 只有检测到“开始测试 / Accept Invitation / Start Testing”等可加入文案，才推送通知
- 通知带 open-url，点通知即可打开 TestFlight 链接

注意：
- iOS 不允许脚本在后台无确认自动打开 App，所以 QX 只能“有名额时推送通知 + 点通知打开”。
- Quantumult X 定时任务最小粒度通常按分钟，不适合 1 秒级抢名额。
*/

const CONFIG = {
  tfUrl: 'https://testflight.apple.com/join/VCIvwk2g',
  appName: 'Quantumult X',
  notifyWhenFullFirstRun: false,  // 第一次运行如果满员是否通知
  availableNotifyCooldownSec: 60, // 有名额时通知冷却，防止连续刷屏
  fullNotifyCooldownSec: 0        // 满员通知冷却；0 表示不通知满员
};

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

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

// 严格：只把明确可加入按钮当作有名额
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

function extractTitle(html) {
  const m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripHtml(m[1]) : '';
}

function classify(body, statusCode) {
  const plain = stripHtml(body);
  const title = extractTitle(body);

  if (statusCode === 404 || plain.includes("couldn't be found") || plain.includes('找不到')) {
    return { status: 'not_found', title, message: '链接不存在或邀请码无效' };
  }
  if (includesAny(plain, FULL_PATTERNS)) {
    return { status: 'full', title, message: '名额已满' };
  }
  if (includesAny(plain, CLOSED_PATTERNS)) {
    return { status: 'closed', title, message: '当前不接受新测试员' };
  }
  if (includesAny(plain, AVAILABLE_PATTERNS)) {
    return { status: 'available', title, message: '发现可加入按钮，可能有名额' };
  }
  return { status: 'unknown', title, message: plain.slice(0, 120) || '未识别页面状态' };
}

function notify(title, subtitle, body, url) {
  const opts = url ? { 'open-url': url } : undefined;
  $notify(title, subtitle, body, opts);
}

function shouldNotify(key, cooldownSec) {
  if (!cooldownSec) return false;
  const last = parseInt($prefs.valueForKey(key) || '0', 10);
  const t = nowSec();
  if (!last || t - last >= cooldownSec) {
    $prefs.setValueForKey(String(t), key);
    return true;
  }
  return false;
}

const req = {
  url: CONFIG.tfUrl + (CONFIG.tfUrl.includes('?') ? '&' : '?') + '_=' + Date.now(),
  method: 'GET',
  headers: {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
};

$task.fetch(req).then(resp => {
  const result = classify(resp.body || '', resp.statusCode || 0);
  const app = CONFIG.appName || result.title || 'TestFlight';
  const statusKey = 'tf_monitor_status_' + CONFIG.tfUrl;
  const lastStatus = $prefs.valueForKey(statusKey) || '';
  $prefs.setValueForKey(result.status, statusKey);

  console.log(`[TF] ${result.status.toUpperCase()} ${app} | ${result.message} | ${CONFIG.tfUrl}`);

  if (result.status === 'available') {
    if (shouldNotify('tf_monitor_available_notify_' + CONFIG.tfUrl, CONFIG.availableNotifyCooldownSec)) {
      notify('TestFlight 有名额了', app, '点此打开加入页：' + CONFIG.tfUrl, CONFIG.tfUrl);
    }
  } else if (result.status === 'full') {
    if (CONFIG.notifyWhenFullFirstRun && !lastStatus) {
      notify('TestFlight 监控中', app, '当前名额已满，不会打开。', null);
    } else if (CONFIG.fullNotifyCooldownSec > 0 && shouldNotify('tf_monitor_full_notify_' + CONFIG.tfUrl, CONFIG.fullNotifyCooldownSec)) {
      notify('TestFlight 名额已满', app, '继续监控中。', null);
    }
  } else if (result.status === 'not_found' || result.status === 'closed') {
    if (lastStatus !== result.status) {
      notify('TestFlight 状态异常', app, result.message, null);
    }
  }

  $done();
}, err => {
  console.log('[TF] ERROR ' + JSON.stringify(err));
  $done();
});
