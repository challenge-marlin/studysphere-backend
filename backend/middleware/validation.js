const { body, validationResult } = require('express-validator');

// 管理者ログイン用バリデーション
const loginValidation = [
  body('username')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('ユーザー名は1文字以上50文字以下で入力してください')
    .matches(/^[a-zA-Z0-9_/.-]+$/)
    .withMessage('ログインIDは半角英数字、アンダースコア、ハイフン、スラッシュ、ドットのみ使用可能です'),
  body('password')
    .isLength({ min: 1 })
    .withMessage('パスワードは1文字以上で入力してください')
];

// 拠点情報作成用バリデーション
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
    .isLength({ min: 1, max: 65535 })
    .withMessage('住所は1文字以上65535文字以下で入力してください'),
  body('phone')
    .optional()
    .trim()
    .isLength({ min: 0, max: 20 })
    .withMessage('電話番号は20文字以下で入力してください'),
  body('office_type_id')
    .optional()
    .custom((value) => {
      // null、undefined、空文字列は許可
      if (value === null || value === undefined || value === '') {
        return true;
      }
      // 数値の場合は正の整数かチェック
      if (typeof value === 'number' || !isNaN(Number(value))) {
        const numValue = Number(value);
        return Number.isInteger(numValue) && numValue > 0;
      }
      // 文字列の場合は空でなければ許可
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      return true;
    })
    .withMessage('事業所タイプIDは正の整数または有効な文字列で入力してください'),
  body('contract_type')
    .optional()
    .isIn(['30days', '90days', '1year'])
    .withMessage('契約タイプは30days、90days、1yearのいずれかで入力してください'),
  body('max_users')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('利用者上限数は1以上10000以下で入力してください')
];

// 拠点情報更新用バリデーション
const satelliteUpdateValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('拠点名は1文字以上255文字以下で入力してください'),
  body('address')
    .optional()
    .trim()
    .isLength({ min: 1, max: 65535 })
    .withMessage('住所は1文字以上65535文字以下で入力してください'),
  body('phone')
    .optional()
    .trim()
    .isLength({ min: 0, max: 20 })
    .withMessage('電話番号は20文字以下で入力してください'),
  body('office_type_id')
    .optional()
    .custom((value) => {
      // null、undefined、空文字列は許可
      if (value === null || value === undefined || value === '') {
        return true;
      }
      // 数値の場合は正の整数かチェック
      if (typeof value === 'number' || !isNaN(Number(value))) {
        const numValue = Number(value);
        return Number.isInteger(numValue) && numValue > 0;
      }
      // 文字列の場合は空でなければ許可
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      return true;
    })
    .withMessage('事業所タイプIDは正の整数または有効な文字列で入力してください'),
  body('contract_type')
    .optional()
    .isIn(['30days', '90days', '1year'])
    .withMessage('契約タイプは30days、90days、1yearのいずれかで入力してください'),
  body('max_users')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('利用者上限数は1以上10000以下で入力してください'),
  body('status')
    .optional()
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
    .custom((value) => {
      console.log('address validation:', { value, type: typeof value });
      // null、undefined、空文字列は許可
      if (value === null || value === undefined || value === '') {
        return true;
      }
      // 文字列の場合は長さチェック
      if (typeof value === 'string') {
        return value.length <= 65535;
      }
      return true;
    })
    .withMessage('企業住所は65535文字以下で入力してください'),
  body('phone')
    .optional()
    .custom((value) => {
      console.log('phone validation:', { value, type: typeof value });
      // null、undefined、空文字列は許可
      if (value === null || value === undefined || value === '') {
        return true;
      }
      // 文字列の場合は正規表現チェック
      if (typeof value === 'string') {
        const trimmedValue = value.trim();
        if (trimmedValue === '') {
          return true; // 空文字列は許可
        }
        return /^[\d\-\(\)\s]+$/.test(trimmedValue);
      }
      return true;
    })
    .withMessage('電話番号は数字、ハイフン、括弧、スペースのみ使用可能です')
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
    .custom((value) => {
      // null、undefined、空文字列は許可
      if (value === null || value === undefined || value === '') {
        return true;
      }
      // 文字列の場合は長さチェック
      if (typeof value === 'string') {
        return value.length <= 65535;
      }
      return true;
    })
    .withMessage('企業住所は65535文字以下で入力してください'),
  body('phone')
    .optional()
    .custom((value) => {
      // null、undefined、空文字列は許可
      if (value === null || value === undefined || value === '') {
        return true;
      }
      // 文字列の場合は正規表現チェック
      if (typeof value === 'string') {
        const trimmedValue = value.trim();
        if (trimmedValue === '') {
          return true; // 空文字列は許可
        }
        return /^[\d\-\(\)\s]+$/.test(trimmedValue);
      }
      return true;
    })
    .withMessage('電話番号は数字、ハイフン、括弧、スペースのみ使用可能です')
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

// コース作成・更新用バリデーション
const courseValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('コース名は1文字以上255文字以下で入力してください'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 65535 })
    .withMessage('コースの説明は65535文字以下で入力してください'),
  body('category')
    .isIn(['必修科目', '選択科目'])
    .withMessage('カテゴリは必修科目または選択科目で入力してください'),
  body('order_index')
    .optional()
    .isInt({ min: 0 })
    .withMessage('表示順序は0以上の整数で入力してください'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'draft'])
    .withMessage('ステータスはactive、inactive、draftのいずれかで入力してください')
];

// レッスン作成・更新用バリデーション
const lessonValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('レッスン名は1文字以上255文字以下で入力してください'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 65535 })
    .withMessage('レッスンの説明は65535文字以下で入力してください'),
  body('duration')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('所要時間は50文字以下で入力してください'),
  body('order_index')
    .optional()
    .isInt({ min: 0 })
    .withMessage('レッスン順序は0以上の整数で入力してください'),
  body('has_assignment')
    .optional()
    .isBoolean()
    .withMessage('課題の有無は真偽値で入力してください'),
  body('course_id')
    .isInt({ min: 1 })
    .withMessage('コースIDは正の整数で入力してください'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'draft'])
    .withMessage('ステータスはactive、inactive、draftのいずれかで入力してください')
];

// バリデーションエラーハンドラー
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('バリデーションエラー:', errors.array());
    console.log('リクエストボディ:', req.body);
    console.log('リクエストボディの型:', {
      name: typeof req.body.name,
      address: typeof req.body.address,
      phone: typeof req.body.phone,
      office_type_id: typeof req.body.office_type_id
    });
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
  courseValidation,
  lessonValidation,
  handleValidationErrors
}; 