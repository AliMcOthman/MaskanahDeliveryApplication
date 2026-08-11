#!/usr/bin/env bash
# ============================================================
#  ارفع تطبيق "توصيل مسكنة" إلى GitHub بنقرة واحدة
#  الاستخدام:  bash push-to-github.sh
#  ملاحظة: أول تشغيل سيطلب اسم المستخدم وكلمة المرور/Token
# ============================================================
set -e
cd "$(dirname "$0")"

REPO_URL="https://github.com/AliMcOthman/MaskanahDeliveryApp.git"

echo "==> توصيل مسكنة: بدء الرفع إلى GitHub"

# إنشاء مستودع git إن لم يكن موجوداً
if [ ! -d .git ]; then
  echo "==> إنشاء مستودع محلي..."
  git init
  git branch -M main
fi

# ضبط الاسم والبريد إن لم يكونا مضبوطين
if ! git config user.name >/dev/null 2>&1; then
  echo "أدخل اسمك على GitHub:"
  read -r NAME
  git config user.name "$NAME"
fi
if ! git config user.email >/dev/null 2>&1; then
  echo "أدخل بريدك الإلكتروني (المستخدم في GitHub):"
  read -r EMAIL
  git config user.email "$EMAIL"
fi

# إضافة كل الملفات وإعداد أول إصدار
git add -A
if git diff --cached --quiet; then
  echo "==> لا توجد تغييرات جديدة، سأرفع آخر إصدار مباشرة."
else
  git commit -m "توصيل مسكنة — تطبيق طلب التوصيل عبر واتساب 🛵"
fi

# ربط المستودع البعيد
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"

echo "==> رفع الملفات إلى $REPO_URL"
if git push -u origin main; then
  echo ""
  echo "✅ تم الرفع بنجاح! افتح: https://github.com/AliMcOthman/MaskanahDeliveryApp"
else
  echo "==> يبدو أن المستودع يحتوي ملفات أولية، سأدمجها ثم أعيد الرفع..."
  git pull --rebase origin main 2>/dev/null || true
  git push -u origin main
  echo ""
  echo "✅ تم الرفع بنجاح! افتح: https://github.com/AliMcOthman/MaskanahDeliveryApp"
fi