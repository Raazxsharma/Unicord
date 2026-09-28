@echo off
echo ====================================
echo Bundling and Pushing to Vercel...
echo ====================================
python bundle.py
git add .
git commit -m "Auto-update Discord App"
git push
echo ====================================
echo Done! Vercel is now auto-deploying live!
echo Check: https://unicordiu.vercel.app
echo ====================================
pause
