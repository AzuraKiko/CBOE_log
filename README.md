3. Tạo thư mục logs
   mkdir logs

4. Cài đặt PM2 (nếu chưa có)
   npm install -g pm2

5. Chạy với PM2
   pm2 start ecosystem.config.js

6. Các lệnh PM2 hữu ích
   pm2 list

pm2 logs auto-scheduler

pm2 restart auto-scheduler

pm2 stop auto-scheduler

pm2 delete auto-scheduler

pm2 monit

7. Tự động khởi động PM2 khi reboot
   pm2 startup

pm2 save

8. File package.json để quản lý dependencies
   {
   "name": "auto-scheduler",
   "version": "1.0.0",
   "description": "Automated script scheduler with PM2",
   "main": "scheduler.js",
   "scripts": {
   "start": "pm2 start ecosystem.config.js",
   "stop": "pm2 stop auto-scheduler",
   "restart": "pm2 restart auto-scheduler",
   "logs": "pm2 logs auto-scheduler",
   "monit": "pm2 monit"
   },
   "dependencies": {
   "node-cron": "^3.0.2"
   }
   }
