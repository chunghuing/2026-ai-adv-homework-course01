const crypto = require('crypto');

const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID || '3002607';
const HASH_KEY = process.env.ECPAY_HASH_KEY || 'pwFHCqoQZGmho4w6';
const HASH_IV = process.env.ECPAY_HASH_IV || 'EkRm7iFT261dpevs';
const IS_STAGE = process.env.ECPAY_ENV !== 'production';

const PAYMENT_URL = IS_STAGE
  ? 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'
  : 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';

const QUERY_URL = IS_STAGE
  ? 'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5'
  : 'https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5';

// Node.js-specific URL encode required by ECPay CheckMacValue spec
// Source: web_fetch https://developers.ecpay.com.tw/2862.md 2026-04-28
function ecpayUrlEncode(source) {
  let encoded = encodeURIComponent(source)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');
  encoded = encoded.toLowerCase();
  const restore = { '%2d': '-', '%5f': '_', '%2e': '.', '%21': '!', '%2a': '*', '%28': '(', '%29': ')' };
  for (const [from, to] of Object.entries(restore)) {
    encoded = encoded.split(from).join(to);
  }
  return encoded;
}

function generateCheckMacValue(params) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'CheckMacValue')
  );
  const sorted = Object.keys(filtered)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const paramStr = sorted.map(k => `${k}=${filtered[k]}`).join('&');
  const raw = `HashKey=${HASH_KEY}&${paramStr}&HashIV=${HASH_IV}`;
  return crypto.createHash('sha256').update(ecpayUrlEncode(raw), 'utf8').digest('hex').toUpperCase();
}

function verifyCheckMacValue(params) {
  const received = params.CheckMacValue || '';
  const calculated = generateCheckMacValue(params);
  const a = Buffer.from(received);
  const b = Buffer.from(calculated);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// MerchantTradeDate must be UTC+8, format: yyyy/MM/dd HH:mm:ss
function getMerchantTradeDate() {
  return new Date().toLocaleString('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).replace(/-/g, '/');
}

function buildPaymentParams(order, baseUrl) {
  const itemName = order.items
    .map(i => `${i.product_name} x${i.quantity}`)
    .join('#')
    .substring(0, 400);

  const params = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: order.merchant_trade_no,
    MerchantTradeDate: getMerchantTradeDate(),
    PaymentType: 'aio',
    TotalAmount: String(order.total_amount),
    TradeDesc: '花卉電商訂單',
    ItemName: itemName,
    ReturnURL: `${baseUrl}/payment/notify`,
    OrderResultURL: `${baseUrl}/payment/result`,
    ChoosePayment: 'Credit',
    EncryptType: '1',
  };

  params.CheckMacValue = generateCheckMacValue(params);
  return params;
}

// QueryTradeInfo response is URL-encoded string
// TradeStatus: '1'=paid, '0'=pending, '10200095'=not paid/cancelled
// Source: web_fetch https://developers.ecpay.com.tw/2890.md 2026-04-28
async function queryTradeInfo(merchantTradeNo) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp: String(timestamp),
  };
  params.CheckMacValue = generateCheckMacValue(params);

  const body = new URLSearchParams(params).toString();
  const resp = await fetch(QUERY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await resp.text();
  return Object.fromEntries(new URLSearchParams(text));
}

module.exports = {
  PAYMENT_URL,
  generateCheckMacValue,
  verifyCheckMacValue,
  buildPaymentParams,
  queryTradeInfo,
};
