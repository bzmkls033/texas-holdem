@echo off
echo ========================================
echo    德州扑克 - 一键部署到 Render
echo ========================================
echo.
echo 请按照以下步骤操作:
echo.
echo 1. 打开 https://render.com 并登录/注册
echo 2. 点击 "New" -> "Blueprint"
echo 3. 连接你的 GitHub 账号
echo 4. 创建一个新仓库叫 "texas-holdem"
echo 5. 推送本文件夹的代码到仓库
echo 6. Render 会自动检测 render.yaml 并部署
echo.
echo ========================================
echo 或者使用以下命令推送代码到 GitHub:
echo ========================================
echo.
echo git remote add origin https://github.com/你的用户名/texas-holdem.git
echo git push -u origin master
echo.
echo ========================================
echo 部署完成后你会获得一个永久地址，如:
echo https://texas-holdem.onrender.com
echo ========================================
pause
