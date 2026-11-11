// backend/routes/auth.js
const express    = require('express');
const router     = express.Router();
const { login, register, me } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

router.post('/login',    login);
router.post('/register', register);
router.get('/me',        verifyToken, me);

module.exports = router;
