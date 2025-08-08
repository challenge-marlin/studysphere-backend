const express = require('express');
const { getOfficeTypes, createOfficeType, deleteOfficeType } = require('../scripts/officeTypeController');
const { officeTypeValidation, handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

router.get('/', async (req, res) => {
  const result = await getOfficeTypes();
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({ message: result.message, error: result.error });
  }
});

router.post('/', officeTypeValidation, handleValidationErrors, async (req, res) => {
  const result = await createOfficeType(req.body);
  res.status(result.success ? 201 : 400).json({
    success: result.success,
    message: result.message,
    ...(result.data && { data: result.data }),
    ...(result.error && { error: result.error }),
  });
});

router.delete('/:id', async (req, res) => {
  const officeTypeId = parseInt(req.params.id);
  const result = await deleteOfficeType(officeTypeId);
  res.status(result.success ? 200 : (result.statusCode || 400)).json({
    success: result.success,
    message: result.message,
    ...(result.error && { error: result.error }),
  });
});

module.exports = router;


