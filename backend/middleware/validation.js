const { body, validationResult } = require('express-validator');

// 管理者ログイン用バリデーション
const loginValidation = [
  body('username')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('ユーザー名は1文字以上50文字以下で入力してください'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('パスワードは6文字以上で入力してください')
];

// 拠点作成用バリデーション
const satelliteValidation = [
  body('company_id')
    .isInt({ min: 1 })
    .withMessage('企業IDは正の整数で入力してください'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('拠点名は1文字以上255文字以下で入力してください'),
  body('address')
    .trim()
    .isLength({ min: 1 })
    .withMessage('拠点住所は必須です'),
  body('max_users')
    .isInt({ min: 1, max: 1000 })
    .withMessage('利用者上限数は1以上1000以下で入力してください')
];

// 拠点更新用バリデーション
const satelliteUpdateValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('拠点名は1文字以上255文字以下で入力してください'),
  body('address')
    .trim()
    .isLength({ min: 1 })
    .withMessage('拠点住所は必須です'),
  body('max_users')
    .isInt({ min: 1, max: 1000 })
    .withMessage('利用者上限数は1以上1000以下で入力してください'),
  body('status')
    .isIn([0, 1])
    .withMessage('ステータスは0または1で入力してください')
];

// 企業情報作成用バリデーション
const companyValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('企業名は1文字以上255文字以下で入力してください'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 65535 })
    .withMessage('企業住所は65535文字以下で入力してください'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\-\(\)\s]+$/)
    .withMessage('電話番号は数字、ハイフン、括弧、スペースのみ使用可能です'),
  body('office_type_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('事業所タイプIDは正の整数で入力してください'),
  body('max_users')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('利用者上限数は1以上10000以下で入力してください')
];

// 企業情報更新用バリデーション
const companyUpdateValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('企業名は1文字以上255文字以下で入力してください'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 65535 })
    .withMessage('企業住所は65535文字以下で入力してください'),
  body('phone')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') {
        return true; // null、undefined、空文字列は許可
      }
      const trimmedValue = value.trim();
      if (trimmedValue === '') {
        return true; // 空文字列は許可
      }
      return /^[\d\-\(\)\s]+$/.test(trimmedValue);
    })
    .withMessage('電話番号は数字、ハイフン、括弧、スペースのみ使用可能です'),
  body('office_type_id')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') {
        return true; // null、undefined、空文字列は許可
      }
      const numValue = Number(value);
      return !isNaN(numValue) && Number.isInteger(numValue) && numValue > 0;
    })
    .withMessage('事業所タイプIDは正の整数で入力してください'),
  body('max_users')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('利用者上限数は1以上10000以下で入力してください')
];

// 事業所タイプ作成用バリデーション
const officeTypeValidation = [
  body('type')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('事業所タイプ名は1文字以上100文字以下で入力してください')
];

// 事業所タイプ更新用バリデーション
const officeTypeUpdateValidation = [
  body('type')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('事業所タイプ名は1文字以上100文字以下で入力してください')
];

// バリデーションエラーハンドラー
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('バリデーションエラー:', errors.array());
    console.log('リクエストボディ:', req.body);
    return res.status(400).json({
      success: false,
      message: '入力データにエラーがあります',
      errors: errors.array()
    });
  }
  next();
};

module.exports = {
  loginValidation,
  satelliteValidation,
  satelliteUpdateValidation,
  companyValidation,
  companyUpdateValidation,
  officeTypeValidation,
  officeTypeUpdateValidation,
  handleValidationErrors
}; 