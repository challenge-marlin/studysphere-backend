const express = require('express');
const { loginValidation, handleValidationErrors } = require('../middleware/validation');
const { adminLogin, refreshToken, logout } = require('../scripts/authController');

const router = express.Router();

router.post('/login', loginValidation, handleValidationErrors, async (req, res) => {
  const { username, password } = req.body;
  const result = await adminLogin(username, password);
  res.status(result.statusCode || 200).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  const result = await refreshToken(refresh_token);
  res.status(result.statusCode || 200).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

router.post('/logout', async (req, res) => {
  const { refresh_token } = req.body;
  const result = await logout(refresh_token);
  res.status(result.statusCode || 200).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error }),
  });
});

module.exports = router;


