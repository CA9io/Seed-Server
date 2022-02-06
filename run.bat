@echo off
echo "removing old dist: "
@RD /S /Q %~dp0dist\ 
@RD /S /Q %~dp0node_modules\ 
echo "installing dependencies: "
call npm install --only=prod 
echo "installing typescript: "
call npm install -g typescript 
echo "compiling typescript: "
call tsc.cmd
echo "copying your config: "
COPY  %~dp0config.json  %~dp0dist\config\config.json 
echo "executing node: "
call node %~dp0dist\index.js
PAUSE 