const express = require('express');
const router = express.Router();
const lotesController = require('../controllers/lotesController');

router.get('/', lotesController.listarLotes);

module.exports = router; 