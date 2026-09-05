@echo off
cd /d C:\Users\hp\dry-ginger-sales-os
rem Local repro: production Neon URL + local auth/seed vars
for /f "usebackq tokens=1,* delims==" %%a in (".env.local") do set %%a=%%b
for /f "usebackq tokens=1,* delims==" %%a in (".env.vercel.prod") do if /i "%%a"=="POSTGRES_URL" set POSTGRES_URL=%%b
rem vercel env pull wraps values in double quotes — strip them or neon() rejects the URL as invalid
set POSTGRES_URL=%POSTGRES_URL:"=%
if /i "%AI_PROVIDER%"=="" set AI_PROVIDER=local
set NODE_ENV=development
set PORT=3111
npx next dev -p 3111 > local-dev.log 2>&1
