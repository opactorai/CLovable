#!/bin/bash

echo "🚀 بدء خوادم التطبيق..."

# إيقاف العمليات السابقة
echo "🛑 إيقاف العمليات السابقة..."
pkill -f uvicorn
pkill -f "next dev"
sleep 2

# بدء Backend
echo "🔧 بدء Backend..."
cd /workspace/apps/api
source .venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080 --log-level info &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# انتظار Backend
sleep 3

# اختبار Backend
echo "🧪 اختبار Backend..."
curl -s http://localhost:8080/api/api-keys/list > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Backend يعمل بشكل صحيح"
else
    echo "❌ مشكلة في Backend"
fi

# بدء Frontend
echo "🌐 بدء Frontend..."
cd /workspace/apps/web
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# انتظار Frontend
sleep 5

# اختبار Frontend
echo "🧪 اختبار Frontend..."
curl -s http://localhost:3000 > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Frontend يعمل بشكل صحيح"
else
    echo "❌ مشكلة في Frontend"
fi

echo ""
echo "🎉 الخوادم جاهزة!"
echo "Backend: http://localhost:8080"
echo "Frontend: http://localhost:3000"
echo ""
echo "لإيقاف الخوادم: kill $BACKEND_PID $FRONTEND_PID"

# انتظار المستخدم
wait