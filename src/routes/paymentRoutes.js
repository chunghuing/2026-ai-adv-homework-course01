const express = require('express');
const router = express.Router();
const db = require('../database');
const authMiddleware = require('../middleware/authMiddleware');
const ecpay = require('../services/ecpay');

// API: return ECPay payment params as JSON (called by frontend JS with JWT header)
router.post('/ecpay/:orderId/params', authMiddleware, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(req.params.orderId, req.user.userId);

  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
  }
  if (order.status !== 'pending') {
    return res.status(400).json({ data: null, error: 'INVALID_STATUS', message: '訂單狀態不是 pending' });
  }
  if (!order.merchant_trade_no) {
    return res.status(400).json({ data: null, error: 'INVALID_STATE', message: '此訂單缺少付款編號' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
  const paymentParams = ecpay.buildPaymentParams({ ...order, items }, baseUrl);

  res.json({
    data: { paymentUrl: ecpay.PAYMENT_URL, params: paymentParams },
    error: null,
    message: '成功'
  });
});

// ReturnURL: S2S notification from ECPay (may not be reachable on localhost)
// Must respond with exactly "1|OK" (HTTP 200) within 10 seconds
router.post('/notify', express.urlencoded({ extended: false }), (req, res) => {
  res.status(200).type('text/plain').send('1|OK');
});

function renderFront(res, page, locals = {}) {
  res.render('pages/' + page, locals, function (err, body) {
    if (err) return res.status(500).send(err.message);
    res.render('layouts/front', { body, ...locals });
  });
}

// OrderResultURL: browser redirect from ECPay after payment completes
router.get('/result', (req, res) => {
  const merchantTradeNo = req.query.MerchantTradeNo || '';
  renderFront(res, 'payment-result', {
    title: '付款結果',
    merchantTradeNo,
    pageScript: 'payment-result',
  });
});

router.post('/result', express.urlencoded({ extended: false }), (req, res) => {
  const merchantTradeNo = req.body.MerchantTradeNo || '';
  renderFront(res, 'payment-result', {
    title: '付款結果',
    merchantTradeNo,
    pageScript: 'payment-result',
  });
});

module.exports = router;
