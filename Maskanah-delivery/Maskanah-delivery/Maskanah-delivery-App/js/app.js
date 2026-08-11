'use strict';

/* =====================================================================
   توصيل مسكنة — Order logic
   كل الإعدادات القابلة للتعديل في كائن CONFIG بالأسفل.
   ===================================================================== */

const CONFIG = {
  // نقطة المرجع: مركز السوق الرئيسي في مسكنة
  referencePoint: { lat: 35.967665, lng: 38.030636 },

  // أقصى دقة موقع مقبولة بالأمتار (عدّل هذا الرقم لتغيير الحدّ)
  maxAllowedAccuracy: 100,

  // رسوم التوصيل
  freeDistanceMeters: 1500, // المسافة المشمولة بالرسم الأساسي
  baseDeliveryFee: 150,     // الرسم الأساسي
  distanceStepMeters: 100,  // طول الخطوة الزيادة
  extraFeePerStep: 5,       // الزيادة لكل 100 متر إضافي

  // رقم الواتساب المصرّح به
  whatsappNumber: '963983926067',

  // إعدادات تحديد الموقع (ثابتة كما هو مطلوب)
  geolocationOptions: { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
};

/* ---------- حالات منطقة الحالة ---------- */
const STATUS_STYLES = {
  info:    { className: 'status--info',    icon: 'info' },
  warning: { className: 'status--warning', icon: 'warning' },
  error:   { className: 'status--error',   icon: 'error' },
  success: { className: 'status--success', icon: 'success' }
};

const STATUS_ICON_SVG = {
  info:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  warning:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  error:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  success:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
};

const dom = {
  orderInput: document.getElementById('orderInput'),
  orderButton: document.getElementById('orderButton'),
  status: document.getElementById('status'),
  statusIcon: document.querySelector('.status__icon'),
  statusText: document.querySelector('.status__text')
};

let isSubmitting = false;

/* ---------- واجهات مساعدة ---------- */

function showStatus(type, message) {
  const style = STATUS_STYLES[type] || STATUS_STYLES.info;
  dom.status.className = 'status ' + style.className;
  dom.statusIcon.innerHTML = STATUS_ICON_SVG[style.icon];
  dom.statusText.textContent = message;
}

function fmtCoord(value) {
  return Number(value.toFixed(6));
}

/* مسافة هافرساين (بالمتر) بين نقطتين جغرافيتين */
function distanceInMeters(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* رسوم التوصيل — المنطق ثابت لا يتغيّر */
function calculateDeliveryFee(distance) {
  if (distance <= CONFIG.freeDistanceMeters) {
    return CONFIG.baseDeliveryFee;
  }
  return (
    CONFIG.baseDeliveryFee +
    Math.ceil((distance - CONFIG.freeDistanceMeters) / CONFIG.distanceStepMeters) *
      CONFIG.extraFeePerStep
  );
}
/* بناء رسالة الواتساب — تحتوي فقط على الطلب والموقع والإحداثيات والرسم */
function buildWhatsAppMessage(order, lat, lng, fee) {
  return [
    'New Order',
    '',
    'Order:',
    order,
    '',
    'Google Maps Location:',
    'https://www.google.com/maps?q=' + lat + ',' + lng,
    '',
    'Coordinates:',
    lat + ', ' + lng,
    '',
    'Delivery Fee:',
    fee + ' SYP'
  ].join('\n');
}

function setLoading(isLoading) {
  dom.orderButton.disabled = isLoading;
  dom.orderButton.classList.toggle('is-loading', isLoading);
  dom.orderButton.setAttribute('aria-busy', String(isLoading));
}

function resetButton() {
  isSubmitting = false;
  setLoading(false);
}

const GEO_ERROR_MESSAGES = {
  1: 'يرجى السماح بالوصول إلى موقعك حتى نتمكن من حساب رسوم التوصيل.',
  2: 'تعذر الحصول على موقعك. يرجى التأكد من تشغيل خدمة تحديد الموقع والمحاولة مرة أخرى.',
  3: 'استغرق الحصول على الموقع وقتاً طويلاً. يرجى المحاولة مرة أخرى.'
};

function onPositionError(error) {
  const message =
    GEO_ERROR_MESSAGES[error && error.code] ||
    'حدث خطأ غير متوقع أثناء تحديد موقعك. يرجى المحاولة مرة أخرى.';
  showStatus('error', message);
  resetButton();
}

function onPositionSuccess(position, order) {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const accuracy = position.coords.accuracy;

  // التحقق من دقة الموقع قبل حساب الرسم
  if (accuracy > CONFIG.maxAllowedAccuracy) {
    showStatus(
      'warning',
      'دقة الموقع ضعيفة. يرجى تفعيل الموقع بدقة عالية والمحاولة مرة أخرى.'
    );
    resetButton();
    return;
  }

  const distance = distanceInMeters(
    lat,
    lng,
    CONFIG.referencePoint.lat,
    CONFIG.referencePoint.lng
  );

  const fee = calculateDeliveryFee(distance);

  // إحداثيات منسّقة لرسالة نظيفة ومتّسقة مع رابط الخريطة
  const fLat = fmtCoord(lat);
  const fLng = fmtCoord(lng);

  const message = buildWhatsAppMessage(order, fLat, fLng, fee);
  const whatsappUrl =
    'https://wa.me/' + CONFIG.whatsappNumber + '?text=' + encodeURIComponent(message);

  showStatus('success', 'تم تجهيز طلبك بنجاح. جاري فتح واتساب...');
  resetButton();

  openWhatsApp(whatsappUrl);
}

/* فتح واتساب مع بديل موثوق عند حظر النوافذ المنبثقة */
function openWhatsApp(url) {
  let opened = null;
  try {
    opened = window.open(url, '_blank');
  } catch (e) {
    opened = null;
  }
  if (opened === null) {
    window.location.href = url;
  }
}

function handleOrderClicked() {
  if (isSubmitting) return;

  // 1) التحقق من الطلب (مع تقليم المسافات)
  const order = dom.orderInput.value.trim();

  if (!order) {
    showStatus('error', 'يرجى إدخال طلبك أولاً قبل إرساله عبر واتساب.');
    dom.orderInput.focus();
    return;
  }

  if (!('geolocation' in navigator)) {
    showStatus('error', 'متصفحك لا يدعم تحديد الموقع. يرجى استخدام متصفح حديث.');
    return;
  }

  // 2) بدء المعالجة: قفل الزر وإظهار حالة التحميل
  isSubmitting = true;
  setLoading(true);
  showStatus('info', 'جاري الحصول على موقعك... يرجى السماح بالوصول إلى الموقع.');

  // 3) طلب الموقع بهذه الإعدادات الثابتة
  navigator.geolocation.getCurrentPosition(
    (position) => onPositionSuccess(position, order),
    onPositionError,
    CONFIG.geolocationOptions
  );
}

dom.orderButton.addEventListener('click', handleOrderClicked);