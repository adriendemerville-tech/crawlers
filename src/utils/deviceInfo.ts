/**
 * Detect device information from the browser's navigator object.
 */
export interface DeviceInfo {
  type: 'mobile' | 'tablet' | 'desktop';
  os: string;
  browser: string;
  browserVersion: string;
  device: string;
}

export function getDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent;

  // Detect type
  const isMobile = /Mobi|Android|iPhone|iPod/i.test(ua);
  const isTablet = /iPad|Tablet|PlayBook/i.test(ua) || (/Android/i.test(ua) && !/Mobi/i.test(ua));
  const type: DeviceInfo['type'] = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  // Detect OS
  let os = 'Inconnu';
  if (/Windows NT 10/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X (\d+[._]\d+)/i.test(ua)) {
    const v = ua.match(/Mac OS X (\d+[._]\d+[._]?\d*)/i)?.[1]?.replace(/_/g, '.');
    os = `macOS ${v || ''}`.trim();
  } else if (/CrOS/i.test(ua)) os = 'ChromeOS';
  else if (/Android ([\d.]+)/i.test(ua)) {
    const v = ua.match(/Android ([\d.]+)/i)?.[1];
    os = `Android ${v || ''}`.trim();
  } else if (/iPhone OS ([\d_]+)/i.test(ua)) {
    const v = ua.match(/iPhone OS ([\d_]+)/i)?.[1]?.replace(/_/g, '.');
    os = `iOS ${v || ''}`.trim();
  } else if (/iPad.*OS ([\d_]+)/i.test(ua)) {
    const v = ua.match(/OS ([\d_]+)/i)?.[1]?.replace(/_/g, '.');
    os = `iPadOS ${v || ''}`.trim();
  } else if (/Linux/i.test(ua)) os = 'Linux';

  // Detect browser + version
  let browser = 'Inconnu';
  let browserVersion = '';
  if (/OPR\/([\d.]+)/i.test(ua)) {
    browser = 'Opera';
    browserVersion = ua.match(/OPR\/([\d.]+)/i)?.[1] || '';
  } else if (/Edg\/([\d.]+)/i.test(ua)) {
    browser = 'Edge';
    browserVersion = ua.match(/Edg\/([\d.]+)/i)?.[1] || '';
  } else if (/Chrome\/([\d.]+)/i.test(ua) && !/Edg/i.test(ua)) {
    browser = 'Chrome';
    browserVersion = ua.match(/Chrome\/([\d.]+)/i)?.[1] || '';
  } else if (/Safari\/([\d.]+)/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari';
    browserVersion = ua.match(/Version\/([\d.]+)/i)?.[1] || '';
  } else if (/Firefox\/([\d.]+)/i.test(ua)) {
    browser = 'Firefox';
    browserVersion = ua.match(/Firefox\/([\d.]+)/i)?.[1] || '';
  }

  // Detect device model
  let device = type === 'desktop' ? 'Desktop' : 'Inconnu';
  const iphoneMatch = ua.match(/iPhone/i);
  const ipadMatch = ua.match(/iPad/i);
  const androidModel = ua.match(/;\s*([^;)]+)\s*Build\//i);
  if (iphoneMatch) device = 'iPhone';
  else if (ipadMatch) device = 'iPad';
  else if (androidModel) device = androidModel[1].trim();

  return { type, os, browser, browserVersion, device };
}
